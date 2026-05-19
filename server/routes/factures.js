/**
 * BlancBleu — Routes Factures v3.0
 */
const express = require("express");
const router  = express.Router();
const { protect, authorize } = require("../middleware/auth");

const ctrl = require("../controllers/factureController");

const COMPTABLE = ["admin", "comptable", "superviseur"];
const ADMIN_SUP = ["admin", "superviseur"];

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get("/stats", protect, ctrl.getStats);

// ── Recalcul des montants à zéro ─────────────────────────────────────────────
router.post("/recalculate-amounts", protect, authorize("admin", "superviseur"), ctrl.recalculateAmounts);

// ── Génération depuis transport ───────────────────────────────────────────────
router.post(
  "/from-transport/:transportId",
  protect,
  authorize("admin", "dispatcher", "superviseur", "comptable"),
  ctrl.createFromTransport,
);

// ── Liste / Création ──────────────────────────────────────────────────────────
router.get(  "/",    protect, ctrl.getFactures);
router.post( "/",    protect, ctrl.createFacture);

// ── Détail / MAJ / Suppression ────────────────────────────────────────────────
router.get(   "/:id",       protect, ctrl.getFacture);
router.patch( "/:id",       protect, ctrl.updateFacture);
router.delete("/:id",       protect, authorize(...COMPTABLE), ctrl.deleteFacture);

// ── Transitions ───────────────────────────────────────────────────────────────
router.patch("/:id/statut", protect, ctrl.updateStatut);
router.patch("/:id/issue",  protect, authorize(...COMPTABLE), ctrl.issueFacture);

// ── Remboursement ─────────────────────────────────────────────────────────────
router.post(
  "/:id/refund",
  protect,
  authorize("admin", "comptable"),
  ctrl.refundFacture,
);

// ── PDF & reçu ────────────────────────────────────────────────────────────────
router.get("/:id/pdf",     protect, ctrl.downloadInvoicePdf);
router.get("/:id/receipt", protect, ctrl.downloadReceiptPdf);

// ── Historique ────────────────────────────────────────────────────────────────
router.get("/:id/history", protect, ctrl.getHistory);

module.exports = router;
