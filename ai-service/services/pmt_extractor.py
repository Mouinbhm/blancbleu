"""
BlancBleu — Service d'extraction PMT
Prescription Médicale de Transport

Pipeline :
  1. OCR Tesseract (PDF ou image)
  2. Extraction par regex (champs structurés)
  3. NER spaCy (noms de personnes et lieux)
  4. Calcul score de confiance
  5. Validation : champs critiques manquants ?

Aucune API externe — 100% local.
"""

import logging
import re
from typing import Optional
from fastapi import Request

from utils.ocr_utils import extraire_texte_complet
from utils.regex_patterns import (
    PATIENT_NOM, PATIENT_PRENOM, PATIENT_DATE_NAISSANCE, PATIENT_NUMERO_SECU,
    MEDECIN_NOM, MEDECIN_RPPS,
    DATE_PRESCRIPTION, DATE_GENERIQUE,
    DESTINATION, ALLER_RETOUR, ALLER_SIMPLE,
    OXYGENE, BRANCARDAGE, FREQUENCE,
    extraire_premier_match,
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
    logger.info(f"Extraction PMT — type: {mimetype}, taille: {len(fichier_bytes)} bytes")

    # ── Étape 1 : OCR ─────────────────────────────────────────────────────────
    texte_ocr = extraire_texte_complet(fichier_bytes, mimetype)
    logger.debug(f"OCR : {len(texte_ocr)} caractères extraits")

    if not texte_ocr or len(texte_ocr) < 20:
        logger.warning("OCR : texte insuffisant")
        return PMTExtractionResponse(
            extraction=PMTExtraction(patient=PatientExtrait(), medecin=MedecinExtrait()),
            confiance=0.0,
            validationRequise=True,
            champsManquants=CHAMPS_CRITIQUES,
            champsIncertains=[],
            texteOCR=texte_ocr,
        )

    # ── Étape 2 : Extraction par regex ────────────────────────────────────────
    scores_champs = {}  # nom_champ → float (0 ou 1)
    champs_incertains = []

    # Patient
    patient_nom = extraire_premier_match(PATIENT_NOM, texte_ocr)
    patient_prenom = extraire_premier_match(PATIENT_PRENOM, texte_ocr)
    patient_naissance = extraire_premier_match(PATIENT_DATE_NAISSANCE, texte_ocr)
    patient_secu = extraire_premier_match(PATIENT_NUMERO_SECU, texte_ocr)

    scores_champs["patient.nom"] = 1.0 if patient_nom else 0.0
    scores_champs["patient.prenom"] = 0.8 if patient_prenom else 0.0

    # Médecin
    medecin_nom = extraire_premier_match(MEDECIN_NOM, texte_ocr)
    medecin_rpps = extraire_premier_match(MEDECIN_RPPS, texte_ocr)
    scores_champs["medecin.nom"] = 1.0 if medecin_nom else 0.0

    # Date prescription
    date_prescription = extraire_premier_match(DATE_PRESCRIPTION, texte_ocr)
    if not date_prescription:
        # Fallback : première date générique trouvée
        date_prescription = extraire_premier_match(DATE_GENERIQUE, texte_ocr)
        if date_prescription:
            champs_incertains.append("datePrescription")
            scores_champs["datePrescription"] = 0.6
        else:
            scores_champs["datePrescription"] = 0.0
    else:
        scores_champs["datePrescription"] = 1.0

    # Type de transport
    type_transport = extraire_type_transport(texte_ocr)
    scores_champs["typeTransportAutorise"] = 1.0 if type_transport else 0.0

    # Mobilité
    mobilite, conf_mobilite = extraire_mobilite(texte_ocr)
    scores_champs["mobilite"] = conf_mobilite
    if 0 < conf_mobilite < 1.0:
        champs_incertains.append("mobilite")

    # Destination
    destination = extraire_premier_match(DESTINATION, texte_ocr)
    scores_champs["destination"] = 0.9 if destination else 0.0
    if not destination:
        champs_incertains.append("destination")

    # Aller-retour
    aller_retour = None
    if ALLER_RETOUR.search(texte_ocr):
        aller_retour = True
    elif ALLER_SIMPLE.search(texte_ocr):
        aller_retour = False

    # Besoins spéciaux
    oxygene = bool(OXYGENE.search(texte_ocr))
    brancardage = bool(BRANCARDAGE.search(texte_ocr))

    # Motif
    motif = extraire_motif(texte_ocr)

    # Fréquence
    frequence = extraire_premier_match(FREQUENCE, texte_ocr)

    # ── Étape 3 : NER spaCy (amélioration noms/lieux) ─────────────────────────
    if nlp and (not patient_nom or not medecin_nom or not destination):
        texte_ocr, patient_nom, medecin_nom, destination = _enrichir_avec_ner(
            nlp, texte_ocr, patient_nom, medecin_nom, destination
        )
        # Mise à jour scores si NER a trouvé quelque chose
        if patient_nom:
            scores_champs["patient.nom"] = max(scores_champs["patient.nom"], 0.75)
        if medecin_nom:
            scores_champs["medecin.nom"] = max(scores_champs["medecin.nom"], 0.75)

    # ── Étape 4 : Score de confiance global ───────────────────────────────────
    # Pondération : champs critiques comptent plus
    poids = {
        "patient.nom": 2.0,
        "typeTransportAutorise": 2.0,
        "mobilite": 2.0,
        "destination": 1.5,
        "patient.prenom": 1.0,
        "medecin.nom": 1.0,
        "datePrescription": 1.0,
    }

    total_poids = sum(poids.values())
    score_pondere = sum(
        scores_champs.get(champ, 0.0) * p for champ, p in poids.items()
    )
    confiance = round(score_pondere / total_poids, 3)

    # ── Étape 5 : Champs critiques manquants ──────────────────────────────────
    champs_manquants = [
        champ for champ in CHAMPS_CRITIQUES
        if scores_champs.get(champ, 0.0) == 0.0
    ]

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
            destination=destination,
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
        texteOCR=texte_ocr[:2000] if texte_ocr else None,  # Limiter pour la réponse
    )


def _enrichir_avec_ner(nlp, texte, patient_nom, medecin_nom, destination):
    """
    Enrichit l'extraction avec la reconnaissance d'entités nommées spaCy.
    Utilise uniquement si des champs critiques sont manquants.
    """
    doc = nlp(texte[:3000])  # Limiter pour les performances

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
    Ex: "1 85 05 75 116 042 77" → "1 ** ** ** *** *** **"
    """
    if not numero_secu:
        return None
    # Conserver uniquement le sexe (1er chiffre) pour usage interne
    chiffres = re.sub(r"\D", "", numero_secu)
    if len(chiffres) >= 1:
        return chiffres[0] + "*" * (len(chiffres) - 1)
    return None
