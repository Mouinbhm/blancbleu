/**
 * BlancBleu — Routes Géodécision
 * Adapté transport sanitaire — utilise Vehicle au lieu de Unit
 *
 * GET /api/geo/vehicles/nearby  → véhicules disponibles triés par proximité
 * GET /api/geo/eta              → calcul ETA direct
 * GET /api/geo/distance         → distance entre 2 points GPS
 * GET /api/geo/zone/check       → vérifier zone Nice
 */
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const Vehicle = require("../models/Vehicle");
const {
  haversine,
  calculerETA,
  trierParProximite,
  estDansZoneNice,
} = require("../utils/geoUtils");

// ─── GET /api/geo/vehicles/nearby ─────────────────────────────────────────────
// Retourne les véhicules disponibles triés par distance depuis un patient
// Query params : lat, lng, typeTransport, limit
router.get("/vehicles/nearby", protect, async (req, res) => {
  try {
    const { lat, lng, typeTransport, limit = 5 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ message: "lat et lng requis" });
    }

    const filtre = { statut: "disponible", deletedAt: null };
    if (typeTransport) filtre.type = typeTransport;

    const vehicles = await Vehicle.find(filtre);

    if (vehicles.length === 0) {
      return res.json({
        vehicles: [],
        total: 0,
        message: "Aucun véhicule disponible",
      });
    }

    const vehiclesTries = trierParProximite(
      vehicles,
      parseFloat(lat),
      parseFloat(lng),
      "P2", // ETA standard pour transport programmé
    );

    res.json({
      vehicles: vehiclesTries.slice(0, parseInt(limit)),
      total: vehicles.length,
      patient: { lat: parseFloat(lat), lng: parseFloat(lng) },
      typeTransport: typeTransport || "tous",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Compatibilité ancienne route /api/geo/units/nearby → redirige vers vehicles/nearby
router.get("/units/nearby", protect, async (req, res) => {
  try {
    const { lat, lng, limit = 5 } = req.query;
    if (!lat || !lng)
      return res.status(400).json({ message: "lat et lng requis" });

    const vehicles = await Vehicle.find({
      statut: "disponible",
      deletedAt: null,
    });
    if (vehicles.length === 0)
      return res.json({
        units: [],
        total: 0,
        message: "Aucun véhicule disponible",
      });

    const tries = trierParProximite(
      vehicles,
      parseFloat(lat),
      parseFloat(lng),
      "P2",
    );
    res.json({
      units: tries.slice(0, parseInt(limit)), // clé "units" pour compatibilité frontend
      total: vehicles.length,
      incident: { lat: parseFloat(lat), lng: parseFloat(lng) },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/geo/eta ─────────────────────────────────────────────────────────
// Calcule l'ETA entre un véhicule et un patient
// Query params : vehicleId, patientLat, patientLng
// (compatibilité : unitId, incidentLat, incidentLng)
router.get("/eta", protect, async (req, res) => {
  try {
    const {
      vehicleId,
      unitId,
      patientLat,
      incidentLat,
      patientLng,
      incidentLng,
    } = req.query;

    const id = vehicleId || unitId;
    const lat = patientLat || incidentLat;
    const lng = patientLng || incidentLng;

    if (!id || !lat || !lng) {
      return res
        .status(400)
        .json({ message: "vehicleId (ou unitId), lat et lng requis" });
    }

    const vehicle = await Vehicle.findById(id);
    if (!vehicle)
      return res.status(404).json({ message: "Véhicule introuvable" });
    if (!vehicle.position?.lat || !vehicle.position?.lng) {
      return res
        .status(400)
        .json({ message: "Position GPS du véhicule manquante" });
    }

    const dist = haversine(
      vehicle.position.lat,
      vehicle.position.lng,
      parseFloat(lat),
      parseFloat(lng),
    );
    const eta = calculerETA(dist, "P2");

    res.json({
      vehicule: { id: vehicle._id, nom: vehicle.nom, type: vehicle.type },
      distance: { km: dist, label: `${dist} km` },
      eta,
      position: vehicle.position,
      patient: { lat: parseFloat(lat), lng: parseFloat(lng) },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/geo/distance ────────────────────────────────────────────────────
router.get("/distance", protect, (req, res) => {
  try {
    const { lat1, lng1, lat2, lng2 } = req.query;
    if (!lat1 || !lng1 || !lat2 || !lng2) {
      return res.status(400).json({ message: "lat1, lng1, lat2, lng2 requis" });
    }
    const dist = haversine(
      parseFloat(lat1),
      parseFloat(lng1),
      parseFloat(lat2),
      parseFloat(lng2),
    );
    res.json({ distanceKm: dist, label: `${dist} km` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/geo/zone/check ──────────────────────────────────────────────────
router.get("/zone/check", protect, (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng)
    return res.status(400).json({ message: "lat et lng requis" });
  const dansZone = estDansZoneNice(parseFloat(lat), parseFloat(lng));
  res.json({
    dansZone,
    message: dansZone
      ? "Dans la zone de couverture Blanc Bleu Nice"
      : "Hors zone — transport possible avec délai majoré",
  });
});

module.exports = router;
