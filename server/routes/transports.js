/**
 * BlancBleu — Routes Transport Sanitaire
 * Remplace routes/interventions.js
 */
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const ctrl = require("../controllers/transportController");

// ── Stats (avant /:id) ────────────────────────────────────────────────────────
router.get("/stats", protect, ctrl.getStats);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get("/", protect, ctrl.getTransports);
router.post("/", protect, ctrl.createTransport);
router.get("/:id", protect, ctrl.getTransport);
router.patch("/:id", protect, ctrl.updateTransport);
router.delete("/:id", protect, ctrl.deleteTransport);

// ── Transitions lifecycle ─────────────────────────────────────────────────────
router.patch("/:id/confirm", protect, ctrl.confirmer);
router.patch("/:id/schedule", protect, ctrl.planifier);
router.patch("/:id/assign", protect, ctrl.assigner); // body: { vehiculeId, chauffeurId, auto }
router.patch("/:id/en-route", protect, ctrl.enRoute);
router.patch("/:id/arrived", protect, ctrl.arriveePatient); // arrivé chez patient
router.patch("/:id/on-board", protect, ctrl.patientABord);
router.patch("/:id/destination", protect, ctrl.arriveeDestination);
router.patch("/:id/complete", protect, ctrl.completer);
router.patch("/:id/no-show", protect, ctrl.noShow); // body: { raison }
router.patch("/:id/cancel", protect, ctrl.annuler); // body: { raison }
router.patch("/:id/reschedule", protect, ctrl.reprogrammer); // body: { nouvelleDate, raison }

module.exports = router;
