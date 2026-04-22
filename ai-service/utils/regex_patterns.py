"""
BlancBleu — Patterns Regex pour extraction PMT
Prescription Médicale de Transport française

Supporte :
  - Formulaires CERFA n°11574 (PMT officielle Assurance Maladie)
  - PMT libres de cabinet privé
"""

import re
from typing import Optional


# ════════════════════════════════════════════════════════════════════════════
# Patterns CERFA n°11574 — structure officielle
# Les patterns CERFA sont essayés en premier ; fallback sur patterns libres.
# ════════════════════════════════════════════════════════════════════════════

# ── Nom / Prénom patient ──────────────────────────────────────────────────────
# CERFA : "nom et prénom   CHATELLIER MARLENE"
# CERFA : "bénéficiaire\n...\nCHATELLIER MARLENE"
CERFA_PATIENT_NOM = [
    re.compile(
        r"nom\s+et\s+pr[eé]nom\s+([A-ZÉÈÊËÀÂÙÛÜÏÎÇŒÆ][A-ZÉÈÊËÀÂÙÛÜÏÎÇŒÆ\s\-]{2,40})",
        re.IGNORECASE,
    ),
    re.compile(
        r"b[eé]n[eé]ficiaire[^\n]*\n[^\n]*\n?\s*([A-ZÉÈÊËÀÂÙÛÜÏÎÇ]{2,}(?:\s+[A-ZÉÈÊËÀÂÙÛÜÏÎÇ]{2,})+)",
        re.IGNORECASE,
    ),
    re.compile(
        r"personne\s+(?:prise\s+en\s+charge|b[eé]n[eé]ficiaire)[^\n]*\n[^\n]*\n\s*([A-ZÉÈÊËÀÂÙÛÜÏÎÇ]{2,}(?:\s+[A-ZÉÈÊËÀÂÙÛÜÏÎÇ]{2,})+)",
        re.IGNORECASE,
    ),
]

# ── Numéro de sécurité sociale ────────────────────────────────────────────────
# CERFA : cases "2 5 7 0 5 5 3 1 3 0 0 9 3 0 8" (15 chiffres espacés)
CERFA_SECU = [
    re.compile(
        r"(\d[\s\-]?\d{2}[\s\-]?\d{2}[\s\-]?\d{2}[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{2})"
    ),
    re.compile(
        r"num[eé]ro\s+d.immatriculation\s+([\d\s]{15,25})",
        re.IGNORECASE,
    ),
    # Cases individuelles espacées : "1 8 5 0 5 7 5 1 1 6 0 4 2 7 7"
    re.compile(
        r"\b(\d(?:\s\d){14})\b"
    ),
]

# ── Date de naissance ─────────────────────────────────────────────────────────
# CERFA : cases "3 1 0 5 1 9 5 7" → 31051957
CERFA_DATE_NAISSANCE = [
    re.compile(
        r"date\s+de\s+naissance[^\d]*([\d]{1,2}[/\-. ][\d]{1,2}[/\-. ][\d]{2,4})",
        re.IGNORECASE,
    ),
    re.compile(
        r"n[eé]\s*(?:le\s*)?([\d]{1,2}[/\-.][\d]{1,2}[/\-.][\d]{2,4})",
        re.IGNORECASE,
    ),
    # Cases CERFA après nettoyage (8 chiffres contigus = DDMMYYYY)
    re.compile(
        r"date\s+de\s+naissance[^\d]*(\d{8})",
        re.IGNORECASE,
    ),
]

# ── Médecin prescripteur ──────────────────────────────────────────────────────
# CERFA : section "identification du prescripteur" puis "nom et prénom THIERY CATHERINE"
CERFA_MEDECIN = [
    re.compile(
        r"(?:prescripteur|identification\s+du\s+prescripteur)[^\n]*\n"
        r"(?:[^\n]*\n){0,3}"
        r"nom\s+et\s+pr[eé]nom\s+([A-ZÉÈÊËÀÂÙÛÜÏÎÇŒÆ][A-ZÉÈÊËÀÂÙÛÜÏÎÇŒÆ\s\-]{2,40})",
        re.IGNORECASE,
    ),
    re.compile(
        r"identification\s+du\s+prescripteur[^\n]*\n(?:[^\n]*\n)?\s*"
        r"([A-ZÉÈÊËÀÂÙÛÜÏÎÇ]{2,}(?:\s+[A-ZÉÈÊËÀÂÙÛÜÏÎÇ]{2,})+)",
        re.IGNORECASE,
    ),
    # Deuxième occurrence de "nom et prénom" = médecin (première = patient)
    re.compile(
        r"(?:nom\s+et\s+pr[eé]nom\s+[A-ZÉÈÊËÀÂÙÛÜÏÎÇ][A-ZÉÈÊËÀÂÙÛÜÏÎÇ\s\-]+\n)"
        r"(?:[^\n]*\n){1,10}"
        r"nom\s+et\s+pr[eé]nom\s+([A-ZÉÈÊËÀÂÙÛÜÏÎÇ][A-ZÉÈÊËÀÂÙÛÜÏÎÇ\s\-]{2,40})",
        re.IGNORECASE,
    ),
]

