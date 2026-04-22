const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/patientController");

router.get("/stats", protect, ctrl.getStats);
router.get("/", protect, ctrl.getPatients);
router.get("/:id", protect, ctrl.getPatient);
router.post("/", protect, authorize("admin", "superviseur", "dispatcher"), ctrl.createPatient);
router.patch("/:id", protect, authorize("admin", "superviseur", "dispatcher"), ctrl.updatePatient);
router.delete("/:id", protect, authorize("admin", "superviseur"), ctrl.deletePatient);

module.exports = router;
