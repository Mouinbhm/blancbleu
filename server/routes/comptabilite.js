/**
 * BlancBleu — Routes Comptabilité v3.0
 */
const express = require("express");
const router  = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getDashboard,
  exportInvoicesCsv,
  exportPaymentsCsv,
  exportBatch,
} = require("../controllers/comptabiliteController");

const COMPTABLE = ["admin", "comptable", "superviseur"];

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get("/dashboard", protect, getDashboard);

// ── Export CSV ────────────────────────────────────────────────────────────────
// ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&paymentStatus=SUCCEEDED&exported=false
router.get(
  "/export/invoices.csv",
  protect,
  authorize(...COMPTABLE),
  exportInvoicesCsv,
);

router.get(
  "/export/payments.csv",
  protect,
  authorize(...COMPTABLE),
  exportPaymentsCsv,
);

// ── Batch : génère CSV + marque les factures comme exportées ──────────────────
router.post(
  "/export/batch",
  protect,
  authorize("admin", "comptable"),
  exportBatch,
);

module.exports = router;
