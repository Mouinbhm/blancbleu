const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getUnits,
  getStats,
  getUnit,
  createUnit,
  updateUnit,
  deleteUnit,
  assignUnit,
  marquerEnRoute,
  marquerSurPlace,
  marquerTransport,
  terminerMission,
  updateLocation,
  updateStatut,
} = require("../controllers/unitController");

// CRUD
router.get("/", protect, getUnits);
router.get("/stats", protect, getStats);
router.get("/:id", protect, getUnit);
router.post("/", protect, createUnit);
router.put("/:id", protect, updateUnit);
router.delete("/:id", protect, deleteUnit);

// Cycle de vie mission — MODE RÉEL
router.patch("/:id/assign", protect, assignUnit);
router.patch("/:id/en-route", protect, marquerEnRoute);
router.patch("/:id/on-site", protect, marquerSurPlace);
router.patch("/:id/transporting", protect, marquerTransport);
router.patch("/:id/complete", protect, terminerMission);

// Position GPS
router.patch("/:id/location", protect, updateLocation);
router.patch("/:id/statut", protect, updateStatut);

module.exports = router;
