"""
BlancBleu — Prédicteur de durée de transport (ML)

Benchmark 3 modèles : LinearRegression, RandomForest, XGBoost
Sélection automatique par MAE minimale.
Explication SHAP des prédictions.
"""

import json
import logging
import math
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger("blancbleu.ai.duration_predictor")

# Features one-hot attendues (ordre fixe pour garantir la cohérence)
_MOBILITES   = ["ASSIS", "ALLONGE", "FAUTEUIL_ROULANT"]
_VEHICULES   = ["AMBULANCE", "TPMR", "VSL"]
_ETABS       = ["centre_dialyse", "clinique_privee", "domicile", "hopital_public"]
_MOTIFS      = ["Chimiotherapie", "Consultation", "Dialyse", "Hospitalisation"]
_HEURES_POINTE = {7, 8, 9, 17, 18, 19}


class DurationPredictor:
    """Prédicteur ML de durée de transport sanitaire."""

    def __init__(self, model_path: str = "model/duration_model.pkl"):
        self.model_path     = Path(model_path)
        self.model_dir      = self.model_path.parent
        self.features_path  = self.model_dir / f"{self.model_path.stem}_features.json"
        self.metrics_path   = self.model_dir / "metrics.json"

        self.model          = None
        self.feature_names  = None
        self.explainer      = None
        self._model_r2      = 0.0

    # ─── load ────────────────────────────────────────────────────────────────

    def load(self) -> bool:
        """
        Charge le modèle pkl et les features depuis model/.
        Initialise shap.TreeExplainer si le modèle est un arbre.
        Retourne True si succès, False si fichier absent.
        """
        if not self.model_path.exists():
            logger.warning(f"Modèle non trouvé : {self.model_path}")
            return False

        try:
            import joblib
            import shap

            self.model = joblib.load(self.model_path)

            if self.features_path.exists():
                with open(self.features_path, encoding="utf-8") as f:
                    self.feature_names = json.load(f)

            if self.metrics_path.exists():
                with open(self.metrics_path, encoding="utf-8") as f:
                    m = json.load(f)
                gagnant = m.get("gagnant", "")
                self._model_r2 = m.get("modeles", {}).get(gagnant, {}).get("R2", 0.0)

            # TreeExplainer pour RF et XGBoost
            try:
                self.explainer = shap.TreeExplainer(self.model)
            except Exception:
                self.explainer = None

            logger.info(f"Modèle chargé : {self.model_path} (R²={self._model_r2:.3f})")
            return True

        except Exception as e:
            logger.error(f"Erreur chargement modèle : {e}")
            self.model = None
            return False

    # ─── train ───────────────────────────────────────────────────────────────

    def train(self, df_processed: pd.DataFrame) -> dict:
        """
        Benchmark LinearRegression / RandomForest / XGBoost.
        Sélectionne le modèle avec la MAE minimale.
        Sauvegarde modèle, features et métriques dans model/.
        """
        from sklearn.linear_model  import LinearRegression
        from sklearn.ensemble      import RandomForestRegressor
        from sklearn.model_selection import cross_val_score, train_test_split
        from sklearn.metrics       import mean_absolute_error, r2_score, mean_absolute_percentage_error
        from xgboost               import XGBRegressor
        import joblib
        import shap

        X = df_processed.drop("duree_minutes", axis=1)
        y = df_processed["duree_minutes"]

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        candidates = {
            "Linear Regression": LinearRegression(),
            "Random Forest":     RandomForestRegressor(n_estimators=100, random_state=42),
            "XGBoost":           XGBRegressor(
                                     n_estimators=300, max_depth=6, learning_rate=0.05,
                                     subsample=0.8, colsample_bytree=0.8,
                                     random_state=42, verbosity=0,
                                 ),
        }

        results = {}
        best_name  = None
        best_mae   = float("inf")
        best_model = None

        for name, mdl in candidates.items():
            mdl.fit(X_train, y_train)
            y_pred = mdl.predict(X_test)

            mae  = float(mean_absolute_error(y_test, y_pred))
            r2   = float(r2_score(y_test, y_pred))
            mape = float(mean_absolute_percentage_error(y_test, y_pred))
            cv   = cross_val_score(mdl, X, y, cv=5, scoring="neg_mean_absolute_error")
            cv_mae = float(-cv.mean())

            results[name] = {
                "MAE":    round(mae,    2),
                "R2":     round(r2,     3),
                "MAPE":   round(mape * 100, 1),
                "CV_MAE": round(cv_mae, 2),
            }

            if mae < best_mae:
                best_mae   = mae
                best_name  = name
                best_model = mdl

        self.model         = best_model
        self.feature_names = X.columns.tolist()
        self._model_r2     = results[best_name]["R2"]

        # Persistance
        self.model_dir.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.model, self.model_path)

        with open(self.features_path, "w", encoding="utf-8") as f:
            json.dump(self.feature_names, f, indent=2)

        metrics_data = {
            "modeles": results,
            "gagnant": best_name,
            "meilleur_mae": round(best_mae, 2),
        }
        with open(self.metrics_path, "w", encoding="utf-8") as f:
            json.dump(metrics_data, f, indent=2, ensure_ascii=False)

        # Initialise SHAP
        try:
            self.explainer = shap.TreeExplainer(self.model)
        except Exception:
            self.explainer = None

        # Génère les plots SHAP
        try:
            shap_vals = self.explainer.shap_values(X_test) if self.explainer else None
            if shap_vals is not None:
                self.generate_shap_plots(X_test, shap_vals)
        except Exception as e:
            logger.warning(f"Génération plots SHAP échouée : {e}")

        self._print_benchmark(results, best_name, best_mae)
        return metrics_data

    # ─── predict ─────────────────────────────────────────────────────────────

    def predict(self, transport_data: dict) -> dict:
        """
        Prédit la durée d'un transport.
        Si le modèle n'est pas chargé, utilise un fallback rule-based (confiance FAIBLE).
        """
        if self.model is None:
            return self._predict_fallback(transport_data)

        X = self._prepare_features(transport_data)
        pred = float(self.model.predict(X)[0])
        pred = max(8.0, round(pred, 1))

        duree_min = round(pred * 0.85, 1)
        duree_max = round(pred * 1.15, 1)

        heure = int(transport_data.get("heure_depart", 8))
        heure_fin_h = (heure + pred / 60)
        h = int(heure_fin_h) % 24
        m = int((heure_fin_h - int(heure_fin_h)) * 60)
        heure_fin_str = f"{h:02d}:{m:02d}"

        # Confiance basée sur R² du modèle et complétude des données
        cles_presentes = all(
            transport_data.get(k) is not None
            for k in ("distance_km", "heure_depart", "mobilite")
        )
        if self._model_r2 >= 0.75 and cles_presentes:
            confiance = "HAUTE"
        elif self._model_r2 >= 0.50:
            confiance = "MOYENNE"
        else:
            confiance = "FAIBLE"

        contributions = self._compute_shap(X)

        return {
            "duree_minutes":     pred,
            "duree_min":         duree_min,
            "duree_max":         duree_max,
            "confiance":         confiance,
            "heure_fin_estimee": heure_fin_str,
            "contributions":     contributions,
        }

    # ─── _prepare_features ───────────────────────────────────────────────────

    def _prepare_features(self, d: dict) -> pd.DataFrame:
        """
        Construit le vecteur de features dans le même ordre que l'entraînement.
        Les colonnes manquantes reçoivent la valeur 0.
        """
        row: dict = {}

        # Scalaires
        row["distance_km"]          = float(d.get("distance_km", 10.0))
        row["aller_retour"]         = int(bool(d.get("aller_retour", False)))
        row["nb_patients"]          = int(d.get("nb_patients", 1))
        row["experience_chauffeur"] = float(d.get("experience_chauffeur", 0.5))

        # One-hot
        mobilite = d.get("mobilite", "ASSIS")
        for m in _MOBILITES:
            row[f"mobilite_{m}"] = 1 if mobilite == m else 0

        type_v = d.get("type_vehicule", "VSL")
        for tv in _VEHICULES:
            row[f"type_vehicule_{tv}"] = 1 if type_v == tv else 0

        etab = d.get("type_etablissement", "hopital_public")
        for e in _ETABS:
            row[f"type_etablissement_{e}"] = 1 if etab == e else 0

        motif = d.get("motif", "Consultation")
        for mo in _MOTIFS:
            row[f"motif_{mo}"] = 1 if motif == mo else 0

        # Cycliques
        heure = float(d.get("heure_depart", 8))
        jour  = float(d.get("jour_semaine", 0))
        row["heure_sin"] = math.sin(2.0 * math.pi * heure / 24.0)
        row["heure_cos"] = math.cos(2.0 * math.pi * heure / 24.0)
        row["jour_sin"]  = math.sin(2.0 * math.pi * jour  / 7.0)
        row["jour_cos"]  = math.cos(2.0 * math.pi * jour  / 7.0)

        # Engineered
        row["est_heure_pointe"]  = 1 if int(heure) in _HEURES_POINTE else 0
        row["est_lundi"]         = 1 if int(jour) == 0 else 0
        row["distance_x_heure"] = row["distance_km"] * row["heure_sin"]

        # Aligner sur les colonnes d'entraînement
        if self.feature_names:
            df = pd.DataFrame([{f: row.get(f, 0) for f in self.feature_names}])
        else:
            df = pd.DataFrame([row])

        return df

    # ─── _compute_shap ───────────────────────────────────────────────────────

    def _compute_shap(self, X: pd.DataFrame) -> list:
        """Retourne le top-5 SHAP pour la prédiction."""
        if self.explainer is None:
            return []
        try:
            shap_vals = self.explainer.shap_values(X)
            vals_1d = np.array(shap_vals[0]) if shap_vals.ndim > 1 else np.array(shap_vals)

            cols = X.columns.tolist()
            pairs = sorted(zip(cols, vals_1d.tolist()), key=lambda x: abs(x[1]), reverse=True)

            return [
                {
                    "feature": feat,
                    "impact":  f"{impact:+.1f} min",
                    "valeur":  float(X[feat].iloc[0]),
                }
                for feat, impact in pairs[:5]
            ]
        except Exception as e:
            logger.warning(f"SHAP computation failed : {e}")
            return []

    # ─── _predict_fallback ───────────────────────────────────────────────────

    def _predict_fallback(self, d: dict) -> dict:
        """Prédiction par règles métier quand le modèle n'est pas chargé."""
        distance_km = float(d.get("distance_km", 10.0))
        heure       = int(d.get("heure_depart", 8))
        jour        = int(d.get("jour_semaine", 0))
        mobilite    = d.get("mobilite", "ASSIS")
        etab        = d.get("type_etablissement", "hopital_public")
        aller_retour = bool(d.get("aller_retour", False))
        experience  = float(d.get("experience_chauffeur", 0.5))

        base = (distance_km / 30.0) * 60.0

        if heure in (7, 8, 9):
            base *= 1.45
        elif heure in (17, 18, 19):
            base *= 1.35

        if jour == 0:
            base *= 1.15

        if mobilite == "FAUTEUIL_ROULANT":
            base += 11.5
        elif mobilite == "ALLONGE":
            base += 16.0
        else:
            base += 3.5

        if etab == "hopital_public":
            base += 7.5
        elif etab == "centre_dialyse":
            base += 5.0

        if aller_retour:
            base *= 2.1

        base *= (1.0 - experience * 0.1)
        duree = max(8.0, round(base, 1))

        heure_fin_h = heure + duree / 60.0
        h = int(heure_fin_h) % 24
        m = int((heure_fin_h - int(heure_fin_h)) * 60)

        return {
            "duree_minutes":     duree,
            "duree_min":         round(duree * 0.85, 1),
            "duree_max":         round(duree * 1.15, 1),
            "confiance":         "FAIBLE",
            "heure_fin_estimee": f"{h:02d}:{m:02d}",
            "contributions":     [],
        }

    # ─── generate_shap_plots ─────────────────────────────────────────────────

    def generate_shap_plots(self, X_test: pd.DataFrame, shap_values) -> None:
        """Sauvegarde les plots SHAP (beeswarm + bar) dans model/."""
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import shap

        try:
            # Beeswarm (summary)
            shap.summary_plot(shap_values, X_test, show=False)
            plt.savefig(self.model_dir / "shap_summary.png", bbox_inches="tight", dpi=100)
            plt.close()

            # Bar (feature importance)
            shap.summary_plot(shap_values, X_test, plot_type="bar", show=False)
            plt.savefig(self.model_dir / "shap_importance.png", bbox_inches="tight", dpi=100)
            plt.close()

            logger.info("Plots SHAP sauvegardés.")
        except Exception as e:
            logger.warning(f"generate_shap_plots : {e}")

    # ─── _print_benchmark ────────────────────────────────────────────────────

    def _print_benchmark(self, results: dict, gagnant: str, best_mae: float) -> None:
        """Affiche le tableau comparatif dans le terminal."""
        print("\n  BENCHMARK MODÈLES")
        print("  " + "─" * 55)
        print(f"  {'Modèle':<22} {'MAE':>6}  {'R²':>6}  {'MAPE':>7}  {'CV-MAE':>7}")
        print("  " + "─" * 55)
        for name, m in results.items():
            flag = "  ✅" if name == gagnant else ""
            print(
                f"  {name:<22} {m['MAE']:>6.2f}  {m['R2']:>6.3f}  "
                f"{m['MAPE']:>6.1f}%  {m['CV_MAE']:>7.2f}{flag}"
            )
        print("  " + "─" * 55)
        print(f"  GAGNANT : {gagnant} — MAE = {best_mae:.2f} min\n")
