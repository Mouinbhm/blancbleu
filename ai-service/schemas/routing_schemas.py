"""
Schémas Pydantic — Module Routing (optimisation de tournée VRP)
"""

from pydantic import BaseModel, Field
from typing import Optional, List


class Position(BaseModel):
    lat: float
    lng: float


class TransportRouting(BaseModel):
    """Transport à intégrer dans la tournée."""
    _id: str
    numero: str
    adresseDepart: str
    adresseDestination: str
    heureDepart: Optional[str] = None       # "08:30" — contrainte horaire
    mobilite: Optional[str] = "ASSIS"
    typeTransport: Optional[str] = "VSL"
    dureeEstimee: Optional[int] = 30         # Minutes estimées pour le trajet


class VehiculeRouting(BaseModel):
    """Véhicule disponible pour la tournée."""
    _id: str
    immatriculation: str
    type: str
    position: Optional[Position] = None     # Position de départ


class RoutingRequest(BaseModel):
    date: str = Field(description="Date de la tournée (YYYY-MM-DD)")
    transports: List[TransportRouting]
    vehicules: List[VehiculeRouting]
    depot: Position = Field(description="Position du garage (base de départ)")


class EtapeRoute(BaseModel):
    """Une étape dans la tournée d'un véhicule."""
    ordre: int
    transportId: str
    numero: str
    type: str  # "PRISE_EN_CHARGE" | "DESTINATION"
    adresse: str
    heureArriveeEstimee: Optional[str] = None
    distanceDepuisPrecedent: Optional[float] = None  # km


class RouteTournee(BaseModel):
    """Tournée complète d'un véhicule."""
    vehiculeId: str
    immatriculation: str
    etapes: List[EtapeRoute]
    distanceTotaleKm: float
    dureeMinutes: int
    nbTransports: int


class RoutingResponse(BaseModel):
    date: str
    routes: List[RouteTournee]
    distanceTotale: float = Field(description="Distance totale pour tous les véhicules (km)")
    dureeMaxMinutes: int = Field(description="Durée de la plus longue tournée (min)")
    nbTransports: int
    nbVehicules: int
    statut: str = Field(description="'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE'")
    messageOptimiseur: Optional[str] = None
