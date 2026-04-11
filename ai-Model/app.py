"""
BlancBleu - API Flask du modele IA de triage
Port : 5001
Appelee par Express Node.js

Lancement production :
    gunicorn -w 2 -b 0.0.0.0:5001 app:app

Lancement developpement :
    python app.py
"""

import os
import json
import logging
import numpy as np
import joblib
from flask import Flask, request, jsonify
from flask_cors import CORS

# ─── Configuration logging ────────────────────────────────────────────────────
# Remplace les print() par un logger structuré
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("blancbleu.ia")

# ─── Application ─────────────────────────────────────────────────────────────
app = Flask(__name__)

# CORS restreint — accepte uniquement l'origine du backend Node.js
# En production, remplacer par l'URL réelle du serveur Node
ALLOWED_ORIGIN = os.environ.get("NODE_ORIGIN", "http://localhost:5000")
CORS(app, origins=[ALLOWED_ORIGIN])

# ─── Limite de taille des requêtes (10 Ko) ────────────────────────────────────
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024

model = None
meta  = None

# ─── Mappings ─────────────────────────────────────────────────────────────────
CHIEF_MAP = {
    "chest":       3, "cardiac":    0, "heart":      0,
    "dyspnea":     2, "breath":     2, "respiratory": 2,
    "stroke":      1, "neuro":      1, "seizure":    1,
    "trauma":      4, "injury":     4, "accident":   5,
    "vehicle":     5, "fall":       10, "burn":       9,
    "poison":      6, "overdose":   6, "obstetric":  7,
    "labor":       7, "abdominal":  8, "fever":      8,
    "syncope":     8,
}

TYPE_FR_EN = {
    "Arret cardiaque":       "cardiac arrest",
    "Arrêt cardiaque":       "cardiac arrest",
    "AVC":                   "stroke",
    "Detresse respiratoire": "dyspnea",
    "Détresse respiratoire": "dyspnea",
    "Douleur thoracique":    "chest pain",
    "Traumatisme grave":     "trauma",
    "Accident de la route":  "accident vehicle",
    "Intoxication":          "poison overdose",
    "Accouchement":          "obstetric labor",
    "Malaise":               "abdominal syncope",
    "Brulure":               "burn",
    "Brûlure":               "burn",
    "Chute":                 "fall",
    "Autre":                 "other",
}

# ─── Chargement du modèle ─────────────────────────────────────────────────────
def charger():
    global model, meta
    model_path = os.path.join(os.path.dirname(__file__), "model", "triage_model.pkl")
    meta_path  = os.path.join(os.path.dirname(__file__), "model", "metadata.json")

    if not os.path.exists(model_path):
        logger.error("model/triage_model.pkl introuvable — lance : python train_model.py data.csv")
        return False

    model = joblib.load(model_path)
    with open(meta_path, encoding="utf-8") as f:
        meta = json.load(f)

    logger.info("Modele charge — precision : %s%%", meta.get("accuracy"))
    return True


# ─── Helpers de vectorisation ─────────────────────────────────────────────────
def mapper_chief(type_incident):
    en = TYPE_FR_EN.get(type_incident, type_incident.lower())
    for k, idx in CHIEF_MAP.items():
        if k in en.lower():
            return idx
    return 11


def mapper_mental(etat):
    return {"critique": 4, "inconscient": 3, "conscient": 1, "stable": 1, "inconnu": 2}.get(etat, 1)


def vectoriser(data):
    age      = float(data.get("age", 40) or 40)
    nrs      = float(data.get("nrsPain", data.get("nrs_pain", 0)) or 0)
    pts_h    = float(data.get("patientsPerHour", data.get("pts_hour", 5)) or 5)
    pain_bin = int(data.get("pain", 1 if nrs > 0 else 0) or 0)
    injury   = 1 if data.get("injury", False) else 0

    arr_mode_str = str(data.get("arrivalMode", "walk")).lower()
    if arr_mode_str == "ambulance":
        arrival_mode = 2
    elif arr_mode_str == "transfer":
        arrival_mode = 3
    else:
        arrival_mode = 1

    etat   = data.get("etatPatient", "conscient") or "conscient"
    mental = mapper_mental(etat.lower())
    chief  = mapper_chief(data.get("typeIncident", "Autre"))

    return np.array([[chief, age, pts_h, arrival_mode, injury, mental, pain_bin, nrs]])


def regles_expertes(data, prediction_ml, proba_ml):
    type_inc = TYPE_FR_EN.get(
        data.get("typeIncident", ""), data.get("typeIncident", "")
    ).lower()
    etat    = (data.get("etatPatient") or "inconnu").lower()
    nrs     = float(data.get("nrsPain") or 0)
    arr     = str(data.get("arrivalMode") or "walk").lower()
    nb_vic  = int(data.get("nbVictimes") or 1)

    raisons_p1, raisons_p2 = [], []

    # Règles P1
    if "cardiac arrest" in type_inc:
        raisons_p1.append("Arrêt cardiaque → P1 absolu")
    if etat == "inconscient" and arr == "ambulance":
        raisons_p1.append("Patient inconscient + ambulance → P1")
    if "dyspnea" in type_inc and etat == "inconscient":
        raisons_p1.append("Détresse respiratoire + inconscient → P1")
    if nb_vic >= 3:
        raisons_p1.append(f"{nb_vic} victimes → activation plan NOVI → P1")

    # Règles P2 (si ML dit P3)
    if prediction_ml == "P3":
        if etat == "inconscient":
            raisons_p2.append("Patient inconscient → minimum P2")
        if nrs >= 8:
            raisons_p2.append(f"Douleur intense NRS={nrs:.0f}/10 → minimum P2")
        if any(k in type_inc for k in ["accident", "trauma"]) and arr == "ambulance":
            raisons_p2.append("Traumatisme + ambulance → minimum P2")
        if any(k in type_inc for k in ["avc", "stroke"]) and etat != "stable":
            raisons_p2.append("AVC → minimum P2")

    if raisons_p1:
        return {
            "priorite":    "P1",
            "surcharge":   True,
            "raison":      raisons_p1[0],
            "probabilites": {"P1": 95.0, "P2": 4.0, "P3": 1.0},
            "confiance":   95.0,
        }
    if raisons_p2:
        return {
            "priorite":    "P2",
            "surcharge":   True,
            "raison":      raisons_p2[0],
            "probabilites": {
                "P1": round(proba_ml.get("P1", 10), 1),
                "P2": 75.0,
                "P3": round(proba_ml.get("P3", 15), 1),
            },
            "confiance":   75.0,
        }
    return None


