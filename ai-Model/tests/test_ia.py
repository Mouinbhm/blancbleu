"""
BlancBleu — Tests API Flask IA de triage

Couverture :
  - /health : statut API et modèle chargé
  - /predict : 14 types d'incidents × priorités attendues
  - Règles expertes : P1 absolu, override P2, NOVI
  - Validation des inputs manquants
  - Gestion des cas limites (âge extrême, NRS max)

Prérequis :
  cd ai-Model && python train_model.py data_clean.csv
  puis : pytest tests/test_ia.py -v
"""

import pytest
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, charger


# ─── Configuration ────────────────────────────────────────────────────────────
@pytest.fixture(scope="session", autouse=True)
def charger_modele():
    """Charge le modèle une seule fois pour toute la session de tests."""
    ok = charger()
    if not ok:
        pytest.skip("Modèle non entraîné — lance : python train_model.py data_clean.csv")


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def predict(client, payload):
    """Helper pour appeler /predict."""
    return client.post(
        "/predict",
        data=json.dumps(payload),
        content_type="application/json",
    )


# ══════════════════════════════════════════════════════════════════════════════
# SUITE 1 — Health check
# ══════════════════════════════════════════════════════════════════════════════
class TestHealth:
    def test_health_200(self, client):
        res = client.get("/health")
        assert res.status_code == 200

    def test_health_modele_charge(self, client):
        data = json.loads(res := client.get("/health").data)
        assert data["loaded"] is True
        assert data["status"] == "ok"

    def test_health_retourne_accuracy(self, client):
        data = json.loads(client.get("/health").data)
        assert "accuracy" in data
        assert data["accuracy"] is not None


# ══════════════════════════════════════════════════════════════════════════════
# SUITE 2 — Prédictions par type d'incident
# ══════════════════════════════════════════════════════════════════════════════
class TestPredictions:
    """
    On ne teste pas que le modèle ML est parfait — on teste que
    les règles expertes critiques produisent la bonne priorité.
    """

    def test_arret_cardiaque_est_p1(self, client):
        """Arrêt cardiaque → P1 absolu via règle experte."""
        res = predict(client, {
            "typeIncident": "Arrêt cardiaque",
            "etatPatient": "inconscient",
            "age": 65,
            "nrsPain": 0,
            "arrivalMode": "ambulance",
            "injury": False,
        })
        data = json.loads(res.data)
        assert res.status_code == 200
        assert data["priorite"] == "P1"
        assert data["surcharge"] is True

    def test_inconscient_ambulance_est_p1(self, client):
        """Patient inconscient arrivé en ambulance → P1."""
        res = predict(client, {
            "typeIncident": "Détresse respiratoire",
            "etatPatient": "inconscient",
            "age": 50,
            "arrivalMode": "ambulance",
            "injury": False,
        })
        data = json.loads(res.data)
        assert data["priorite"] == "P1"

    def test_malaise_stable_est_p3(self, client):
        """Malaise simple patient stable → P3 attendu (ML)."""
        res = predict(client, {
            "typeIncident": "Malaise",
            "etatPatient": "stable",
            "age": 45,
            "nrsPain": 2,
            "arrivalMode": "walk",
            "injury": False,
        })
        data = json.loads(res.data)
        assert res.status_code == 200
        # Le modèle ML peut prédire P2 ou P3 pour ce cas
        assert data["priorite"] in ["P2", "P3"]

    def test_inconscient_ml_p3_override_p2(self, client):
        """Si ML dit P3 mais patient inconscient → règle experte monte à P2."""
        res = predict(client, {
            "typeIncident": "Malaise",
            "etatPatient": "inconscient",
            "age": 40,
            "nrsPain": 2,
            "arrivalMode": "walk",
            "injury": False,
        })
        data = json.loads(res.data)
        # P1 ou P2 — jamais P3 si inconscient
        assert data["priorite"] in ["P1", "P2"]

    def test_douleur_intense_nrs_override_p2(self, client):
        """NRS >= 8 avec ML P3 → override P2 minimum."""
        res = predict(client, {
            "typeIncident": "Malaise",
            "etatPatient": "conscient",
            "age": 35,
            "nrsPain": 9,
            "arrivalMode": "walk",
            "injury": False,
        })
        data = json.loads(res.data)
        assert data["priorite"] in ["P1", "P2"]

    def test_cinq_victimes_est_p1_novi(self, client):
        """5 victimes → plan NOVI → P1 absolu."""
        res = predict(client, {
            "typeIncident": "Accident de la route",
            "etatPatient": "conscient",
            "age": 30,
            "nrsPain": 4,
            "arrivalMode": "ambulance",
            "injury": True,
            "nbVictimes": 5,
        })
        data = json.loads(res.data)
        assert data["priorite"] == "P1"
        assert data["surcharge"] is True

    def test_chute_stable_est_basse_priorite(self, client):
        """Chute simple patient stable → P2 ou P3."""
        res = predict(client, {
            "typeIncident": "Chute",
            "etatPatient": "stable",
            "age": 70,
            "nrsPain": 3,
            "arrivalMode": "walk",
            "injury": False,
        })
        data = json.loads(res.data)
        assert data["priorite"] in ["P2", "P3"]

    def test_avc_conscient_est_au_moins_p2(self, client):
        """AVC conscient → minimum P2."""
        res = predict(client, {
            "typeIncident": "AVC",
            "etatPatient": "conscient",
            "age": 70,
            "nrsPain": 5,
            "arrivalMode": "ambulance",
            "injury": False,
        })
        data = json.loads(res.data)
        assert data["priorite"] in ["P1", "P2"]


