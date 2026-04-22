"""
BlancBleu — Service d'extraction PMT
Prescription Médicale de Transport

Pipeline :
  1. OCR Tesseract (PDF ou image) avec prétraitement CERFA
  2. Nettoyage texte OCR (artefacts scan, cases à cocher)
  3. Extraction par regex CERFA + fallback patterns libres
  4. NER spaCy (noms de personnes et lieux) si champs manquants
  5. Score de confiance pondéré par importance des champs
  6. Validation : champs critiques manquants ?

Aucune API externe — 100% local.
"""

import logging
import re
from typing import Optional

from utils.ocr_utils import extraire_texte_complet
from utils.regex_patterns import (
    PATIENT_PRENOM,
    DATE_PRESCRIPTION, DATE_GENERIQUE,
    ALLER_RETOUR, ALLER_SIMPLE,
    OXYGENE, BRANCARDAGE, FREQUENCE,
    extraire_premier_match,
    extraire_nom_patient,
    extraire_nom_medecin,
    extraire_rpps,
    extraire_date_naissance,
    extraire_secu,
    extraire_adresse_depart,
    extraire_adresse_destination,
    extraire_mobilite,
    extraire_type_transport,
    extraire_motif,
)
from schemas.pmt_schemas import (
    PMTExtraction, PMTExtractionResponse,
    PatientExtrait, MedecinExtrait,
)

logger = logging.getLogger("blancbleu.ai.pmt")

# Champs critiques (sans eux, validation humaine obligatoire)
CHAMPS_CRITIQUES = ["patient.nom", "typeTransportAutorise", "mobilite", "destination"]


# ─── Nettoyage texte OCR ──────────────────────────────────────────────────────

def nettoyer_texte_cerfa(texte: str) -> str:
    """
    Nettoie le texte OCR d'une PMT CERFA :
    - Supprime les artefacts de scan (cases à cocher, puces)
    - Normalise les numéros en cases CERFA (chiffres séparés par espaces)
    - Normalise les sauts de ligne multiples
    """
    # Supprimer symboles de cases à cocher et artefacts scan
    texte = re.sub(r"[□■☐☑✓✗▪▫◻◼●•]", " ", texte)

    # Normaliser les numéros à cases CERFA (chiffres isolés par espaces)
    # Séquences de 8 chiffres espacés → DDMMYYYY (date naissance)
    texte = re.sub(
        r"\b(\d)\s(\d)\s(\d)\s(\d)\s(\d)\s(\d)\s(\d)\s(\d)\b",
        r"\1\2\3\4\5\6\7\8",
        texte,
    )
    # Séquences de 11 chiffres espacés → RPPS
    texte = re.sub(
        r"\b(\d)\s(\d)\s(\d)\s(\d)\s(\d)\s(\d)\s(\d)\s(\d)\s(\d)\s(\d)\s(\d)\b",
        r"\1\2\3\4\5\6\7\8\9\10\11",
        texte,
    )
    # Séquences de 15 chiffres espacés → numéro sécu
    texte = re.sub(
        r"\b(\d)\s(\d)\s(\d)\s(\d)\s(\d)\s(\d)\s(\d)\s(\d)\s(\d)\s(\d)\s(\d)\s(\d)\s(\d)\s(\d)\s(\d)\b",
        r"\1\2\3\4\5\6\7\8\9\10\11\12\13\14\15",
        texte,
    )

    # Normaliser les sauts de ligne multiples
    texte = re.sub(r"\n{3,}", "\n\n", texte)

    return texte


# ─── Score de confiance ───────────────────────────────────────────────────────

