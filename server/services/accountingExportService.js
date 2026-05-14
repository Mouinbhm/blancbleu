/**
 * BlancBleu — Service Export Comptable v3.0
 *
 * Génère les exports CSV pour la comptabilité.
 * Réservé aux rôles admin et comptable.
 */

const Facture = require("../models/Facture");
const logger  = require("../utils/logger");
const crypto  = require("crypto");

// ─── Helpers CSV ──────────────────────────────────────────────────────────────

const esc = (v) => {
  if (v == null) return '""';
  const s = String(v).replace(/"/g, '""');
  return `"${s}"`;
};

const fmtDate = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const fmtEur = (n) => {
  if (n == null) return "0,00";
  return parseFloat(n).toFixed(2).replace(".", ",");
};

function buildCsvRow(cols) {
  return cols.map(esc).join(";");
}

// ─── Filtres communs ──────────────────────────────────────────────────────────

function buildFilter(query) {
  const filter = {};

  if (query.startDate || query.endDate) {
    filter.dateEmission = {};
    if (query.startDate) filter.dateEmission.$gte = new Date(query.startDate);
    if (query.endDate)   filter.dateEmission.$lte = new Date(new Date(query.endDate).setHours(23, 59, 59));
  }

  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
  if (query.statut)         filter.statut        = query.statut;
  if (query.patientId)      filter.patientId      = query.patientId;

  if (query.exported === "true")  filter["accounting.exported"] = true;
  if (query.exported === "false") filter["accounting.exported"] = false;

  return filter;
}

// ─── Export CSV factures ──────────────────────────────────────────────────────

/**
 * Génère le CSV des factures selon les filtres.
 * Retourne la chaîne CSV complète.
 */
async function exportInvoicesCsv(filters = {}) {
  const filter = buildFilter(filters);

  const factures = await Facture.find(filter)
    .populate("transportId", "numero motif dateTransport typeTransport")
    .populate("patientId",   "nom prenom numeroPatient")
    .sort({ dateEmission: -1 })
    .lean();

  const headers = [
    "Numéro facture",
    "Date émission",
    "Échéance",
    "Patient",
    "N° Patient",
    "Transport lié",
    "Motif",
    "Type véhicule",
    "Distance (km)",
    "Montant base (€)",
    "Majoration (€)",
    "Montant total TTC (€)",
    "Taux CPAM (%)",
    "Part CPAM (€)",
    "Part patient (€)",
    "Statut facture",
    "Statut paiement",
    "Mode paiement",
    "Date paiement",
    "Référence Stripe",
    "Montant remboursé (€)",
    "Date remboursement",
    "Exporté comptabilité",
    "Date export",
    "ID batch export",
  ];

  const rows = factures.map((f) => {
    const pNom = f.patientId
      ? `${f.patientId.nom || ""} ${f.patientId.prenom || ""}`.trim()
      : `${f.patientNom || ""} ${f.patientPrenom || ""}`.trim();

    return buildCsvRow([
      f.numero,
      fmtDate(f.dateEmission),
      fmtDate(f.dateEcheance),
      pNom,
      f.patientId?.numeroPatient || "",
      f.transportId?.numero || "",
      f.motif || f.transportId?.motif || "",
      f.typeVehicule,
      fmtEur(f.distanceKm),
      fmtEur(f.montantBase),
      fmtEur(f.majoration),
      fmtEur(f.montantTotal),
      f.tauxPriseEnCharge || 65,
      fmtEur(f.montantCPAM),
      fmtEur(f.montantPatient),
      f.statut,
      f.paymentStatus || "UNPAID",
      f.modePaiement || "",
      fmtDate(f.datePaiement || f.payment?.paidAt),
      f.payment?.stripePaymentIntentId || f.referenceExterne || "",
      fmtEur(f.payment?.refundAmount || 0),
      fmtDate(f.payment?.refundedAt),
      f.accounting?.exported ? "Oui" : "Non",
      fmtDate(f.accounting?.exportedAt),
      f.accounting?.exportBatchId || "",
    ]);
  });

  const bom  = "﻿"; // BOM UTF-8 pour Excel
  const csv  = bom + [buildCsvRow(headers), ...rows].join("\r\n");

  logger.info("[accountingExport] CSV factures généré", { count: factures.length });
  return { csv, count: factures.length };
}

// ─── Export CSV paiements ─────────────────────────────────────────────────────

/**
 * Génère le CSV des paiements (uniquement les factures avec paiement Stripe).
 */
async function exportPaymentsCsv(filters = {}) {
  const filter = buildFilter(filters);
  // Uniquement les factures avec un PaymentIntent
  filter["payment.stripePaymentIntentId"] = { $ne: null };

  const factures = await Facture.find(filter)
    .populate("patientId", "nom prenom numeroPatient")
    .sort({ dateEmission: -1 })
    .lean();

  const headers = [
    "Numéro facture",
    "Date paiement",
    "Patient",
    "N° Patient",
    "Montant payé (€)",
    "Montant total TTC (€)",
    "Devise",
    "Statut paiement",
    "Payment Intent ID",
    "Charge ID",
    "URL reçu Stripe",
    "Montant remboursé (€)",
    "ID remboursement Stripe",
    "Date remboursement",
    "Motif remboursement",
    "Tentatives paiement",
    "Motif échec",
  ];

  const rows = factures.map((f) => {
    const pNom = f.patientId
      ? `${f.patientId.nom || ""} ${f.patientId.prenom || ""}`.trim()
      : `${f.patientNom || ""} ${f.patientPrenom || ""}`.trim();

    return buildCsvRow([
      f.numero,
      fmtDate(f.payment?.paidAt || f.datePaiement),
      pNom,
      f.patientId?.numeroPatient || "",
      fmtEur(f.montantPatient || f.montantTotal),
      fmtEur(f.montantTotal),
      "EUR",
      f.paymentStatus || "UNPAID",
      f.payment?.stripePaymentIntentId || "",
      f.payment?.stripeChargeId || "",
      f.payment?.stripeReceiptUrl || "",
      fmtEur(f.payment?.refundAmount || 0),
      f.payment?.stripeRefundId || "",
      fmtDate(f.payment?.refundedAt),
      f.payment?.refundReason || "",
      f.payment?.attempts || 0,
      f.payment?.failureReason || "",
    ]);
  });

  const bom = "﻿";
  const csv = bom + [buildCsvRow(headers), ...rows].join("\r\n");

  logger.info("[accountingExport] CSV paiements généré", { count: factures.length });
  return { csv, count: factures.length };
}

// ─── Batch export ─────────────────────────────────────────────────────────────

/**
 * Marque des factures comme exportées et génère un batch ID.
 * invoiceIds : tableau d'ObjectId ou strings
 */
async function markInvoicesAsExported(invoiceIds, user) {
  const batchId    = crypto.randomUUID().slice(0, 8).toUpperCase();
  const exportedAt = new Date();

  const result = await Facture.updateMany(
    { _id: { $in: invoiceIds } },
    {
      $set: {
        "accounting.exported":      true,
        "accounting.exportedAt":    exportedAt,
        "accounting.exportBatchId": batchId,
      },
      $push: {
        history: {
          action:  "INVOICE_EXPORTED",
          from:    "",
          to:      "",
          byEmail: user?.email || "système",
          at:      exportedAt,
          reason:  `Export batch ${batchId}`,
        },
      },
    },
  );

  logger.info("[accountingExport] Factures marquées exportées", {
    count: result.modifiedCount, batchId, user: user?.email,
  });

  return { batchId, count: result.modifiedCount };
}

/**
 * Génère un batch comptable complet : CSV + marquage comme exportées.
 */
async function generateAccountingBatch(filters, user) {
  const filter = buildFilter(filters);
  // Seulement les payées non encore exportées
  filter.paymentStatus         = "SUCCEEDED";
  filter["accounting.exported"] = false;

  const factures = await Facture.find(filter).lean();
  if (factures.length === 0) {
    return { csv: null, count: 0, batchId: null, message: "Aucune facture non exportée trouvée" };
  }

  const ids = factures.map((f) => f._id);
  const { batchId }     = await markInvoicesAsExported(ids, user);
  const { csv, count }  = await exportInvoicesCsv({
    ...filters,
    exported: "true",
  });

  return { csv, count, batchId };
}

module.exports = {
  exportInvoicesCsv,
  exportPaymentsCsv,
  markInvoicesAsExported,
  generateAccountingBatch,
};
