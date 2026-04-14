"""
BlancBleu — Route FastAPI : Dispatch (recommandation véhicule/chauffeur)

POST /dispatch/recommend
  Analyse un transport et les véhicules/chauffeurs disponibles,
  puis retourne le meilleur choix avec justification.
"""

import logging
from fastapi import APIRouter, HTTPException

from services.dispatch_scorer import recommander
from schemas.dispatch_schemas import DispatchRequest, DispatchResponse

router = APIRouter()
logger = logging.getLogger("blancbleu.ai.dispatch.route")


@router.post(
    "/recommend",
    response_model=DispatchResponse,
    summary="Recommander un véhicule pour un transport",
    description="""
    Évalue tous les véhicules disponibles et recommande le plus adapté
    pour un transport donné, en tenant compte de :

    - La compatibilité mobilité patient ↔ type de véhicule
    - La disponibilité GPS du véhicule
    - La charge de travail journalière
    - La fiabilité/ponctualité historique

    **Règles de compatibilité :**
    - ASSIS → VSL (priorité), TPMR, AMBULANCE
    - FAUTEUIL_ROULANT → TPMR (obligatoire)
    - ALLONGE / CIVIERE → AMBULANCE (obligatoire)

    La réponse contient la recommandation principale + jusqu'à 3 alternatives.
    """,
)
async def recommend_dispatch(body: DispatchRequest) -> DispatchResponse:
    """
    Recommandation de dispatch basée sur le scoring métier.

    Exemple de payload :
    ```json
    {
      "transport": {
        "_id": "abc123",
        "motif": "Dialyse",
        "mobilite": "ASSIS",
        "adresseDepart": "12 rue Victor Hugo, Nice",
        "adresseDestination": "Centre de dialyse Saint-Roch, Nice",
        "oxygene": false,
        "brancardage": false
      },
      "vehicules": [
        {
          "_id": "v1",
          "immatriculation": "AB-123-CD",
          "type": "VSL",
          "statut": "disponible",
          "position": { "lat": 43.71, "lng": 7.26 },
          "capacites": { "fauteuil": false, "oxygene": false, "brancard": false }
        }
      ],
      "chauffeurs": []
    }
    ```
    """
    if not body.vehicules:
        raise HTTPException(
            status_code=422,
            detail="La liste des véhicules candidats est vide",
        )

    try:
        result = recommander(body)
        return result
    except Exception as e:
        logger.error(f"Erreur scoring dispatch : {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
