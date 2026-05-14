const express = require("express");
const router  = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { uploadPmt } = require("../middleware/upload");
const ctrl = require("../controllers/prescriptionController");

const STAFF = ["admin", "superviseur", "dispatcher"];

// ── Routes statiques (DOIVENT précéder /:id) ──────────────────────────────────
router.get("/stats",               protect, ctrl.getStats);
router.get("/pending-validation",  protect, authorize("admin", "superviseur", "dispatcher"), ctrl.getPendingValidation);
router.post("/upload",             protect, authorize(...STAFF), (req, res, next) => {
  uploadPmt(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, ctrl.uploadPmt);

// ── Liste / création ──────────────────────────────────────────────────────────
router.get("/",   protect, ctrl.getPrescriptions);
router.post("/",  protect, authorize(...STAFF), ctrl.createPrescription);

// ── Sous-routes statiques par id (avant PATCH /:id générique) ─────────────────
router.get("/:id/ocr-result",    protect, ctrl.getOcrResult);
router.get("/:id/validation",    protect, authorize(...STAFF), ctrl.getValidationState);
router.patch("/:id/correct",     protect, authorize(...STAFF), ctrl.correctPrescription);
router.patch("/:id/validate",    protect, authorize(...STAFF), ctrl.validatePmt);
router.patch("/:id/reject",      protect, authorize(...STAFF), ctrl.rejectPmt);
router.patch("/:id/link-patient",   protect, authorize(...STAFF), ctrl.linkPatient);
router.patch("/:id/link-transport", protect, authorize(...STAFF), ctrl.linkTransport);

// ── CRUD existant ─────────────────────────────────────────────────────────────
router.get("/:id",      protect, ctrl.getPrescription);
router.patch("/:id",    protect, authorize(...STAFF), ctrl.updatePrescription);
router.patch("/:id/valider",   protect, authorize(...STAFF), ctrl.validerPrescription);
router.patch("/:id/incomplet", protect, authorize(...STAFF), ctrl.marquerIncomplet);
router.delete("/:id",  protect, authorize("admin", "superviseur"), ctrl.deletePrescription);

module.exports = router;
