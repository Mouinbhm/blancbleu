"""
Schémas Pydantic — Module PMT (Prescription Médicale de Transport)
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class MobilitePatient(str, Enum):
    ASSIS = "ASSIS"
    FAUTEUIL_ROULANT = "FAUTEUIL_ROULANT"
    ALLONGE = "ALLONGE"
    CIVIERE = "CIVIERE"


class TypeTransportAutorise(str, Enum):
    VSL = "VSL"
    AMBULANCE = "AMBULANCE"
    TPMR = "TPMR"


class PatientExtrait(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    dateNaissance: Optional[str] = None
    numeroSecu: Optional[str] = None  # Peut être masqué selon RGPD


class MedecinExtrait(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    rpps: Optional[str] = None  # Numéro RPPS


class PMTExtraction(BaseModel):
    """Données extraites d'une Prescription Médicale de Transport."""
    patient: PatientExtrait
    medecin: MedecinExtrait
    datePrescription: Optional[str] = None
    typeTransportAutorise: Optional[TypeTransportAutorise] = None
    mobilite: Optional[MobilitePatient] = None
    destination: Optional[str] = None
    allerRetour: Optional[bool] = None
    oxygene: Optional[bool] = False
    brancardage: Optional[bool] = False
    frequence: Optional[str] = None     # Ex: "3x/semaine", "hebdomadaire"
    motif: Optional[str] = None         # Raison médicale du transport
    remarques: Optional[str] = None     # Notes du médecin


class PMTExtractionResponse(BaseModel):
    """Réponse complète de l'extraction PMT."""
    extraction: PMTExtraction
    confiance: float = Field(..., ge=0.0, le=1.0, description="Score de confiance [0, 1]")
    validationRequise: bool = Field(
        description="True si la confiance est < 0.75 ou des champs critiques manquent"
    )
    champsManquants: List[str] = Field(
        default_factory=list,
        description="Champs obligatoires non détectés"
    )
    champsIncertains: List[str] = Field(
        default_factory=list,
        description="Champs détectés avec faible confiance"
    )
    texteOCR: Optional[str] = Field(None, description="Texte brut extrait par OCR")
