"""
BlancBleu — Patterns Regex pour extraction PMT
Prescription Médicale de Transport française

Adapté aux formulaires Cerfa n°10657*02 (PMT standard Assurance Maladie)
"""

import re
from typing import Optional


# ── Nom / Prénom patient ──────────────────────────────────────────────────────
# Formats : "NOM Prénom", "Nom : DUPONT", "Patient : Jean DUPONT"
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

# ── Médecin prescripteur ──────────────────────────────────────────────────────
MEDECIN_NOM = re.compile(
    r"(?:dr\.?\s*|docteur\s*|médecin\s*[:]\s*)([A-ZÉÈÊËÀÂa-zéèêëàâ\s\-]{3,40})",
    re.IGNORECASE,
)
MEDECIN_RPPS = re.compile(
    r"(?:rpps|n°\s*rpps)\s*[:]\s*(\d{11})",
    re.IGNORECASE,
)

# ── Date de prescription ──────────────────────────────────────────────────────
DATE_PRESCRIPTION = re.compile(
    r"(?:date\s*(?:de\s*)?prescription|prescrit\s*le|fait\s*le)\s*[:]\s*(\d{2}[/\-.]\d{2}[/\-.]\d{4})",
    re.IGNORECASE,
)
DATE_GENERIQUE = re.compile(
    r"\b(\d{2}[/\-.]\d{2}[/\-.]\d{4})\b"
)

# ── Destination ───────────────────────────────────────────────────────────────
DESTINATION = re.compile(
    r"(?:destination|établissement|vers|à\s*l['']?(?:hôpital|clinique|centre))\s*[:]\s*(.{5,80}?)(?:\n|$)",
    re.IGNORECASE,
)

# ── Type de transport autorisé ────────────────────────────────────────────────
TYPE_TRANSPORT = re.compile(
    r"\b(VSL|v\.s\.l\.|ambulance|TPMR|taxi)\b",
    re.IGNORECASE,
)

# ── Mobilité du patient ───────────────────────────────────────────────────────
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

# ── Aller-retour ──────────────────────────────────────────────────────────────
ALLER_RETOUR = re.compile(
    r"\b(aller[\s\-]retour|a/r|aller\s+et\s+retour)\b",
    re.IGNORECASE,
)
ALLER_SIMPLE = re.compile(
    r"\b(aller\s*simple|aller\s*uniquement|sens\s*unique)\b",
    re.IGNORECASE,
)

# ── Besoins spéciaux ──────────────────────────────────────────────────────────
OXYGENE = re.compile(
    r"\b(oxyg[eè]ne|O2|oxygénoth[eé]rapie|concentrateur|bouteille\s*O2)\b",
    re.IGNORECASE,
)
BRANCARDAGE = re.compile(
    r"\b(brancardage|aide\s*au\s*brancardage|nécessite\s*(?:un\s*)?brancardier)\b",
    re.IGNORECASE,
)

# ── Motif médical ─────────────────────────────────────────────────────────────
MOTIFS = {
    "Dialyse": re.compile(r"\b(dialyse|h[eé]modialyse|séance\s*de\s*dialyse|rein\s*artificiel)\b", re.IGNORECASE),
    "Chimiothérapie": re.compile(r"\b(chimio(?:th[eé]rapie)?|traitement\s*anticancéreux|chimio)\b", re.IGNORECASE),
    "Radiothérapie": re.compile(r"\b(radioth[eé]rapie|ir?radiation|rayons)\b", re.IGNORECASE),
    "Consultation": re.compile(r"\b(consultation|rendez[\s\-]vous\s*médical|bilan)\b", re.IGNORECASE),
    "Hospitalisation": re.compile(r"\b(hospitalisation|admission|entrée\s*en\s*service)\b", re.IGNORECASE),
    "Sortie hospitalisation": re.compile(r"\b(sortie|retour\s*(?:au\s*)?domicile|sortie\s*d['\']?hospitalisation)\b", re.IGNORECASE),
    "Rééducation": re.compile(r"\b(r[eé][eé]ducation|kinésith[eé]rapie|SSR)\b", re.IGNORECASE),
}

# ── Fréquence ─────────────────────────────────────────────────────────────────
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


def extraire_mobilite(texte: str) -> tuple[Optional[str], float]:
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
        # Priorité : CIVIERE > ALLONGE > FAUTEUIL_ROULANT > ASSIS
        priorite = ["CIVIERE", "ALLONGE", "FAUTEUIL_ROULANT", "ASSIS"]
        for p in priorite:
            if p in trouvees:
                return p, 0.7  # Confiance réduite car ambigu
    return None, 0.0


def extraire_type_transport(texte: str) -> Optional[str]:
    """Détecte le type de transport autorisé dans la PMT."""
    mapping = {
        "vsl": "VSL",
        "v.s.l.": "VSL",
        "ambulance": "AMBULANCE",
        "tpmr": "TPMR",
        "taxi": "VSL",  # Dans contexte médical, taxi → VSL
    }
    m = TYPE_TRANSPORT.search(texte)
    if m:
        return mapping.get(m.group(1).lower(), m.group(1).upper())
    return None


def extraire_motif(texte: str) -> Optional[str]:
    """Détecte le motif médical du transport."""
    for motif, pattern in MOTIFS.items():
        if pattern.search(texte):
            return motif
    return None