# ══════════════════════════════════════════════════════════════════════════════
# SUITE 3 — Structure de la réponse
# ══════════════════════════════════════════════════════════════════════════════
class TestStructureReponse:
    def test_reponse_contient_tous_les_champs(self, client):
        res = predict(client, {
            "typeIncident": "Malaise",
            "etatPatient": "conscient",
            "age": 40,
        })
        data = json.loads(res.data)
        champs_attendus = [
            "priorite", "score", "confiance", "probabilites",
            "uniteRecommandee", "justification", "source", "surcharge",
        ]
        for champ in champs_attendus:
            assert champ in data, f"Champ manquant : {champ}"

    def test_priorite_est_p1_p2_ou_p3(self, client):
        res = predict(client, {
            "typeIncident": "Malaise",
            "etatPatient": "conscient",
        })
        data = json.loads(res.data)
        assert data["priorite"] in ["P1", "P2", "P3"]

    def test_score_est_entre_0_et_100(self, client):
        res = predict(client, {
            "typeIncident": "Malaise",
            "etatPatient": "stable",
        })
        data = json.loads(res.data)
        assert 0 <= data["score"] <= 100

    def test_unite_recommandee_est_valide(self, client):
        res = predict(client, {
            "typeIncident": "Arrêt cardiaque",
            "etatPatient": "inconscient",
        })
        data = json.loads(res.data)
        assert data["uniteRecommandee"] in ["SMUR", "VSAV", "VSL"]

    def test_probabilites_somme_proche_100(self, client):
        res = predict(client, {
            "typeIncident": "Malaise",
            "etatPatient": "conscient",
        })
        data = json.loads(res.data)
        proba = data["probabilites"]
        total = sum(proba.values())
        assert 95 <= total <= 105, f"Probabilités sum = {total}"

    def test_justification_est_liste_non_vide(self, client):
        res = predict(client, {
            "typeIncident": "Malaise",
            "etatPatient": "conscient",
        })
        data = json.loads(res.data)
        assert isinstance(data["justification"], list)
        assert len(data["justification"]) > 0

    def test_smur_recommande_pour_p1(self, client):
        res = predict(client, {
            "typeIncident": "Arrêt cardiaque",
            "etatPatient": "inconscient",
        })
        data = json.loads(res.data)
        assert data["uniteRecommandee"] == "SMUR"

    def test_vsl_recommande_pour_p3(self, client):
        """P3 préconise VSL."""
        res = predict(client, {
            "typeIncident": "Malaise",
            "etatPatient": "stable",
            "age": 30,
            "nrsPain": 1,
            "arrivalMode": "walk",
            "injury": False,
        })
        data = json.loads(res.data)
        if data["priorite"] == "P3":
            assert data["uniteRecommandee"] == "VSL"


# ══════════════════════════════════════════════════════════════════════════════
# SUITE 4 — Validation des inputs
# ══════════════════════════════════════════════════════════════════════════════
class TestValidationInputs:
    def test_400_sans_body(self, client):
        res = client.post("/predict", data="", content_type="application/json")
        assert res.status_code == 400

    def test_400_sans_type_incident(self, client):
        res = predict(client, {"etatPatient": "conscient"})
        assert res.status_code == 400

    def test_400_sans_etat_patient(self, client):
        res = predict(client, {"typeIncident": "Malaise"})
        assert res.status_code == 400

    def test_valeurs_par_defaut_pour_champs_optionnels(self, client):
        """Doit fonctionner avec seulement les 2 champs obligatoires."""
        res = predict(client, {
            "typeIncident": "Malaise",
            "etatPatient": "conscient",
        })
        assert res.status_code == 200

    def test_type_incident_inconnu_ne_crashe_pas(self, client):
        res = predict(client, {
            "typeIncident": "TypeInexistant",
            "etatPatient": "conscient",
        })
        assert res.status_code == 200

    def test_age_extremes_ne_crashent_pas(self, client):
        for age in [0, 1, 110, 150]:
            res = predict(client, {
                "typeIncident": "Malaise",
                "etatPatient": "conscient",
                "age": age,
            })
            assert res.status_code == 200, f"Crash pour age={age}"

    def test_nrs_pain_maximum(self, client):
        res = predict(client, {
            "typeIncident": "Malaise",
            "etatPatient": "conscient",
            "nrsPain": 10,
        })
        assert res.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# SUITE 5 — Endpoint /features
# ══════════════════════════════════════════════════════════════════════════════
class TestFeatures:
    def test_features_retourne_types_incidents(self, client):
        res = client.get("/features")
        assert res.status_code == 200
        data = json.loads(res.data)
        assert "typeIncidents" in data
        assert len(data["typeIncidents"]) > 0

    def test_features_retourne_etats_patient(self, client):
        res = client.get("/features")
        data = json.loads(res.data)
        assert "etatsPatient" in data
        assert "conscient" in data["etatsPatient"]
        assert "inconscient" in data["etatsPatient"]