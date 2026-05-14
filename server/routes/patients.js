const express = require("express");
const router  = express.Router();
const { protect, authorize } = require("../middleware/auth");
const ctrl    = require("../controllers/patientController");

// ── Routes statiques (AVANT /:id) ─────────────────────────────────────────────
router.get("/stats", protect, ctrl.getStats);
router.get("/",      protect, ctrl.getPatients);

// ── Routes RGPD par patient (AVANT /:id générique) ────────────────────────────
router.get( "/:id/full-profile",         protect, ctrl.getFullProfile);
router.get( "/:id/data-export",          protect, authorize("admin", "superviseur"), ctrl.exportPatientData);
router.post("/:id/consent",              protect, ctrl.updateConsent);
router.get( "/:id/consent-history",      protect, ctrl.getConsentHistory);
router.post("/:id/anonymize",            protect, authorize("admin", "superviseur"), ctrl.anonymizePatient);
router.post("/:id/request-deletion",     protect, ctrl.requestDeletion);
router.post("/:id/cancel-deletion-request", protect, authorize("admin", "superviseur"), ctrl.cancelDeletion);
router.get( "/:id/audit-summary",        protect, authorize("admin", "superviseur"), ctrl.getAuditSummary);

// ── CRUD standard ─────────────────────────────────────────────────────────────
router.get(   "/:id",  protect, ctrl.getPatient);
router.post(  "/",     protect, authorize("admin", "superviseur", "dispatcher"), ctrl.createPatient);
router.patch( "/:id",  protect, authorize("admin", "superviseur", "dispatcher"), ctrl.updatePatient);
router.delete("/:id",  protect, authorize("admin", "superviseur"), ctrl.deletePatient);

module.exports = router;
