/**
 * BlancBleu — Service PDF Facturation v3.0
 *
 * Génère les PDF de facture et de reçu avec pdfkit.
 * Aucune donnée sensible (carte bancaire) n'est incluse.
 */

const PDFDocument = require("pdfkit");

const PRIMARY    = "#1D6EF5";
const DARK       = "#0f172a";
const SLATE      = "#475569";
const LIGHT      = "#f8fafc";
const GREEN      = "#16a34a";
const RED        = "#dc2626";
const AMBER      = "#d97706";

const COMPANY = {
  name:   "Ambulances Blanc Bleu",
  sub:    "Transport Sanitaire Non Urgent",
  addr1:  "59 Boulevard Madeleine",
  addr2:  "06000 Nice",
  siret:  "000 000 000 00000",
  tel:    "+33 4 XX XX XX XX",
  email:  "facturation@blancbleu.fr",
};

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const fmtEur = (n) => {
  const v = parseFloat(n) || 0;
  return `${v.toFixed(2).replace(".", ",")} €`;
};

// ─── Helpers dessin ────────────────────────────────────────────────────────────

function drawHLine(doc, y, x1 = 50, x2 = 545, color = "#e2e8f0") {
  doc.strokeColor(color).lineWidth(1).moveTo(x1, y).lineTo(x2, y).stroke();
}

function fillRect(doc, x, y, w, h, color) {
  doc.rect(x, y, w, h).fill(color);
}

function label(doc, text, x, y, color = SLATE, size = 8) {
  doc.font("Helvetica").fontSize(size).fillColor(color).text(text, x, y);
}

function value(doc, text, x, y, color = DARK, size = 11, bold = false) {
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(color).text(text, x, y);
}

// ─── En-tête BlancBleu ────────────────────────────────────────────────────────
function drawHeader(doc, title, subtitle) {
  // Bande bleue en haut
  fillRect(doc, 0, 0, 595, 70, PRIMARY);

  // Nom entreprise
  doc.font("Helvetica-Bold").fontSize(22).fillColor("#fff").text(COMPANY.name, 50, 20);
  doc.font("Helvetica").fontSize(9).fillColor("rgba(255,255,255,0.8)").text(COMPANY.sub, 50, 46);

  // Titre document (à droite)
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#fff")
    .text(title, 0, 20, { align: "right", width: 545 });
  doc.font("Helvetica").fontSize(9).fillColor("rgba(255,255,255,0.8)")
    .text(subtitle, 0, 46, { align: "right", width: 545 });

  doc.moveDown(0.5);
}

// ─── Bloc info 2 colonnes ─────────────────────────────────────────────────────
function drawInfoGrid(doc, left, right, startY) {
  const colW = 220;
  const boxH = Math.max(
    left.items.length * 20 + 30,
    right.items.length * 20 + 30,
  );

  // Colonne gauche
  fillRect(doc, 50, startY, colW, boxH, LIGHT);
  doc.strokeColor("#e2e8f0").rect(50, startY, colW, boxH).stroke();
  doc.font("Helvetica-Bold").fontSize(8).fillColor(SLATE)
    .text(left.title.toUpperCase(), 62, startY + 10);
  left.items.forEach(([k, v], i) => {
    label(doc, k + " :", 62, startY + 28 + i * 20);
    value(doc, v || "—", 140, startY + 28 + i * 20, DARK, 10);
  });

  // Colonne droite
  const rx = 325;
  fillRect(doc, rx, startY, colW, boxH, LIGHT);
  doc.strokeColor("#e2e8f0").rect(rx, startY, colW, boxH).stroke();
  doc.font("Helvetica-Bold").fontSize(8).fillColor(SLATE)
    .text(right.title.toUpperCase(), rx + 12, startY + 10);
  right.items.forEach(([k, v], i) => {
    label(doc, k + " :", rx + 12, startY + 28 + i * 20);
    value(doc, v || "—", rx + 100, startY + 28 + i * 20, DARK, 10);
  });

  return startY + boxH + 16;
}

