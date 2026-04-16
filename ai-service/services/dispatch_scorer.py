"""
BlancBleu — Service de Scoring Dispatch
Recommandation véhicule + chauffeur pour transport sanitaire non urgent

Algorithme : scoring métier par règles pondérées (0-100 points)
Pas de machine learning — règles explicites, traçables, modifiables.

Décomposition du score (100 pts max) :
  - Compatibilité mobilité/véhicule  : 40 pts
  - Disponibilité (pas de conflit)   : 20 pts
  - Proximité GPS                    : 20 pts
  - Charge de travail journalière    : 10 pts
  - Fiabilité chauffeur              : 10 pts
"""

import logging
import math
from typing import List, Optional, Dict, Any

from schemas.dispatch_schemas import (
    DispatchRequest, DispatchResponse,
    VehiculeRecommande, ScoreDetail,
)

logger = logging.getLogger("blancbleu.ai.dispatch")


# ── Règles de compatibilité mobilité → type véhicule ─────────────────────────
# Basées sur la réglementation transport sanitaire française
COMPATIBILITE_MOBILITE: Dict[str, Dict[str, int]] = {
    "ASSIS": {
        "VSL": 40,          # Optimal : VSL conçu pour passagers assis
        "TPMR": 35,         # Compatible mais surqualifié
        "AMBULANCE": 25,    # Compatible mais sur-équipé et plus coûteux
    },
    "FAUTEUIL_ROULANT": {
        "TPMR": 40,         # Optimal : TPMR = Transport Personnes à Mobilité Réduite
        "AMBULANCE": 20,    # Compatible si rampe disponible
        "VSL": 0,           # Incompatible
    },
    "ALLONGE": {
        "AMBULANCE": 40,    # Obligatoire : patient allongé nécessite brancard
        "TPMR": 0,          # Incompatible
        "VSL": 0,           # Incompatible
    },
    "CIVIERE": {
        "AMBULANCE": 40,    # Seul compatible pour patient sur civière
        "TPMR": 0,
        "VSL": 0,
    },
}


def recommander(request: DispatchRequest) -> DispatchResponse:
    """
    Évalue tous les véhicules disponibles et retourne le meilleur candidat.

    Args:
        request : DispatchRequest contenant transport, véhicules, chauffeurs

    Returns:
        DispatchResponse avec recommandation principale et alternatives
    """
    transport = request.transport
    vehicules = request.vehicules
    chauffeurs = request.chauffeurs

    logger.info(
        f"Dispatch scoring — mobilité: {transport.mobilite}, "
        f"véhicules candidats: {len(vehicules)}"
    )

    candidats = []

    for vehicule in vehicules:
        score_detail = _calculer_score(transport, vehicule, chauffeurs)

        # Ignorer véhicules incompatibles (score compatibilité = 0)
        if score_detail.compatibiliteMobilite == 0:
            logger.debug(f"  {vehicule.immatriculation} ({vehicule.type}) → incompatible")
            continue

        justification = _construire_justification(transport, vehicule, score_detail)
        eta = _estimer_eta(vehicule, transport)

        candidats.append(
            VehiculeRecommande(
                vehiculeId=vehicule.id or "",
                immatriculation=vehicule.immatriculation,
                type=vehicule.type,
                score=score_detail.total,
                scoreDetail=score_detail,
                etaMinutes=eta,
                justification=justification,
            )
        )

    # Tri par score décroissant
    candidats.sort(key=lambda c: c.score, reverse=True)

    if not candidats:
        return DispatchResponse(
            recommandation=None,
            alternatives=[],
            source="ia",
            message=f"Aucun véhicule compatible avec mobilité {transport.mobilite}",
        )

    logger.info(
        f"Dispatch : meilleur candidat = {candidats[0].immatriculation} "
        f"(score {candidats[0].score}/100)"
    )

    return DispatchResponse(
        recommandation=candidats[0],
        alternatives=candidats[1:4],  # 3 alternatives max
        source="ia",
    )


