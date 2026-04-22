const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/missionController");

router.get("/stats", protect, ctrl.getStats);
router.get("/", protect, ctrl.getMissions);
router.get("/:id", protect, ctrl.getMission);
router.post("/", protect, authorize("admin", "superviseur", "dispatcher"), ctrl.createMission);
router.patch("/:id", protect, authorize("admin", "superviseur", "dispatcher"), ctrl.updateMission);
router.patch("/:id/statut", protect, authorize("admin", "superviseur", "dispatcher"), ctrl.updateStatut);
router.post("/:id/terminer", protect, authorize("admin", "superviseur", "dispatcher"), ctrl.terminerMission);

module.exports = router;