# ── RPPS / Identifiant ────────────────────────────────────────────────────────
# CERFA : "identifiant (n°RPPS)  1 0 0 0 3 3 0 0 7 9 4" (11 chiffres)
CERFA_RPPS = [
    re.compile(
        r"identifiant\s*\(?n°\s*rpps\)?\s*([\d][\s\d]{10,14})",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:n°\s*rpps|rpps\s*n°?)\s*[:\s]*([\d\s]{10,15})",
        re.IGNORECASE,
    ),
    re.compile(
        r"identifiant[^\d\n]*([\d][\s\d]{10,14})",
        re.IGNORECASE,
    ),
]

# ── Adresse départ ────────────────────────────────────────────────────────────
# CERFA : section "lieu de départ" avec domicile ou structure de soins
CERFA_ADRESSE_DEPART = [
    re.compile(
        r"(?:lieu\s+de\s+)?d[eé]part[^\n]*\n[^\n]*"
        r"(\d+\s+(?:avenue|rue|boulevard|all[eé]e|impasse|chemin|route|place)[^\n]+)",
        re.IGNORECASE,
    ),
    re.compile(
        r"d[eé]part[^\n]*\n[^\n]*(\d{5}\s+[A-Z][A-Z\s\-]{2,30})",
        re.IGNORECASE,
    ),
    re.compile(
        r"structure\s+de\s+soins\s*[:\n]\s*([A-Z][A-Z\s\-]+(?:\d{5})?)",
        re.IGNORECASE,
    ),
]

# ── Adresse destination ───────────────────────────────────────────────────────
# CERFA : section "lieu d'arrivée / destination"
CERFA_ADRESSE_DESTINATION = [
    re.compile(
        r"(?:lieu\s+d.arriv[eé]e|destination|arriv[eé]e)[^\n]*\n[^\n]*"
        r"(\d+\s+(?:avenue|rue|boulevard|all[eé]e|impasse|chemin|route|place)[^\n]+)",
        re.IGNORECASE,
    ),
    re.compile(
        r"arriv[eé]e[^\n]*\n[^\n]*(\d{5}\s+[A-Z][A-Z\s\-]{2,30})",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:destination|[eé]tablissement\s+de\s+soins)\s*[:\n]\s*([A-Z][A-Z\s\-]{3,50})",
        re.IGNORECASE,
    ),
]

# ── Motifs CERFA ──────────────────────────────────────────────────────────────
# Cases cochées dans la section 1 du CERFA
MOTIFS_CERFA = {
    "Dialyse":         re.compile(r"h[eé]modialys|dialyse", re.IGNORECASE),
    "Chimiothérapie":  re.compile(r"chimioth[eé]rapie", re.IGNORECASE),
    "Radiothérapie":   re.compile(r"radioth[eé]rapie", re.IGNORECASE),
    "Hospitalisation": re.compile(r"hospitalis", re.IGNORECASE),
    "Consultation":    re.compile(r"consultation", re.IGNORECASE),
    "Rééducation":     re.compile(r"r[eé][eé]ducation|kinesith|ssr\b", re.IGNORECASE),
}


# ════════════════════════════════════════════════════════════════════════════
# Patterns génériques (PMT libres de cabinet privé)
# ════════════════════════════════════════════════════════════════════════════

PATIENT_NOM = re.compile(
    r"(?:nom\s*(?:du\s*patient|[:]\s*)?|assuré\s*[:])?\s*([A-ZÉÈÊËÀÂÙÛÜÏÎÇ]{2,30})",
    re.IGNORECASE,
)
PATIENT_PRENOM = re.compile(
    r"(?:pr[eé]nom\s*[:]\s*|^)([A-ZÉÈÊËÀÂÙÛÜÏÎa-zéèêëàâùûüïî]{2,30}(?:\s[A-ZÉÈÊËÀÂa-zéèêëàâ]{2,20})?)",
    re.IGNORECASE,
)
PATIENT_DATE_NAISSANCE = re.compile(
    r"n[ée]\s*(?:le\s*)?[:]\s*(\d{2}[/\-.]\d{2}[/\-.]\d{4})",
    re.IGNORECASE,
)
PATIENT_NUMERO_SECU = re.compile(
    r"\b([12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2})\b"
)