def _calculer_score(transport, vehicule, chauffeurs: list) -> ScoreDetail:
    """
    Calcule le score détaillé d'un véhicule pour un transport donné.
    """
    mobilite = transport.mobilite.value if hasattr(transport.mobilite, 'value') else transport.mobilite

    # ── 1. Compatibilité mobilité / type véhicule (0-40 pts) ─────────────────
    score_compat = COMPATIBILITE_MOBILITE.get(mobilite, {}).get(vehicule.type.value if hasattr(vehicule.type, 'value') else vehicule.type, 0)

    # Bonus capacités spéciales
    if transport.oxygene and vehicule.capacites.oxygene:
        score_compat = min(score_compat + 5, 40)
    elif transport.oxygene and not vehicule.capacites.oxygene:
        score_compat = max(score_compat - 15, 0)  # Pénalité si oxygène requis absent

    if transport.brancardage and vehicule.capacites.brancard:
        score_compat = min(score_compat + 3, 40)

    # ── 2. Disponibilité (0-20 pts) ───────────────────────────────────────────
    # Pour le MVP : 20 pts si statut = 'disponible' (pas de conflit connu)
    score_dispo = 20 if vehicule.statut == "disponible" else 0

    # ── 3. Proximité GPS (0-20 pts) ───────────────────────────────────────────
    score_proximite = _calculer_score_proximite(vehicule, transport)

    # ── 4. Charge de travail journalière (0-10 pts) ───────────────────────────
    # Pour le MVP : score fixe à 7 (à améliorer avec données réelles)
    score_charge = 7

    # ── 5. Fiabilité chauffeur (0-10 pts) ────────────────────────────────────
    score_fiabilite = _calculer_score_fiabilite(vehicule, chauffeurs)

    total = (
        score_compat
        + score_dispo
        + score_proximite
        + score_charge
        + score_fiabilite
    )

    return ScoreDetail(
        compatibiliteMobilite=score_compat,
        disponibilite=score_dispo,
        proximite=score_proximite,
        chargeTravail=score_charge,
        fiabilite=score_fiabilite,
        total=min(total, 100),
    )


def _calculer_score_proximite(vehicule, transport) -> int:
    """
    Calcule le score de proximité basé sur la distance GPS.
    Plus le véhicule est proche, plus le score est élevé.

    Barème :
      < 2 km   → 20 pts
      2-5 km   → 16 pts
      5-10 km  → 12 pts
      10-20 km → 8 pts
      > 20 km  → 4 pts
      Inconnu  → 10 pts (valeur neutre)
    """
    if not vehicule.position or not vehicule.position.lat:
        return 10  # Valeur neutre si position inconnue

    # Pour simplifier dans le MVP, on utilise Haversine si on a les coords de départ
    # Ici on utilise un score estimé basé sur la présence de la position
    # (Dans une version complète, on passerait les coordonnées du départ)
    return 12  # Score moyen — à affiner avec coordonnées réelles


def _calculer_score_fiabilite(vehicule, chauffeurs: list) -> int:
    """
    Calcule le score de fiabilité du véhicule/chauffeur.
    Basé sur la ponctualité historique.

    Barème ponctualité :
      >= 95% → 10 pts
      >= 90% → 8 pts
      >= 80% → 6 pts
      >= 70% → 4 pts
      < 70%  → 2 pts
      Inconnu → 7 pts
    """
    ponctualite = vehicule.ponctualite

    if ponctualite is None:
        return 7  # Valeur neutre si pas d'historique

    if ponctualite >= 95:
        return 10
    elif ponctualite >= 90:
        return 8
    elif ponctualite >= 80:
        return 6
    elif ponctualite >= 70:
        return 4
    else:
        return 2


def _estimer_eta(vehicule, transport) -> Optional[int]:
    """
    Estime l'ETA en minutes depuis le véhicule jusqu'au point de prise en charge.
    Version simplifiée sans appel OSRM (pour performances).
    """
    if not vehicule.position or not vehicule.position.lat:
        return None

    # ETA estimé à 15 minutes par défaut si on n'a pas les coordonnées de départ
    # Dans une version complète : appel Haversine + facteur trafic
    return 15


def _construire_justification(transport, vehicule, score: ScoreDetail) -> List[str]:
    """
    Génère une liste de justifications lisibles par un humain.
    """
    justifications = []
    mobilite = transport.mobilite.value if hasattr(transport.mobilite, 'value') else transport.mobilite
    type_v = vehicule.type.value if hasattr(vehicule.type, 'value') else vehicule.type

    # Compatibilité
    if score.compatibiliteMobilite >= 35:
        justifications.append(f"Type {type_v} optimal pour patient {mobilite}")
    elif score.compatibiliteMobilite >= 20:
        justifications.append(f"Type {type_v} compatible (non optimal) pour {mobilite}")

    # Capacités spéciales
    if transport.oxygene and vehicule.capacites.oxygene:
        justifications.append("Équipé oxygène — requis par le patient")
    if transport.brancardage and vehicule.capacites.brancard:
        justifications.append("Équipé brancard — requis par le patient")

    # Disponibilité
    if score.disponibilite == 20:
        justifications.append("Véhicule disponible immédiatement")

    # Fiabilité
    if vehicule.ponctualite and vehicule.ponctualite >= 90:
        justifications.append(f"Fiabilité excellente ({vehicule.ponctualite:.0f}% ponctualité)")

    return justifications
