"""
BlancBleu — Route FastAPI : Optimisation de Tournée (VRP)

POST /routing/optimize
  Optimise les tournées d'une journée pour plusieurs véhicules.
  Utilise Google OR-Tools (Vehicle Routing Problem).
"""

import logging
from fastapi import APIRouter, HTTPException

from services.route_optimizer import optimiser_tournee
from schemas.routing_schemas import RoutingRequest, RoutingResponse

router = APIRouter()
logger = logging.getLogger("blancbleu.ai.routing.route")


@router.post(
    "/optimize",
    response_model=RoutingResponse,
    summary="Optimiser les tournées d'une journée",
    description="""
    Résout un problème de tournées de véhicules (VRP) pour une journée de transports.

    **Objectif :** minimiser la distance totale parcourue par l'ensemble des véhicules
    tout en couvrant tous les transports planifiés.

    **Contraintes prises en compte :**
    - Chaque transport = 1 prise en charge + 1 dépose
    - Un véhicule transporte 1 patient à la fois
    - Tous les véhicules partent et reviennent au dépôt (garage)

    **Algorithme :** Google OR-Tools — Guided Local Search, 30s max de calcul.
    Fallback automatique vers attribution séquentielle si OR-Tools indisponible.

    **Exemple de payload :**
    ```json
    {
      "date": "2024-03-15",
      "depot": { "lat": 43.7102, "lng": 7.2620 },
      "transports": [
        {
          "_id": "t1",
          "numero": "TRS-20240315-0001",
          "adresseDepart": "12 rue Hugo, Nice",
          "adresseDestination": "Hôpital Pasteur, Nice",
          "heureDepart": "08:00",
          "mobilite": "ASSIS",
          "typeTransport": "VSL",
          "dureeEstimee": 25
        }
      ],
      "vehicules": [
        {
          "_id": "v1",
          "immatriculation": "AB-123-CD",
          "type": "VSL",
          "position": { "lat": 43.71, "lng": 7.26 }
        }
      ]
    }
    ```
    """,
)
async def optimize_routing(body: RoutingRequest) -> RoutingResponse:
    """Optimise les tournées avec OR-Tools VRP."""
    if not body.vehicules:
        raise HTTPException(status_code=422, detail="Aucun véhicule disponible")

    if len(body.transports) > 100:
        raise HTTPException(
            status_code=422,
            detail="Maximum 100 transports par optimisation. Découpez par plage horaire.",
        )

    try:
        result = optimiser_tournee(body)
        return result
    except Exception as e:
        logger.error(f"Erreur optimisation tournée : {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
