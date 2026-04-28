"""
BlancBleu — Schémas Pydantic pour l'optimiseur de durée de transport.
"""

from pydantic import BaseModel, Field
from typing import List, Optional


class TransportInput(BaseModel):
    """Corps de la requête POST /predict/duree."""
    distance_km:           float = Field(..., gt=0, description="Distance en km")
    heure_depart:          int   = Field(..., ge=6, le=20, description="Heure de départ (6-20)")
    jour_semaine:          int   = Field(0,  ge=0, le=6,  description="0=lundi … 6=dimanche")
    mobilite:              str   = Field("ASSIS",         description="ASSIS | FAUTEUIL_ROULANT | ALLONGE | CIVIERE")
    type_vehicule:         str   = Field("VSL",           description="VSL | TPMR | AMBULANCE")
    type_etablissement:    str   = Field("hopital_public", description="hopital_public | clinique_privee | centre_dialyse | domicile")
    motif:                 str   = Field("Consultation",  description="Dialyse | Chimiotherapie | Consultation | Hospitalisation")
    aller_retour:          bool  = Field(False)
    nb_patients:           int   = Field(1,  ge=1, le=10)
    experience_chauffeur:  float = Field(0.5, ge=0.0, le=1.0)


class ContributionSHAP(BaseModel):
    feature: str
    impact:  str
    valeur:  float


class PredictionDuree(BaseModel):
    """Résultat de la prédiction de durée."""
    duree_minutes:     float
    duree_min:         float
    duree_max:         float
    confiance:         str               # "HAUTE" | "MOYENNE" | "FAIBLE"
    heure_fin_estimee: str               # "HH:MM"
    contributions:     List[ContributionSHAP] = []


class OptimisationInput(BaseModel):
    """Corps de la requête POST /optimize/realtime."""
    transport: dict
    vehicules: List[dict]


class GainsOptimisation(BaseModel):
    km_economises:              float
    pourcentage_reduction_km:   float
    minutes_attente_economisees: float
    taux_utilisation_flotte:    float


class ResultatOptimisation(BaseModel):
    solution:             dict
    affectations:         List[dict]
    gains:                dict
    temps_calcul_ms:      float
    nb_reoptimisations:   int
    transports_planifies: int