# ─── Routes ───────────────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":   "ok",
        "loaded":   model is not None,
        "accuracy": meta.get("accuracy") if meta else None,
        "version":  meta.get("version", "3.0") if meta else None,
    })


@app.route("/predict", methods=["POST"])
def predict():
    if not model:
        return jsonify({"error": "Modele non charge — lance python train_model.py data_clean.csv"}), 503
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Donnees manquantes ou Content-Type invalide"}), 400

        # Valider les champs obligatoires
        if not data.get("typeIncident") or not data.get("etatPatient"):
            return jsonify({"error": "typeIncident et etatPatient sont requis"}), 400

        X    = vectoriser(data)
        pri  = model.predict(X)[0]
        prob = model.predict_proba(X)[0]
        conf = round(float(max(prob)) * 100, 1)
        proba_dict = {c: round(float(p) * 100, 1) for c, p in zip(model.classes_, prob)}

        surcharge = regles_expertes(data, pri, proba_dict)
        if surcharge:
            pri        = surcharge["priorite"]
            conf       = surcharge["confiance"]
            proba_dict = surcharge["probabilites"]
            source_str = f"ML + Règle experte : {surcharge['raison']}"
        else:
            source_str = f"GradientBoosting BlancBleu v{meta.get('version', '3.0')}"

        score_map = {
            "P1": min(99, int(80 + proba_dict.get("P1", 90) * 0.19)),
            "P2": min(79, int(55 + proba_dict.get("P2", 65) * 0.24)),
            "P3": max(10, int(10 + proba_dict.get("P3", 35) * 0.45)),
        }

        unite = {"P1": "SMUR", "P2": "VSAV", "P3": "VSL"}.get(pri, "VSAV")

        justif = {
            "P1": [
                f"Incident critique : {data.get('typeIncident', '')} — patient {data.get('etatPatient', '')}.",
                surcharge["raison"] if surcharge else f"Probabilité P1 : {proba_dict.get('P1', 0)}%",
                "Intervention IMMÉDIATE requise — déploiement SMUR.",
                f"Confiance système hybride : {conf}%",
            ],
            "P2": [
                f"Situation urgente : {data.get('typeIncident', '')}.",
                surcharge["raison"] if surcharge else f"Probabilité P2 : {proba_dict.get('P2', 0)}%",
                "Déploiement VSAV recommandé dans les 8 minutes.",
                f"Confiance système hybride : {conf}%",
            ],
            "P3": [
                f"Situation non critique : {data.get('typeIncident', '')}.",
                f"Probabilité P3 : {proba_dict.get('P3', 0)}% — aucune règle critique déclenchée.",
                "Transport standard (VSL ou VSAV disponible).",
                f"Confiance ML : {conf}%",
            ],
        }

        logger.info("Prediction : %s (conf %.1f%%) — %s", pri, conf, data.get("typeIncident"))

        return jsonify({
            "priorite":         pri,
            "score":            score_map[pri],
            "confiance":        conf,
            "probabilites":     proba_dict,
            "uniteRecommandee": unite,
            "justification":    justif[pri],
            "modele":           source_str,
            "source":           "ml",
            "surcharge":        surcharge is not None,
        })

    except Exception as e:
        logger.exception("Erreur /predict")
        return jsonify({"error": str(e)}), 500


@app.route("/features", methods=["GET"])
def features():
    if not meta:
        return jsonify({"error": "Modele non charge"}), 503
    return jsonify({
        "typeIncidents": meta.get("type_incidents", []),
        "etatsPatient":  ["critique", "inconscient", "conscient", "stable", "inconnu"],
        "accuracy":      meta.get("accuracy"),
    })


# ─── Gestionnaire d'erreur global ─────────────────────────────────────────────
@app.errorhandler(413)
def request_too_large(e):
    return jsonify({"error": "Requête trop volumineuse (max 10 Ko)"}), 413


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Méthode non autorisée"}), 405


# ─── Point d'entrée développement uniquement ─────────────────────────────────
# En production : gunicorn -w 2 -b 0.0.0.0:5001 app:app
if __name__ == "__main__":
    logger.info("BlancBleu API IA — démarrage développement sur port 5001")
    if charger():
        logger.info("API disponible sur http://localhost:5001")
        # debug=False même en dev — utiliser les logs pour le débogage
        app.run(host="0.0.0.0", port=5001, debug=False)
    else:
        logger.error("Echec chargement modele. Lance d'abord : python train_model.py data.csv")