MEDECIN_NOM = re.compile(
    r"(?:dr\.?\s*|docteur\s*|médecin\s*[:]\s*)([A-ZÉÈÊËÀÂa-zéèêëàâ\s\-]{3,40})",
    re.IGNORECASE,
)
MEDECIN_RPPS = re.compile(
    r"(?:rpps|n°\s*rpps)\s*[:]\s*(\d{11})",
    re.IGNORECASE,
)

DATE_PRESCRIPTION = re.compile(
    r"(?:date\s*(?:de\s*)?prescription|prescrit\s*le|fait\s*le)\s*[:]\s*(\d{2}[/\-.]\d{2}[/\-.]\d{4})",
    re.IGNORECASE,
)
DATE_GENERIQUE = re.compile(
    r"\b(\d{2}[/\-.]\d{2}[/\-.]\d{4})\b"
)

DESTINATION = re.compile(
    r"(?:destination|établissement|vers|à\s*l['']?(?:hôpital|clinique|centre))\s*[:]\s*(.{5,80}?)(?:\n|$)",
    re.IGNORECASE,
)

TYPE_TRANSPORT = re.compile(
    r"\b(VSL|v\.s\.l\.|ambulance|TPMR|taxi)\b",
    re.IGNORECASE,
)

MOBILITE_PATTERNS = {
    "ASSIS": re.compile(
        r"\b(assis|position\s*assise|peut\s*marcher|valide)\b",
        re.IGNORECASE,
    ),
    "FAUTEUIL_ROULANT": re.compile(
        r"\b(fauteuil\s*roulant|fauteuil|FR\b|handicap[eé]\s*moteur)\b",
        re.IGNORECASE,
    ),
    "ALLONGE": re.compile(
        r"\b(allong[eé]|position\s*allong[eé]e|semi[\s\-]?allong[eé]|couché)\b",
        re.IGNORECASE,
    ),
    "CIVIERE": re.compile(
        r"\b(civi[eè]re|brancard|allonge\s*strict|position\s*allongée\s*strict)\b",
        re.IGNORECASE,
    ),
}

ALLER_RETOUR = re.compile(
    r"\b(aller[\s\-]retour|a/r|aller\s+et\s+retour)\b",
    re.IGNORECASE,
)
ALLER_SIMPLE = re.compile(
    r"\b(aller\s*simple|aller\s*uniquement|sens\s*unique)\b",
    re.IGNORECASE,
)

OXYGENE = re.compile(
    r"\b(oxyg[eè]ne|O2|oxygénoth[eé]rapie|concentrateur|bouteille\s*O2)\b",
    re.IGNORECASE,
)
BRANCARDAGE = re.compile(
    r"\b(brancardage|aide\s*au\s*brancardage|nécessite\s*(?:un\s*)?brancardier)\b",
    re.IGNORECASE,
)

MOTIFS = {
    "Dialyse": re.compile(r"\b(dialyse|h[eé]modialyse|séance\s*de\s*dialyse|rein\s*artificiel)\b", re.IGNORECASE),
    "Chimiothérapie": re.compile(r"\b(chimio(?:th[eé]rapie)?|traitement\s*anticancéreux|chimio)\b", re.IGNORECASE),
    "Radiothérapie": re.compile(r"\b(radioth[eé]rapie|ir?radiation|rayons)\b", re.IGNORECASE),
    "Consultation": re.compile(r"\b(consultation|rendez[\s\-]vous\s*médical|bilan)\b", re.IGNORECASE),
    "Hospitalisation": re.compile(r"\b(hospitalisation|admission|entrée\s*en\s*service)\b", re.IGNORECASE),
    "Sortie hospitalisation": re.compile(r"\b(sortie|retour\s*(?:au\s*)?domicile|sortie\s*d['\']?hospitalisation)\b", re.IGNORECASE),
    "Rééducation": re.compile(r"\b(r[eé][eé]ducation|kinésith[eé]rapie|SSR)\b", re.IGNORECASE),
}

FREQUENCE = re.compile(
    r"(\d+\s*(?:fois\s*)?(?:par|/)\s*(?:semaine|mois|jour)|hebdomadaire|quotidien|bi[\s\-]?hebdomadaire)",
    re.IGNORECASE,
)


# ════════════════════════════════════════════════════════════════════════════
# Fonctions d'extraction
# ════════════════════════════════════════════════════════════════════════════

def extraire_premier_match(pattern: re.Pattern, texte: str) -> Optional[str]:
    """Retourne le premier groupe capturé d'un pattern, ou None."""
    m = pattern.search(texte)
    if m:
        return m.group(1).strip()
    return None