// ─── Tableau lignes ────────────────────────────────────────────────────────────
function drawTable(doc, headers, rows, totals, startY) {
  const colX   = [50, 190, 290, 370, 455];
  const rowH   = 22;
  const tableW = 495;

  // En-tête tableau
  fillRect(doc, 50, startY, tableW, rowH, DARK);
  headers.forEach((h, i) => {
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#fff")
      .text(h.toUpperCase(), colX[i] + 4, startY + 7, { width: 95, align: "left" });
  });

  // Lignes
  rows.forEach((row, ri) => {
    const bg = ri % 2 === 0 ? "#fff" : LIGHT;
    fillRect(doc, 50, startY + rowH + ri * rowH, tableW, rowH, bg);
    row.forEach((cell, ci) => {
      const align = ci > 0 ? "right" : "left";
      const x     = ci > 0 ? colX[ci] : colX[ci] + 4;
      const w     = ci > 0 ? colX[ci + 1] - colX[ci] - 8 : 130;
      doc.font("Helvetica").fontSize(9).fillColor(DARK)
        .text(String(cell || "—"), x, startY + rowH + ri * rowH + 7, { width: w, align });
    });
  });

  // Totaux
  const ty = startY + rowH * (rows.length + 1);
  fillRect(doc, 50, ty, tableW, rowH + 4, "#EFF6FF");
  doc.strokeColor(PRIMARY).rect(50, ty, tableW, rowH + 4).stroke();
  totals.forEach(([k, v], i) => {
    const x = i === 0 ? 54 : 370;
    doc.font("Helvetica-Bold").fontSize(10)
      .fillColor(i === 0 ? SLATE : PRIMARY)
      .text(k + " : " + v, x, ty + 8, { width: 160 });
  });

  return ty + rowH + 20;
}

// ─── Pied de page ─────────────────────────────────────────────────────────────
function drawFooter(doc, pageNum = 1) {
  const y = doc.page.height - 55;
  drawHLine(doc, y, 50, 545, "#e2e8f0");
  doc.font("Helvetica").fontSize(7.5).fillColor("#94a3b8")
    .text(
      `${COMPANY.name} · ${COMPANY.addr1}, ${COMPANY.addr2} · SIRET : ${COMPANY.siret} · ${COMPANY.email}`,
      50, y + 8, { align: "center", width: 495 },
    )
    .text("En cas de litige, contactez notre service facturation avant toute action.", 50, y + 20, {
      align: "center", width: 495,
    });
}

// ─── PDF Facture ──────────────────────────────────────────────────────────────

/**
 * Génère le PDF d'une facture et le pipe sur res.
 * @param {Object} facture  — document Mongoose peuplé
 * @param {Object} res      — Express response
 */
