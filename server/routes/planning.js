/**
 * BlancBleu — Routes Planning Transport Sanitaire
 * GET /api/planning/daily    → transports du jour triés par heure
 * GET /api/planning/week     → transports de la semaine
 * GET /api/planning/vehicle/:id → planning d'un véhicule
 */
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const Transport = require("../models/Transport");
const Vehicle = require("../models/Vehicle");

// ── GET /api/planning/daily ───────────────────────────────────────────────────
// Planning du jour — tous les transports triés par heure de RDV
router.get("/daily", protect, async (req, res) => {
  try {
    const dateParam = req.query.date ? new Date(req.query.date) : new Date();
    const debut = new Date(dateParam);
    debut.setHours(0, 0, 0, 0);
    const fin = new Date(dateParam);
    fin.setHours(23, 59, 59, 999);

    const transports = await Transport.find({
      dateTransport: { $gte: debut, $lte: fin },
      deletedAt: null,
      statut: { $nin: ["CANCELLED"] },
    })
      .populate("vehicule", "nom type statut immatriculation")
      .populate("chauffeur", "nom prenom")
      .sort({ heureRDV: 1 });

    // Statistiques du jour
    const stats = {
      total: transports.length,
      assignes: transports.filter((t) => t.vehicule).length,
      enCours: transports.filter((t) =>
        [
          "EN_ROUTE_TO_PICKUP",
          "ARRIVED_AT_PICKUP",
          "PATIENT_ON_BOARD",
          "ARRIVED_AT_DESTINATION",
        ].includes(t.statut),
      ).length,
      completes: transports.filter((t) => t.statut === "COMPLETED").length,
      noShows: transports.filter((t) => t.statut === "NO_SHOW").length,
      sansVehicule: transports.filter(
        (t) =>
          !t.vehicule &&
          !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(t.statut),
      ).length,
    };

    res.json({
      date: debut.toISOString().slice(0, 10),
      stats,
      transports,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/planning/week ────────────────────────────────────────────────────
// Planning de la semaine courante (ou d'une date donnée)
router.get("/week", protect, async (req, res) => {
  try {
    const dateParam = req.query.date ? new Date(req.query.date) : new Date();

    // Lundi de la semaine
    const lundi = new Date(dateParam);
    const jour = lundi.getDay() || 7;
    lundi.setDate(lundi.getDate() - jour + 1);
    lundi.setHours(0, 0, 0, 0);

    const dimanche = new Date(lundi);
    dimanche.setDate(dimanche.getDate() + 6);
    dimanche.setHours(23, 59, 59, 999);

    const transports = await Transport.find({
      dateTransport: { $gte: lundi, $lte: dimanche },
      deletedAt: null,
      statut: { $nin: ["CANCELLED"] },
    })
      .populate("vehicule", "nom type")
      .sort({ dateTransport: 1, heureRDV: 1 });

    // Grouper par jour
    const parJour = {};
    transports.forEach((t) => {
      const key = t.dateTransport.toISOString().slice(0, 10);
      if (!parJour[key]) parJour[key] = [];
      parJour[key].push(t);
    });

    res.json({
      semaineDu: lundi.toISOString().slice(0, 10),
      semaineAu: dimanche.toISOString().slice(0, 10),
      total: transports.length,
      parJour,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/planning/vehicle/:id ─────────────────────────────────────────────
// Planning d'un véhicule spécifique pour un jour
router.get("/vehicle/:id", protect, async (req, res) => {
  try {
    const dateParam = req.query.date ? new Date(req.query.date) : new Date();
    const debut = new Date(dateParam);
    debut.setHours(0, 0, 0, 0);
    const fin = new Date(dateParam);
    fin.setHours(23, 59, 59, 999);

    const [vehicle, transports] = await Promise.all([
      Vehicle.findById(req.params.id).select("nom type statut immatriculation"),
      Transport.find({
        vehicule: req.params.id,
        dateTransport: { $gte: debut, $lte: fin },
        deletedAt: null,
        statut: { $nin: ["CANCELLED"] },
      }).sort({ heureRDV: 1 }),
    ]);

    if (!vehicle)
      return res.status(404).json({ message: "Véhicule introuvable" });

    res.json({
      vehicle,
      date: debut.toISOString().slice(0, 10),
      transports,
      nbTransports: transports.length,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/planning/unassigned ──────────────────────────────────────────────
// Transports planifiés sans véhicule assigné — vue prioritaire dispatcher
router.get("/unassigned", protect, async (req, res) => {
  try {
    const maintenant = new Date();

    const transports = await Transport.find({
      vehicule: null,
      deletedAt: null,
      statut: { $in: ["REQUESTED", "CONFIRMED", "SCHEDULED"] },
      dateTransport: { $gte: maintenant },
    })
      .sort({ dateTransport: 1, heureRDV: 1 })
      .limit(50);

    res.json({
      total: transports.length,
      transports,
      message:
        transports.length > 0
          ? `${transports.length} transport(s) sans véhicule`
          : "Tous les transports sont assignés",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
