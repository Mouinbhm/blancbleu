/**
 * BlancBleu — Contrôleur Comptabilité
 * Agrège CA (factures), salaires (personnel), maintenances, carburant (transports).
 */
const Facture     = require("../models/Facture");
const Personnel   = require("../models/Personnel");
const Maintenance = require("../models/Maintenance");
const Transport   = require("../models/Transport");

// Taux URSSAF simplifiés
const TAUX_COT_SALARIALES = 0.23;
const TAUX_COT_PATRONALES = 0.42;

const PRIX_CARBURANT = {
  Diesel:     1.75,
  Essence:    1.85,
  Electrique: 0.20,
  GPL:        0.95,
  Hybride:    1.40,
  Hydrogène:  0.00,
};

const CONSO_DEFAUT = 8; // L/100km utilisé si consommationL100 non renseigné

// Distance orthodromique (Haversine) en km entre deux points GPS
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const getDashboard = async (req, res) => {
  try {
    const annee = parseInt(req.query.annee) || new Date().getFullYear();
    const mois  = parseInt(req.query.mois)  || (new Date().getMonth() + 1);

    const debutMois  = new Date(annee, mois - 1, 1);
    const finMois    = new Date(annee, mois, 0, 23, 59, 59);
    const debutAnnee = new Date(annee, 0, 1);
    const finAnnee   = new Date(annee, 11, 31, 23, 59, 59);

    // ── CA du mois ──────────────────────────────────────────────────────────
    // CA facturé : factures émises ce mois (accrual — hors annulées)
    const facturesMois = await Facture.find({
      dateEmission: { $gte: debutMois, $lte: finMois },
      statut: { $ne: "annulee" },
    });
    const caFacture     = facturesMois.reduce((s, f) => s + (f.montantTotal || 0), 0);
    const caPartCPAM    = facturesMois.reduce((s, f) => s + (f.montantCPAM || 0), 0);
    const caPartPatient = facturesMois.reduce((s, f) => s + (f.montantPatient || 0), 0);

    // CA encaissé : factures avec statut "payee" (source de vérité),
    // datePaiement ce mois ou, si absent, dateEmission ce mois
    const STATUTS_PAYES = ["payee", "remboursee", "partiellement_remboursee"];
    const encaissementsMois = await Facture.find({
      statut: { $in: STATUTS_PAYES },
      $or: [
        { datePaiement: { $gte: debutMois, $lte: finMois } },
        { datePaiement: null, dateEmission: { $gte: debutMois, $lte: finMois } },
      ],
    });
    const caEncaisse = encaissementsMois.reduce((s, f) => s + (f.montantTotal || 0), 0);

    // Pour les alertes et le résultat, on utilise le CA encaissé s'il est non nul
    // sinon le CA facturé (rétrocompatibilité)
    const caTotal = caEncaisse > 0 ? caEncaisse : caFacture;

    // ── CA par mois (12 mois) ────────────────────────────────────────────────
    const facturesAnnee = await Facture.find({
      dateEmission: { $gte: debutAnnee, $lte: finAnnee },
      statut: { $ne: "annulee" },
    });
    const caParMois = Array(12).fill(0);
    facturesAnnee.forEach((f) => {
      caParMois[new Date(f.dateEmission).getMonth()] += f.montantTotal || 0;
    });

    // ── Salaires ─────────────────────────────────────────────────────────────
    const personnels = await Personnel.find({ actif: true });
    const masseSalariale        = personnels.reduce((s, p) => s + (p.salaireBrut || 0), 0);
    const cotisationsSalariales = Math.round(masseSalariale * TAUX_COT_SALARIALES * 100) / 100;
    const cotisationsPatronales = Math.round(masseSalariale * TAUX_COT_PATRONALES * 100) / 100;
    const coutTotalEmployeur    = Math.round((masseSalariale + cotisationsPatronales) * 100) / 100;

    // ── Maintenances du mois ─────────────────────────────────────────────────
    const maintenancesMois = await Maintenance.find({
      dateDebut: { $gte: debutMois, $lte: finMois },
      statut: { $ne: "annulé" },
    });
    const totalMaintenances = maintenancesMois.reduce((s, m) => s + (m.cout || 0), 0);

    // ── Carburant — calculé depuis les transports terminés du mois ───────────
    const transportsTermines = await Transport.find({
      statut: { $in: ["COMPLETED", "BILLED"] },
      dateTransport: { $gte: debutMois, $lte: finMois },
      deletedAt: null,
    }).populate("vehicule", "consommationL100 typeEnergie nom immatriculation");

    let totalCarburant      = 0;
    let distanceTotaleKm    = 0;
    let nbSansConsommation  = 0;
    let nbSansCoordonnees   = 0;
    const detailCarburant   = [];
    const vehiculesSansInfo = new Set();

    transportsTermines.forEach((t) => {
      const v = t.vehicule;

      // Distance : Haversine si coordonnées disponibles
      const dep  = t.adresseDepart?.coordonnees;
      const dest = t.adresseDestination?.coordonnees;
      let distKm = 0;
      if (dep?.lat && dep?.lng && dest?.lat && dest?.lng) {
        distKm = haversineKm(dep.lat, dep.lng, dest.lat, dest.lng);
        // Aller-retour → doubler
        if (t.allerRetour) distKm *= 2;
      } else {
        nbSansCoordonnees++;
      }

      if (!v || distKm === 0) return;

      const usedDefault    = !v.consommationL100;
      const consommation   = v.consommationL100 || CONSO_DEFAUT;
      const typeEnergie    = v.typeEnergie || "Diesel";
      const prixLitre      = PRIX_CARBURANT[typeEnergie] ?? 1.75;

      if (usedDefault) {
        nbSansConsommation++;
        vehiculesSansInfo.add(v.nom || v.immatriculation || String(v._id));
      }

      const litres = (distKm / 100) * consommation;
      const cout   = Math.round(litres * prixLitre * 100) / 100;

      totalCarburant   += cout;
      distanceTotaleKm += distKm;

      detailCarburant.push({
        transportId:  t._id,
        vehicule:     v.nom || v.immatriculation || "—",
        typeEnergie,
        distanceKm:   Math.round(distKm * 10) / 10,
        consommation,
        litres:       Math.round(litres * 100) / 100,
        prixLitre,
        cout,
        usedDefault,
      });
    });

    totalCarburant   = Math.round(totalCarburant   * 100) / 100;
    distanceTotaleKm = Math.round(distanceTotaleKm * 10)  / 10;

    // Prix moyen pondéré
    const prixMoyen = detailCarburant.length > 0
      ? Math.round(
          (detailCarburant.reduce((s, d) => s + d.prixLitre, 0) / detailCarburant.length) * 100
        ) / 100
      : 1.75;

    const carburantMeta = {
      nbTransports:        transportsTermines.length,
      nbCalcules:          detailCarburant.length,
      nbSansCoordonnees,
      nbSansConsommation,
      vehiculesSansInfo:   Array.from(vehiculesSansInfo),
      distanceTotaleKm,
      prixMoyen,
      detail:              detailCarburant,
    };

    // ── Charges totales du mois ──────────────────────────────────────────────
    const totalCharges = Math.round(
      (masseSalariale + cotisationsPatronales + totalMaintenances + totalCarburant) * 100
    ) / 100;

    const resultatNet = Math.round((caTotal - totalCharges) * 100) / 100;
    const tauxMarge   = totalCharges > 0 ? Math.round((resultatNet / totalCharges) * 100 * 10) / 10 : 0;

    // ── Carburant par mois (pour le graphique) ───────────────────────────────
    const transportsAnnee = await Transport.find({
      statut: { $in: ["COMPLETED", "BILLED"] },
      dateTransport: { $gte: debutAnnee, $lte: finAnnee },
      deletedAt: null,
    }).populate("vehicule", "consommationL100 typeEnergie");

    const carburantParMois = Array(12).fill(0);
    transportsAnnee.forEach((t) => {
      const dep  = t.adresseDepart?.coordonnees;
      const dest = t.adresseDestination?.coordonnees;
      if (!dep?.lat || !dep?.lng || !dest?.lat || !dest?.lng) return;
      const v = t.vehicule;
      if (!v) return;
      let distKm = haversineKm(dep.lat, dep.lng, dest.lat, dest.lng);
      if (t.allerRetour) distKm *= 2;
      const consommation = v.consommationL100 || CONSO_DEFAUT;
      const prixLitre    = PRIX_CARBURANT[v.typeEnergie || "Diesel"] ?? 1.75;
      const cout = (distKm / 100) * consommation * prixLitre;
      const idx  = new Date(t.dateTransport).getMonth();
      carburantParMois[idx] += cout;
    });

    // ── Maintenances par mois ────────────────────────────────────────────────
    const maintenancesAnnee = await Maintenance.find({
      dateDebut: { $gte: debutAnnee, $lte: finAnnee },
      statut: { $ne: "annulé" },
    });
    const maintParMois = Array(12).fill(0);
    maintenancesAnnee.forEach((m) => {
      maintParMois[new Date(m.dateDebut).getMonth()] += m.cout || 0;
    });

    const chargesParMois = Array(12).fill(0).map((_, i) => {
      const fixes = masseSalariale + cotisationsPatronales;
      return Math.round((fixes + maintParMois[i] + (Math.round(carburantParMois[i] * 100) / 100)) * 100) / 100;
    });

    // ── Récap annuel ─────────────────────────────────────────────────────────
    const recapAnnuel = Array(12).fill(null).map((_, i) => {
      const ca  = Math.round(caParMois[i] * 100) / 100;
      const ch  = chargesParMois[i];
      const res = Math.round((ca - ch) * 100) / 100;
      const marge = ch > 0 ? Math.round((res / ch) * 100 * 10) / 10 : null;
      return { mois: i + 1, ca, charges: ch, resultat: res, marge };
    });

    // ── URSSAF ───────────────────────────────────────────────────────────────
    const echeanceJour = new Date(annee, mois, 15);
    const urssaf = {
      masseSalariale,
      cotisationsSalariales,
      salaireNet: Math.round((masseSalariale - cotisationsSalariales) * 100) / 100,
      cotisationsPatronales,
      coutTotalEmployeur,
      statut: "a_payer",
      echeance: echeanceJour.toISOString().slice(0, 10),
    };

    // ── Alertes ──────────────────────────────────────────────────────────────
    const alertes = [];
    if (resultatNet < 0) {
      alertes.push({
        type: "danger",
        message: `Déficit ce mois : ${resultatNet.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`,
      });
    }
    const facturesEnAttente = facturesMois.filter((f) => ["en_attente", "emise"].includes(f.statut));
    if (facturesEnAttente.length > 0) {
      alertes.push({
        type: "warning",
        message: `${facturesEnAttente.length} facture(s) en attente de paiement`,
      });
    }
    const moisSuivant = mois === 12 ? 1 : mois + 1;
    const anneeSuivante = mois === 12 ? annee + 1 : annee;
    alertes.push({
      type: "warning",
      message: `Déclaration URSSAF à payer avant le 15/${String(moisSuivant).padStart(2, "0")}/${anneeSuivante}`,
    });
    if (nbSansConsommation > 0) {
      alertes.push({
        type: "warning",
        message: `Consommation non renseignée sur ${nbSansConsommation} véhicule(s) — 8L/100km utilisé par défaut`,
      });
    }
    const toutesPayees = facturesMois.length > 0 && facturesMois.every((f) => f.statut === "payee");
    if (toutesPayees) {
      alertes.push({ type: "success", message: "Taux recouvrement CPAM : 100% ✅" });
    }

    const moisNom = new Date(annee, mois - 1, 1).toLocaleDateString("fr-FR", { month: "long" });

    res.json({
      periode: { annee, mois, moisNom },
      ca: {
        total:       Math.round(caTotal * 100) / 100,
        facture:     Math.round(caFacture * 100) / 100,
        encaisse:    Math.round(caEncaisse * 100) / 100,
        partCPAM:    Math.round(caPartCPAM * 100) / 100,
        partPatient: Math.round(caPartPatient * 100) / 100,
        parMois:     caParMois.map((v) => Math.round(v * 100) / 100),
      },
      charges: {
        salaires:       Math.round(masseSalariale * 100) / 100,
        urssaf:         cotisationsPatronales,
        maintenances:   Math.round(totalMaintenances * 100) / 100,
        carburant:      totalCarburant,
        carburantMeta,
        total:          totalCharges,
        parMois:        chargesParMois,
      },
      urssaf,
      recapAnnuel,
      resultatNet,
      tauxMarge,
      alertes,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Export CSV ───────────────────────────────────────────────────────────────

const exportService = require("../services/accountingExportService");
const { audit }     = require("../services/auditService");

const exportInvoicesCsv = async (req, res) => {
  try {
    const { csv, count } = await exportService.exportInvoicesCsv(req.query);
    await audit.accountingExportCree(req.user, "invoices", count);

    const date = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="factures-${date}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const exportPaymentsCsv = async (req, res) => {
  try {
    const { csv, count } = await exportService.exportPaymentsCsv(req.query);
    await audit.accountingExportCree(req.user, "payments", count);

    const date = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="paiements-${date}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const exportBatch = async (req, res) => {
  try {
    const result = await exportService.generateAccountingBatch(req.query, req.user);
    if (!result.csv) return res.json({ message: result.message, count: 0 });

    await audit.accountingExportCree(req.user, "batch", result.count);

    const date = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="batch-${result.batchId}-${date}.csv"`);
    res.send(result.csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getDashboard, exportInvoicesCsv, exportPaymentsCsv, exportBatch };
