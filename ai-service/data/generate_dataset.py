"""
BlancBleu — Générateur de dataset synthétique
Transport sanitaire NON urgent — Zone Nice / Alpes-Maritimes (06)

Usage:
  python -m data.generate_dataset          # génère et sauvegarde le CSV
  from data.generate_dataset import generer_dataset, preprocess
"""

import numpy as np
import pandas as pd
from pathlib import Path


# ─── Constantes métier ───────────────────────────────────────────────────────

MOBILITES       = ["ASSIS", "FAUTEUIL_ROULANT", "ALLONGE"]
TYPES_VEHICULE  = ["VSL", "TPMR", "AMBULANCE"]
TYPES_ETAB      = ["hopital_public", "clinique_privee", "centre_dialyse", "domicile"]
MOTIFS          = ["Dialyse", "Chimiotherapie", "Consultation", "Hospitalisation"]
HEURES_POINTE   = {7, 8, 9, 17, 18, 19}


def generer_dataset(n: int = 1500, seed: int = 42) -> pd.DataFrame:
    """
    Génère n transports synthétiques réalistes sur la zone Nice 06.

    Returns:
        DataFrame brut (avant preprocessing) avec 11 colonnes.
    """
    rng = np.random.default_rng(seed)

    distance_km          = rng.uniform(2.0, 40.0, n)
    heure_depart         = rng.integers(6, 21, n)
    jour_semaine         = rng.integers(0, 7, n)
    mobilite             = rng.choice(MOBILITES,      n, p=[0.50, 0.30, 0.20])
    type_vehicule        = rng.choice(TYPES_VEHICULE, n, p=[0.50, 0.30, 0.20])
    type_etablissement   = rng.choice(TYPES_ETAB,     n, p=[0.30, 0.20, 0.30, 0.20])
    motif                = rng.choice(MOTIFS,         n, p=[0.40, 0.20, 0.30, 0.10])
    aller_retour         = (rng.random(n) < 0.40).astype(int)
    nb_patients          = rng.choice([1, 2, 3],      n, p=[0.70, 0.20, 0.10])
    experience_chauffeur = rng.uniform(0.0, 1.0, n)

    # ── Calcul durée selon logique métier ────────────────────────────────────
    duree = np.empty(n)
    for i in range(n):
        base = (distance_km[i] / 30.0) * 60.0

        h = int(heure_depart[i])
        if h in (7, 8, 9):
            base *= rng.uniform(1.3, 1.6)
        elif h in (17, 18, 19):
            base *= rng.uniform(1.2, 1.5)

        if jour_semaine[i] == 0:
            base *= rng.uniform(1.1, 1.2)

        mob = mobilite[i]
        if mob == "FAUTEUIL_ROULANT":
            base += rng.uniform(8.0, 15.0)
        elif mob == "ALLONGE":
            base += rng.uniform(12.0, 20.0)
        else:
            base += rng.uniform(2.0, 5.0)

        etab = type_etablissement[i]
        if etab == "hopital_public":
            base += rng.uniform(5.0, 10.0)
        elif etab == "centre_dialyse":
            base += rng.uniform(3.0, 7.0)

        if aller_retour[i]:
            base *= 2.1

        base *= (1.0 - experience_chauffeur[i] * 0.1)
        base += rng.normal(0.0, 4.0)
        duree[i] = max(8.0, round(float(base), 1))

    return pd.DataFrame({
        "distance_km":          distance_km,
        "heure_depart":         heure_depart.astype(int),
        "jour_semaine":         jour_semaine.astype(int),
        "mobilite":             mobilite,
        "type_vehicule":        type_vehicule,
        "type_etablissement":   type_etablissement,
        "motif":                motif,
        "aller_retour":         aller_retour,
        "nb_patients":          nb_patients,
        "experience_chauffeur": experience_chauffeur,
        "duree_minutes":        duree,
    })


def preprocess(df: pd.DataFrame) -> pd.DataFrame:
    """
    Transforme le dataset brut en features numériques prêtes pour l'entraînement.

    Opérations :
    - One-hot encoding : mobilite, type_vehicule, type_etablissement, motif
    - Features cycliques : heure_sin, heure_cos, jour_sin, jour_cos
    - Features engineered : est_heure_pointe, est_lundi, distance_x_heure
    - Supprime les colonnes originales heure_depart et jour_semaine
    """
    df = df.copy()

    # One-hot encoding
    for col in ["mobilite", "type_vehicule", "type_etablissement", "motif"]:
        dummies = pd.get_dummies(df[col], prefix=col, dtype=int)
        df = pd.concat([df, dummies], axis=1)
        df.drop(columns=[col], inplace=True)

    # Features cycliques
    heure = df["heure_depart"].astype(float)
    jour  = df["jour_semaine"].astype(float)

    df["heure_sin"] = np.sin(2.0 * np.pi * heure / 24.0)
    df["heure_cos"] = np.cos(2.0 * np.pi * heure / 24.0)
    df["jour_sin"]  = np.sin(2.0 * np.pi * jour  / 7.0)
    df["jour_cos"]  = np.cos(2.0 * np.pi * jour  / 7.0)

    # Features engineered
    df["est_heure_pointe"]  = heure.isin(HEURES_POINTE).astype(int)
    df["est_lundi"]         = (jour == 0).astype(int)
    df["distance_x_heure"]  = df["distance_km"] * df["heure_sin"]

    df.drop(columns=["heure_depart", "jour_semaine"], inplace=True)

    return df


# ─── Point d'entrée CLI ──────────────────────────────────────────────────────

if __name__ == "__main__":
    out_path = Path(__file__).parent / "transports_nice.csv"
    print(f"Génération de 1500 transports synthétiques...")
    df = generer_dataset(n=1500)
    df.to_csv(out_path, index=False)
    print(f"Dataset sauvegardé : {out_path}")
    print(f"Shape : {df.shape}")
    print(df.describe().round(2))
