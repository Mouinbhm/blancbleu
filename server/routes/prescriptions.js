const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/prescriptionController");

router.get("/stats", protect, ctrl.getStats);
router.get("/", protect, ctrl.getPrescriptions);
router.get("/:id", protect, ctrl.getPrescription);
router.post("/", protect, authorize("admin", "superviseur", "dispatcher"), ctrl.createPrescription);
router.patch("/:id", protect, authorize("admin", "superviseur", "dispatcher"), ctrl.updatePrescription);
router.patch("/:id/valider", protect, authorize("admin", "superviseur", "dispatcher"), ctrl.validerPrescription);
router.patch("/:id/incomplet", protect, authorize("admin", "superviseur", "dispatcher"), ctrl.marquerIncomplet);
router.delete("/:id", protect, authorize("admin", "superviseur"), ctrl.deletePrescription);

module.exports = router;