function generateInvoicePdf(facture, res) {
  const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="facture-${facture.numero}.pdf"`,
  );
  doc.pipe(res);

  // En-tête
  drawHeader(doc, "FACTURE", facture.numero);

  // Infos entreprise + facture
  let y = 100;
  fillRect(doc, 50, y, 495, 55, LIGHT);
  doc.strokeColor("#e2e8f0").rect(50, y, 495, 55).stroke();

  doc.font("Helvetica").fontSize(9).fillColor(SLATE).text(COMPANY.addr1, 62, y + 8);
  doc.text(COMPANY.addr2, 62, y + 20);
  doc.text(`SIRET : ${COMPANY.siret}`, 62, y + 32);
  doc.text(`Tél : ${COMPANY.tel}`, 62, y + 44);

  // Statut badge
  const statutColor = facture.statut === "payee" ? GREEN
                    : facture.statut === "payment_failed" ? RED
                    : AMBER;
  fillRect(doc, 380, y + 12, 115, 20, statutColor);
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#fff")
    .text(facture.statutLabel?.toUpperCase() || facture.statut.toUpperCase(), 385, y + 18, {
      width: 105, align: "center",
    });

  doc.font("Helvetica").fontSize(9).fillColor(SLATE)
    .text(`Émise le : ${fmtDate(facture.dateEmission)}`, 380, y + 36)
    .text(`Échéance : ${fmtDate(facture.dateEcheance)}`, 380, y + 48);

  y += 72;

  // Grille info
  const transport = facture.transportId;
  const patient   = facture.patientId;
  const pNom      = patient ? `${patient.nom || ""} ${patient.prenom || ""}`.trim()
                             : `${facture.patientNom || ""} ${facture.patientPrenom || ""}`.trim();

  y = drawInfoGrid(doc,
    {
      title: "Patient",
      items: [
        ["Nom",        pNom || "—"],
        ["N° Patient", patient?.numeroPatient || "—"],
        ["N° Sécu",    facture.patientNumeroSecu || "—"],
      ],
    },
    {
      title: "Transport lié",
      items: [
        ["N° Transport", (transport?.numero || "—")],
        ["Date",         fmtDate(transport?.dateTransport)],
        ["Véhicule",     facture.typeVehicule || "—"],
        ["Distance",     facture.distanceKm ? `${facture.distanceKm} km` : "—"],
      ],
    },
    y,
  );

  // Adresses
  if (transport?.adresseDepart || transport?.adresseDestination) {
    fillRect(doc, 50, y, 495, 40, LIGHT);
    doc.strokeColor("#e2e8f0").rect(50, y, 495, 40).stroke();
    const dep  = transport.adresseDepart;
    const dest = transport.adresseDestination;
    const dStr = dep  ? `${dep.rue || ""}, ${dep.ville || ""}`.trim().replace(/^,\s*/, "") : "—";
    const aStr = dest ? `${dest.rue || ""}, ${dest.ville || ""}`.trim().replace(/^,\s*/, "")
                        + (dest.nom ? ` (${dest.nom})` : "") : "—";
    doc.font("Helvetica-Bold").fontSize(8).fillColor(SLATE).text("DÉPART", 62, y + 8);
    doc.font("Helvetica").fontSize(9).fillColor(DARK).text(dStr, 62, y + 20);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(SLATE).text("DESTINATION", 290, y + 8);
    doc.font("Helvetica").fontSize(9).fillColor(DARK).text(aStr, 290, y + 20);
    y += 56;
  }

  // Motif
  if (facture.motif) {
    doc.font("Helvetica").fontSize(9).fillColor(SLATE).text(`Motif : ${facture.motif}`, 50, y);
    y += 20;
  }

  // Tableau de prestation
  y = drawTable(
    doc,
    ["Désignation", "Base", "Majoration", "Total TTC", "Part patient"],
    [
      [
        facture.motif || "Transport sanitaire",
        fmtEur(facture.montantBase),
        fmtEur(facture.majoration),
        fmtEur(facture.montantTotal),
        fmtEur(facture.montantPatient),
      ],
    ],
    [
      ["CPAM (" + (facture.tauxPriseEnCharge || 65) + "%)", fmtEur(facture.montantCPAM)],
      ["TOTAL TTC", fmtEur(facture.montantTotal)],
    ],
    y,
  );

  // Paiement
  if (facture.statut === "payee") {
    fillRect(doc, 50, y, 495, 28, "#f0fdf4");
    doc.strokeColor("#bbf7d0").rect(50, y, 495, 28).stroke();
    doc.font("Helvetica-Bold").fontSize(10).fillColor(GREEN)
      .text(`✓ PAYÉE le ${fmtDate(facture.datePaiement)}`, 62, y + 9);
    if (facture.payment?.stripeReceiptUrl) {
      doc.font("Helvetica").fontSize(8).fillColor(SLATE)
        .text(`Reçu Stripe : ${facture.payment.stripeReceiptUrl}`, 62, y + 20);
    }
    y += 36;
  }

  // Aller-retour note
  if (facture.allerRetour) {
    doc.font("Helvetica").fontSize(8).fillColor(SLATE)
      .text("* Transport aller-retour — distance calculée × 2", 50, y);
    y += 16;
  }

  // Notes
  if (facture.notes) {
    fillRect(doc, 50, y, 495, 30, LIGHT);
    doc.strokeColor(PRIMARY).moveTo(50, y).lineTo(50, y + 30).lineWidth(3).stroke();
    doc.font("Helvetica").fontSize(8.5).fillColor(SLATE)
      .text(facture.notes, 60, y + 8, { width: 480 });
    y += 38;
  }

  // Mentions légales
  y = Math.max(y, doc.page.height - 120);
  drawHLine(doc, y, 50, 545);
  doc.font("Helvetica").fontSize(7.5).fillColor("#94a3b8")
    .text(
      "Conformément à la réglementation CPAM en vigueur (Arrêté du 23 septembre 2024). " +
      "En cas de non-paiement dans les délais, des pénalités de retard pourront être appliquées.",
      50, y + 8, { width: 495, align: "center" },
    );

  drawFooter(doc);
  doc.end();
}

// ─── PDF Reçu ─────────────────────────────────────────────────────────────────

/**
 * Génère le PDF du reçu de paiement et le pipe sur res.
 */
function generateReceiptPdf(facture, res) {
  if (facture.paymentStatus !== "SUCCEEDED") {
    throw new Error("Reçu disponible uniquement pour les factures payées");
  }

  const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="recu-${facture.numero}.pdf"`,
  );
  doc.pipe(res);

  // En-tête
  drawHeader(doc, "REÇU DE PAIEMENT", `Facture ${facture.numero}`);

  let y = 100;

  // Badge vert payé
  fillRect(doc, 50, y, 495, 50, "#f0fdf4");
  doc.strokeColor("#bbf7d0").rect(50, y, 495, 50).stroke();
  fillRect(doc, 62, y + 12, 160, 26, GREEN);
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#fff")
    .text("✓ PAIEMENT CONFIRMÉ", 68, y + 19, { width: 148, align: "center" });
  doc.font("Helvetica").fontSize(10).fillColor(GREEN)
    .text(`Payé le ${fmtDate(facture.payment?.paidAt || facture.datePaiement)}`, 235, y + 20);
  y += 68;

  // Grille infos
  const patient = facture.patientId;
  const pNom    = patient ? `${patient.nom || ""} ${patient.prenom || ""}`.trim()
                           : `${facture.patientNom || ""} ${facture.patientPrenom || ""}`.trim();

  y = drawInfoGrid(doc,
    {
      title: "Patient",
      items: [
        ["Nom",    pNom || "—"],
        ["N° Sécu",facture.patientNumeroSecu || "—"],
      ],
    },
    {
      title: "Facture",
      items: [
        ["Numéro",     facture.numero],
        ["Date ém.",   fmtDate(facture.dateEmission)],
        ["Date paie.", fmtDate(facture.payment?.paidAt || facture.datePaiement)],
      ],
    },
    y,
  );

  // Détail paiement
  const items = [
    ["Montant total TTC",        fmtEur(facture.montantTotal)],
    ["Part prise en charge CPAM",fmtEur(facture.montantCPAM)],
    ["Montant payé par le patient", fmtEur(facture.montantPatient)],
    ["Moyen de paiement",        "Carte bancaire (Stripe)"],
    ["Référence Stripe",         facture.payment?.stripePaymentIntentId || facture.referenceExterne || "—"],
    ["ID Charge",                facture.payment?.stripeChargeId || "—"],
  ];

  items.forEach(([k, v], i) => {
    const bg = i % 2 === 0 ? LIGHT : "#fff";
    fillRect(doc, 50, y + i * 24, 495, 24, bg);
    doc.strokeColor("#e2e8f0").rect(50, y + i * 24, 495, 24).stroke();
    doc.font("Helvetica-Bold").fontSize(9).fillColor(SLATE).text(k, 62, y + i * 24 + 8);
    doc.font("Helvetica").fontSize(9).fillColor(DARK)
      .text(String(v || "—"), 300, y + i * 24 + 8, { width: 238, align: "right" });
  });
  y += items.length * 24 + 16;

  // Lien reçu Stripe
  if (facture.payment?.stripeReceiptUrl) {
    fillRect(doc, 50, y, 495, 30, "#EFF6FF");
    doc.strokeColor(PRIMARY).rect(50, y, 495, 30).stroke();
    doc.font("Helvetica").fontSize(8.5).fillColor(PRIMARY)
      .text("Reçu Stripe en ligne (vérification) :", 62, y + 6);
    doc.font("Helvetica").fontSize(8).fillColor(SLATE)
      .text(facture.payment.stripeReceiptUrl, 62, y + 18, { width: 480 });
    y += 46;
  }

  // Remboursement éventuel
  if (facture.paymentStatus === "REFUNDED" || facture.paymentStatus === "PARTIALLY_REFUNDED") {
    fillRect(doc, 50, y, 495, 36, "#fef3c7");
    doc.strokeColor(AMBER).rect(50, y, 495, 36).stroke();
    doc.font("Helvetica-Bold").fontSize(9).fillColor(AMBER)
      .text(`⚠ Remboursement de ${fmtEur(facture.payment?.refundAmount)} effectué le ${fmtDate(facture.payment?.refundedAt)}`, 62, y + 8);
    doc.font("Helvetica").fontSize(8.5).fillColor(SLATE)
      .text(`Motif : ${facture.payment?.refundReason || "—"}`, 62, y + 22);
    y += 52;
  }

  drawFooter(doc);
  doc.end();
}

module.exports = { generateInvoicePdf, generateReceiptPdf };