def extraire_avec_fallback(patterns_cerfa: list, pattern_libre: re.Pattern, texte: str) -> Optional[str]:
    """
    Essaie les patterns CERFA dans l'ordre, puis le pattern libre en fallback.
    Retourne le premier match non-vide trouvé.
    """
    for pattern in patterns_cerfa:
        m = pattern.search(texte)
        if m:
            valeur = m.group(1).strip()
            if valeur and len(valeur) > 1:
                return valeur
    return extraire_premier_match(pattern_libre, texte)


def extraire_nom_patient(texte: str) -> Optional[str]:
    """Extrait le nom du patient — CERFA en priorité, puis format libre."""
    return extraire_avec_fallback(CERFA_PATIENT_NOM, PATIENT_NOM, texte)


def extraire_nom_medecin(texte: str) -> Optional[str]:
    """Extrait le nom du médecin prescripteur — CERFA en priorité."""
    return extraire_avec_fallback(CERFA_MEDECIN, MEDECIN_NOM, texte)


def extraire_rpps(texte: str) -> Optional[str]:
    """Extrait le numéro RPPS — CERFA en priorité."""
    for pattern in CERFA_RPPS:
        m = pattern.search(texte)
        if m:
            # Normaliser : supprimer espaces dans le numéro
            return re.sub(r"\s+", "", m.group(1))
    return extraire_premier_match(MEDECIN_RPPS, texte)


def extraire_date_naissance(texte: str) -> Optional[str]:
    """Extrait la date de naissance — CERFA en priorité."""
    for pattern in CERFA_DATE_NAISSANCE:
        m = pattern.search(texte)
        if m:
            valeur = m.group(1).strip()
            # Formatter DDMMYYYY → DD/MM/YYYY si nécessaire
            if re.match(r"^\d{8}$", valeur):
                return f"{valeur[:2]}/{valeur[2:4]}/{valeur[4:]}"
            return valeur
    return extraire_premier_match(PATIENT_DATE_NAISSANCE, texte)


def extraire_secu(texte: str) -> Optional[str]:
    """Extrait le numéro de sécurité sociale."""
    for pattern in CERFA_SECU:
        m = pattern.search(texte)
        if m:
            return m.group(1).strip()
    return extraire_premier_match(PATIENT_NUMERO_SECU, texte)


def extraire_adresse_depart(texte: str) -> Optional[str]:
    """Extrait l'adresse de départ depuis les patterns CERFA."""
    for pattern in CERFA_ADRESSE_DEPART:
        m = pattern.search(texte)
        if m:
            valeur = m.group(1).strip()
            if len(valeur) > 5:
                return valeur
    return None


def extraire_adresse_destination(texte: str) -> Optional[str]:
    """Extrait l'adresse de destination — CERFA en priorité, puis format libre."""
    for pattern in CERFA_ADRESSE_DESTINATION:
        m = pattern.search(texte)
        if m:
            valeur = m.group(1).strip()
            if len(valeur) > 5:
                return valeur
    return extraire_premier_match(DESTINATION, texte)


def extraire_mobilite(texte: str) -> tuple:
    """
    Détecte la mobilité du patient dans le texte OCR.

    Returns:
        (mobilite: str | None, confiance: float)
        La confiance est 1.0 si un seul match, 0.7 si ambigu.
    """
    trouvees = []
    for mobilite, pattern in MOBILITE_PATTERNS.items():
        if pattern.search(texte):
            trouvees.append(mobilite)

    if len(trouvees) == 1:
        return trouvees[0], 1.0
    elif len(trouvees) > 1:
        priorite = ["CIVIERE", "ALLONGE", "FAUTEUIL_ROULANT", "ASSIS"]
        for p in priorite:
            if p in trouvees:
                return p, 0.7
    return None, 0.0


def extraire_type_transport(texte: str) -> Optional[str]:
    """Détecte le type de transport autorisé dans la PMT."""
    mapping = {
        "vsl": "VSL",
        "v.s.l.": "VSL",
        "ambulance": "AMBULANCE",
        "tpmr": "TPMR",
        "taxi": "VSL",
    }
    m = TYPE_TRANSPORT.search(texte)
    if m:
        return mapping.get(m.group(1).lower(), m.group(1).upper())
    return None


def extraire_motif(texte: str) -> Optional[str]:
    """
    Détecte le motif médical — CERFA cases cochées en priorité,
    puis patterns libres.
    """
    # Patterns CERFA spécifiques d'abord
    for motif, pattern in MOTIFS_CERFA.items():
        if pattern.search(texte):
            return motif
    # Fallback patterns libres
    for motif, pattern in MOTIFS.items():
        if pattern.search(texte):
            return motif
    return None