def calculer_confiance(extraction: dict) -> float:
    """
    Score de confiance pondéré selon l'importance des champs PMT.
    Champs critiques (70%) > importants (20%) > optionnels (10%).
    """
    poids = {
        # Critiques — 70%
        "patient_nom":         0.20,
        "type_transport":      0.15,
        "mobilite":            0.15,
        "motif":               0.10,
        "adresse_destination": 0.10,
        # Importants — 20%
        "medecin_nom":         0.08,
        "aller_retour":        0.07,
        "adresse_depart":      0.05,
        # Optionnels — 10%
        "patient_prenom":      0.04,
        "date_naissance":      0.03,
        "rpps":                0.02,
        "frequence":           0.01,
    }

    VALEURS_VIDES = {"", "Non détecté", "null", "None", "none"}

    score = 0.0
    for champ, poids_champ in poids.items():
        valeur = extraction.get(champ)
        if valeur is not None and str(valeur).strip() not in VALEURS_VIDES:
            score += poids_champ

    return round(score, 2)


# ─── Pipeline principal ───────────────────────────────────────────────────────

def extraire_pmt(fichier_bytes: bytes, mimetype: str, nlp=None) -> PMTExtractionResponse:
    """
    Extrait les données d'une PMT depuis un fichier PDF ou image.

    Args:
        fichier_bytes : contenu brut du fichier
        mimetype      : type MIME ("application/pdf", "image/jpeg", etc.)
        nlp           : modèle spaCy chargé (optionnel, pour NER)

    Returns:
        PMTExtractionResponse avec extraction, confiance, champs manquants
    """
    logger.info(f"Extraction PMT — type: {mimetype}, taille: {len(fichier_bytes)} octets")

    # ── Étape 1 : OCR ─────────────────────────────────────────────────────────
    texte_brut = extraire_texte_complet(fichier_bytes, mimetype)
    logger.debug(f"OCR brut : {len(texte_brut)} caractères extraits")

    if not texte_brut or len(texte_brut) < 20:
        logger.warning("OCR : texte insuffisant pour extraction")
        return PMTExtractionResponse(
            extraction=PMTExtraction(patient=PatientExtrait(), medecin=MedecinExtrait()),
            confiance=0.0,
            validationRequise=True,
            champsManquants=CHAMPS_CRITIQUES,
            champsIncertains=[],
            texteOCR=texte_brut,
        )

    # ── Étape 2 : Nettoyage texte CERFA ───────────────────────────────────────
    texte_ocr = nettoyer_texte_cerfa(texte_brut)
    logger.debug(f"Texte nettoyé : {len(texte_ocr)} caractères")

    # ── Étape 3 : Extraction par regex (CERFA + fallback libre) ───────────────
    champs_incertains = []

    # Patient
    patient_nom    = extraire_nom_patient(texte_ocr)
    patient_prenom = extraire_premier_match(PATIENT_PRENOM, texte_ocr)
    patient_naissance = extraire_date_naissance(texte_ocr)
    patient_secu   = extraire_secu(texte_ocr)

    # Médecin
    medecin_nom  = extraire_nom_medecin(texte_ocr)
    medecin_rpps = extraire_rpps(texte_ocr)

    # Date de prescription
    date_prescription = extraire_premier_match(DATE_PRESCRIPTION, texte_ocr)
    if not date_prescription:
        date_prescription = extraire_premier_match(DATE_GENERIQUE, texte_ocr)
        if date_prescription:
            champs_incertains.append("datePrescription")

    # Transport
    type_transport = extraire_type_transport(texte_ocr)
    mobilite, conf_mobilite = extraire_mobilite(texte_ocr)
    if 0 < conf_mobilite < 1.0:
        champs_incertains.append("mobilite")

    # Adresses
    adresse_depart      = extraire_adresse_depart(texte_ocr)
    adresse_destination = extraire_adresse_destination(texte_ocr)
    if not adresse_destination:
        champs_incertains.append("destination")

    # Aller-retour
    aller_retour = None
    if ALLER_RETOUR.search(texte_ocr):
        aller_retour = True
    elif ALLER_SIMPLE.search(texte_ocr):
        aller_retour = False

    # Besoins spéciaux et motif
    oxygene     = bool(OXYGENE.search(texte_ocr))
    brancardage = bool(BRANCARDAGE.search(texte_ocr))
    motif       = extraire_motif(texte_ocr)
    frequence   = extraire_premier_match(FREQUENCE, texte_ocr)

    # ── Étape 4 : NER spaCy (enrichissement si champs critiques manquants) ────
    if nlp and (not patient_nom or not medecin_nom or not adresse_destination):
        texte_ocr, patient_nom, medecin_nom, adresse_destination = _enrichir_avec_ner(
            nlp, texte_ocr, patient_nom, medecin_nom, adresse_destination
        )

    # ── Étape 5 : Score de confiance pondéré ──────────────────────────────────
    extraction_dict = {
        "patient_nom":         patient_nom,
        "patient_prenom":      patient_prenom,
        "type_transport":      type_transport,
        "mobilite":            mobilite,
        "motif":               motif,
        "adresse_destination": adresse_destination,
        "adresse_depart":      adresse_depart,
        "medecin_nom":         medecin_nom,
        "aller_retour":        aller_retour,
        "date_naissance":      patient_naissance,
        "rpps":                medecin_rpps,
        "frequence":           frequence,
    }

    confiance = calculer_confiance(extraction_dict)

    # Pénalité si mobilité ambiguë
    if 0 < conf_mobilite < 1.0:
        confiance = round(confiance * 0.92, 2)

    # ── Étape 6 : Champs critiques manquants ──────────────────────────────────
    # Mapping clés extraction_dict → noms CHAMPS_CRITIQUES
    critique_map = {
        "patient.nom":           patient_nom,
        "typeTransportAutorise": type_transport,
        "mobilite":              mobilite,
        "destination":           adresse_destination,
    }
    champs_manquants = [c for c, v in critique_map.items() if not v]
    validation_requise = confiance < 0.75 or len(champs_manquants) > 0

    logger.info(
        f"PMT extraite — confiance: {confiance:.2f}, "
        f"manquants: {champs_manquants}, "
        f"validation requise: {validation_requise}"
    )

    return PMTExtractionResponse(
        extraction=PMTExtraction(
            patient=PatientExtrait(
                nom=patient_nom,
                prenom=patient_prenom,
                dateNaissance=patient_naissance,
                numeroSecu=_masquer_secu(patient_secu),
            ),
            medecin=MedecinExtrait(
                nom=medecin_nom,
                rpps=medecin_rpps,
            ),
            datePrescription=date_prescription,
            typeTransportAutorise=type_transport,
            mobilite=mobilite,
            destination=adresse_destination,
            allerRetour=aller_retour,
            oxygene=oxygene,
            brancardage=brancardage,
            motif=motif,
            frequence=frequence,
        ),
        confiance=confiance,
        validationRequise=validation_requise,
        champsManquants=champs_manquants,
        champsIncertains=list(set(champs_incertains)),
        texteOCR=texte_ocr[:2000] if texte_ocr else None,
    )


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _enrichir_avec_ner(nlp, texte, patient_nom, medecin_nom, destination):
    """
    Enrichit l'extraction avec la reconnaissance d'entités nommées spaCy.
    Utilisé uniquement si des champs critiques sont manquants.
    """
    doc = nlp(texte[:3000])

    personnes = [ent.text for ent in doc.ents if ent.label_ == "PER"]
    lieux = [ent.text for ent in doc.ents if ent.label_ in ("LOC", "ORG")]

    if not patient_nom and len(personnes) >= 1:
        patient_nom = personnes[0]
        logger.debug(f"NER patient : {patient_nom}")

    if not medecin_nom and len(personnes) >= 2:
        medecin_nom = personnes[1]
        logger.debug(f"NER médecin : {medecin_nom}")

    if not destination and lieux:
        destination = lieux[0]
        logger.debug(f"NER destination : {destination}")

    return texte, patient_nom, medecin_nom, destination


def _masquer_secu(numero_secu: Optional[str]) -> Optional[str]:
    """
    Masque partiellement le numéro de sécurité sociale (RGPD).
    Ex: "185057511604277" → "1**************"
    """
    if not numero_secu:
        return None
    chiffres = re.sub(r"\D", "", numero_secu)
    if len(chiffres) >= 1:
        return chiffres[0] + "*" * (len(chiffres) - 1)
    return None
