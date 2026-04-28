"""
BlancBleu — Route FastAPI : Optimizer (prédiction durée + optimisation temps réel)

Endpoints :
  POST   /predict/duree          → prédiction ML de durée
  POST   /optimize/realtime      → optimisation VRP temps réel
  GET    /model/metrics           → benchmark des modèles
  GET    /optimizer/stats         → état du système
  POST   /model/train             → lancement de l'entraînement
  GET    /model/shap/{transport_id} → explication SHAP
"""

import json
import logging
from fastapi import APIRouter, HTTPException, Request

from schemas.optimizer_schemas import TransportInput, OptimisationInput

router = APIRouter()
logger = logging.getLogger("blancbleu.ai.optimizer.route")


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_predictor(request: Request):
    predictor = getattr(request.app.state, "predictor", None)
    if predictor is None or predictor.model is None:
        raise HTTPException(
            status_code=503,
            detail="Modèle non entraîné — POST /optimizer/model/train",
        )
    return predictor


def _get_optimizer(request: Request):
    opt = getattr(request.app.state, "optimizer", None)
    if opt is None:
        raise HTTPException(status_code=503, detail="Optimiseur non initialisé")
    return opt


# ─── POST /predict/duree ─────────────────────────────────────────────────────

@router.post(
    "/predict/duree",
    summary="Prédire la durée d'un transport",
    description="Utilise le modèle ML (XGBoost/RF) pour estimer la durée du transport.",
)
async def predict_duree(body: TransportInput, request: Request):
    predictor = _get_predictor(request)
    try:
        result = predictor.predict(body.model_dump())
        return result
    except Exception as e:
        logger.error(f"Erreur prédiction durée : {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ─── POST /optimize/realtime ─────────────────────────────────────────────────

@router.post(
    "/optimize/realtime",
    summary="Optimisation temps réel de la tournée",
    description="Ré-optimise l'ensemble des transports en attente à chaque nouvelle demande.",
)
async def optimize_realtime(body: OptimisationInput, request: Request):
    optimizer = _get_optimizer(request)
    try:
        result = optimizer.nouvelle_demande(body.transport, body.vehicules)
        return result
    except Exception as e:
        logger.error(f"Erreur optimisation : {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ─── GET /model/metrics ──────────────────────────────────────────────────────

@router.get(
    "/model/metrics",
    summary="Métriques du modèle entraîné",
)
async def get_metrics(request: Request):
    predictor = getattr(request.app.state, "predictor", None)
    if predictor is None:
        return {"status": "Modèle non entraîné", "action": "POST /optimizer/model/train"}

    metrics_path = predictor.metrics_path
    if not metrics_path.exists():
        return {"status": "Modèle non entraîné", "action": "POST /optimizer/model/train"}

    try:
        with open(metrics_path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── GET /optimizer/stats ────────────────────────────────────────────────────

@router.get(
    "/optimizer/stats",
    summary="État courant de l'optimiseur",
)
async def get_stats(request: Request):
    optimizer = _get_optimizer(request)
    return optimizer.get_stats()


# ─── POST /model/train ───────────────────────────────────────────────────────

@router.post(
    "/model/train",
    summary="Entraîner le modèle ML",
    description="Génère le dataset synthétique, benchmark 3 modèles, sauvegarde le meilleur.",
)
async def train_model(request: Request):
    predictor = getattr(request.app.state, "predictor", None)
    if predictor is None:
        raise HTTPException(status_code=503, detail="Optimiseur non initialisé")

    try:
        from data.generate_dataset import generer_dataset, preprocess
        logger.info("Génération dataset 1500 transports...")
        df = generer_dataset(n=1500)
        df_processed = preprocess(df)
        logger.info("Entraînement en cours...")
        metrics = predictor.train(df_processed)
        return {"status": "ok", "metrics": metrics}
    except Exception as e:
        logger.error(f"Erreur entraînement : {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ─── GET /model/shap/{transport_id} ─────────────────────────────────────────

@router.get(
    "/model/shap/{transport_id}",
    summary="Explication SHAP d'une prédiction",
)
async def get_shap(transport_id: str, request: Request):
    predictor = _get_predictor(request)
    try:
        # Exemple générique si transport_id non trouvé
        exemple = {
            "distance_km":          12.5,
            "heure_depart":         8,
            "jour_semaine":         0,
            "mobilite":             "ASSIS",
            "type_vehicule":        "VSL",
            "type_etablissement":   "hopital_public",
            "motif":                "Consultation",
            "aller_retour":         False,
            "nb_patients":          1,
            "experience_chauffeur": 0.7,
        }
        result = predictor.predict(exemple)
        return {
            "transport_id": transport_id,
            "note":         "Exemple générique (transport_id non résolu)",
            "prediction":   result,
        }
    except Exception as e:
        logger.error(f"Erreur SHAP : {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
