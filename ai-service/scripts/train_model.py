"""
BlancBleu — Script d'entraînement standalone du modèle de durée.

Usage :
  python scripts/train_model.py
"""

import sys
import time
from pathlib import Path

# Assurer que le répertoire racine ai-service est dans le path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def _barre(label: str, ok: bool = True) -> None:
    symbole = "✓" if ok else "✗"
    print(f"  {label:<35} {symbole}")


def _top5_shap(predictor, X_test) -> list:
    """Retourne les 5 features les plus importantes selon SHAP."""
    if predictor.explainer is None:
        return []
    try:
        import numpy as np
        shap_vals = predictor.explainer.shap_values(X_test)
        mean_abs = np.abs(shap_vals).mean(axis=0)
        cols = X_test.columns.tolist()
        pairs = sorted(zip(cols, mean_abs.tolist()), key=lambda x: x[1], reverse=True)
        return pairs[:5]
    except Exception:
        return []


def _barre_prog(valeur: float, max_val: float, width: int = 12) -> str:
    filled = int(round(valeur / max_val * width)) if max_val > 0 else 0
    return "█" * filled + " " * (width - filled)


def main() -> None:
    print()
    print("═" * 51)
    print("  BlancBleu — AI Transport Optimizer Training")
    print("═" * 51)

    # ── 1. Dataset ──────────────────────────────────────────────────────────
    from data.generate_dataset import generer_dataset, preprocess

    t0 = time.perf_counter()
    df = generer_dataset(n=1500)
    _barre(f"Génération dataset : {len(df)} transports simulés")

    df_processed = preprocess(df)
    n_features = len(df_processed.columns) - 1  # hors target
    _barre(f"Preprocessing      : {n_features} features créées")

    # ── 2. Entraînement ──────────────────────────────────────────────────────
    from services.duration_predictor import DurationPredictor

    predictor = DurationPredictor()
    metrics   = predictor.train(df_processed)

    # ── 3. Tableau déjà affiché par _print_benchmark ──────────────────────
    gagnant  = metrics["gagnant"]
    best_mae = metrics["meilleur_mae"]

    # ── 4. Top 5 SHAP ────────────────────────────────────────────────────────
    from sklearn.model_selection import train_test_split
    X = df_processed.drop("duree_minutes", axis=1)
    y = df_processed["duree_minutes"]
    _, X_test, _, _ = train_test_split(X, y, test_size=0.2, random_state=42)

    top5 = _top5_shap(predictor, X_test)
    if top5:
        max_shap = top5[0][1] if top5 else 1.0
        print("  TOP 5 FEATURES (SHAP)")
        for feat, val in top5:
            barre = _barre_prog(val, max_shap)
            print(f"  {feat:<28} {barre}  {val:.3f}")
        print()

    # ── 5. Confirmation fichiers ─────────────────────────────────────────────
    model_dir = predictor.model_dir
    print("  Fichiers sauvegardés dans model/")
    for fname in [
        "duration_model.pkl",
        "duration_model_features.json",
        "metrics.json",
        "shap_summary.png",
        "shap_importance.png",
    ]:
        exists = (model_dir / fname).exists()
        _barre(f"  {fname}", ok=exists)

    elapsed = round(time.perf_counter() - t0, 1)
    print()
    print(f"  Durée totale : {elapsed} s")
    print("═" * 51)
    print()


if __name__ == "__main__":
    main()
