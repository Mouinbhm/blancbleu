const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  analyzeIntervention,
  analyzeAndSave,
  getOptions,
  getModelStatus,
} = require("../controllers/aiController");

router.post("/analyze", protect, analyzeIntervention);
router.post("/analyze-and-save", protect, analyzeAndSave);
router.get("/options", protect, getOptions);
router.get("/status", protect, getModelStatus);

module.exports = router;

