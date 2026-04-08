/**
 * BlancBleu — Routes Audit
 * GET /api/audit          → liste des logs
 * GET /api/audit/:id      → détail d'un log
 * GET /api/audit/stats    → statistiques
 */
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const AuditLog = require("../models/AuditLog");

// ─── GET /api/audit ───────────────────────────────────────────────────────────
router.get("/", protect, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      action,
      origine,
      ressourceId,
      utilisateurId,
      succes,
      dateDebut,
      dateFin,
    } = req.query;

    const filtre = {};
    if (action) filtre.action = action;
    if (origine) filtre.origine = origine;
    if (ressourceId) filtre["ressource.id"] = ressourceId;
    if (utilisateurId) filtre["utilisateur.id"] = utilisateurId;
    if (succes !== undefined) filtre.succes = succes === "true";
    if (dateDebut || dateFin) {
      filtre.createdAt = {};
      if (dateDebut) filtre.createdAt.$gte = new Date(dateDebut);
      if (dateFin) filtre.createdAt.$lte = new Date(dateFin);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filtre)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean(),
      AuditLog.countDocuments(filtre),
    ]);

    res.json({
      logs,
      total,
      pages: Math.ceil(total / limit),
      page: parseInt(page),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/audit/stats ─────────────────────────────────────────────────────
router.get("/stats", protect, async (req, res) => {
  try {
    const hier = new Date(Date.now() - 24 * 3600 * 1000);

    const [totalLogs, logsAujourdhui, parOrigine, parAction, erreurs] =
      await Promise.all([
        AuditLog.countDocuments(),
        AuditLog.countDocuments({ createdAt: { $gte: hier } }),
        AuditLog.aggregate([
          { $group: { _id: "$origine", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        AuditLog.aggregate([
          { $group: { _id: "$action", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        AuditLog.countDocuments({ succes: false }),
      ]);

    // Timeline 7 derniers jours
    const timeline = await AuditLog.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          ia: { $sum: { $cond: [{ $eq: ["$origine", "IA"] }, 1, 0] } },
          humain: { $sum: { $cond: [{ $eq: ["$origine", "HUMAIN"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      totalLogs,
      logsAujourdhui,
      erreurs,
      parOrigine: parOrigine.reduce(
        (acc, o) => ({ ...acc, [o._id]: o.count }),
        {},
      ),
      parAction,
      timeline,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/audit/intervention/:id ─────────────────────────────────────────
// Historique complet d'une intervention
router.get("/intervention/:id", protect, async (req, res) => {
  try {
    const logs = await AuditLog.find({ "ressource.id": req.params.id })
      .sort({ createdAt: 1 })
      .lean();
    res.json({ logs, total: logs.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/audit/:id ───────────────────────────────────────────────────────
router.get("/:id", protect, async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id).lean();
    if (!log) return res.status(404).json({ message: "Log introuvable" });
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
