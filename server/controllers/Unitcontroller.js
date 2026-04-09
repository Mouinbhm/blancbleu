/**
 * BlancBleu — Controller Unités v3.0 — Mode Réel
 */
const Unit = require("../models/Unit");
const socketService = require("../services/socketService");
const lifecycle = require("../services/unitLifecycle");
const { audit } = require("../services/auditService");

// GET /api/units
const getUnits = async (req, res) => {
  try {
    const { statut, type, disponible } = req.query;
    const filtre = {};
    if (statut) filtre.statut = statut;
    if (type) filtre.type = type;
    if (disponible === "true") filtre.statut = "disponible";

    const units = await Unit.find(filtre)
      .populate(
        "interventionEnCours",
        "numero typeIncident priorite adresse statut",
      )
      .sort({ statut: 1, nom: 1 });
    res.json(units);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/units/stats
const getStats = async (req, res) => {
  try {
    const [total, disponibles, enMission, maintenance] = await Promise.all([
      Unit.countDocuments(),
      Unit.countDocuments({ statut: "disponible" }),
      Unit.countDocuments({ statut: "en_mission" }),
      Unit.countDocuments({ statut: "maintenance" }),
    ]);
    const parType = await Unit.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          disponibles: {
            $sum: { $cond: [{ $eq: ["$statut", "disponible"] }, 1, 0] },
          },
        },
      },
    ]);
    res.json({ total, disponibles, enMission, maintenance, parType });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/units/:id
const getUnit = async (req, res) => {
  try {
    const unit = await Unit.findById(req.params.id).populate(
      "interventionEnCours",
    );
    if (!unit) return res.status(404).json({ message: "Unité introuvable" });
    res.json(unit);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/units
const createUnit = async (req, res) => {
  try {
    const unit = await Unit.create(req.body);
    socketService.emitUnitStatusChanged({
      unite: unit,
      ancienStatut: null,
      nouveauStatut: unit.statut,
    });
    res.status(201).json(unit);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PUT /api/units/:id
const updateUnit = async (req, res) => {
  try {
    const ancienne = await Unit.findById(req.params.id);
    if (!ancienne) return res.status(404).json({ message: "Introuvable" });
    const unit = await Unit.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (ancienne.statut !== unit.statut) {
      socketService.emitUnitStatusChanged({
        unite: unit,
        ancienStatut: ancienne.statut,
        nouveauStatut: unit.statut,
      });
      await audit.uniteStatusChange(
        unit,
        ancienne.statut,
        unit.statut,
        req.user,
      );
    }
    res.json(unit);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE /api/units/:id
const deleteUnit = async (req, res) => {
  try {
    await Unit.findByIdAndDelete(req.params.id);
    res.json({ message: "Unité supprimée" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/units/:id/assign — Assigner à une intervention
const assignUnit = async (req, res) => {
  try {
    const { interventionId } = req.body;
    if (!interventionId)
      return res.status(400).json({ message: "interventionId requis" });
    const result = await lifecycle.assignerUnite(
      req.params.id,
      interventionId,
      { source: "MANUEL" },
    );
    res.json({ message: `${result.unit.nom} assignée`, ...result });
  } catch (err) {
    const code = err.message.includes("non disponible") ? 409 : 400;
    res.status(code).json({ message: err.message });
  }
};

// PATCH /api/units/:id/en-route
const marquerEnRoute = async (req, res) => {
  try {
    const { interventionId } = req.body;
    if (!interventionId)
      return res.status(400).json({ message: "interventionId requis" });
    const result = await lifecycle.marquerEnRoute(
      req.params.id,
      interventionId,
    );
    res.json({ message: "Unité en route", ...result });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PATCH /api/units/:id/on-site
const marquerSurPlace = async (req, res) => {
  try {
    const { interventionId, position } = req.body;
    if (!interventionId)
      return res.status(400).json({ message: "interventionId requis" });
    const result = await lifecycle.marquerSurPlace(
      req.params.id,
      interventionId,
      position,
    );
    res.json({ message: "Unité sur place", ...result });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PATCH /api/units/:id/transporting
const marquerTransport = async (req, res) => {
  try {
    const { interventionId, hopital } = req.body;
    if (!interventionId)
      return res.status(400).json({ message: "interventionId requis" });
    const result = await lifecycle.marquerTransport(
      req.params.id,
      interventionId,
      hopital,
    );
    res.json({ message: "Transport en cours", ...result });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PATCH /api/units/:id/complete — Fin mission + retour base
const terminerMission = async (req, res) => {
  try {
    const { interventionId } = req.body;
    if (!interventionId)
      return res.status(400).json({ message: "interventionId requis" });
    const result = await lifecycle.terminerMissionEtRetourBase(
      req.params.id,
      interventionId,
    );
    res.json({ message: "Mission terminée — unité retour base", ...result });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PATCH /api/units/:id/location — Mise à jour GPS temps réel
const updateLocation = async (req, res) => {
  try {
    const { lat, lng, vitesse, cap, adresse } = req.body;
    if (!lat || !lng)
      return res.status(400).json({ message: "lat et lng requis" });
    if (lat < -90 || lat > 90)
      return res.status(400).json({ message: "lat invalide" });
    if (lng < -180 || lng > 180)
      return res.status(400).json({ message: "lng invalide" });
    const unit = await lifecycle.updatePositionFromEvent(req.params.id, {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      vitesse,
      cap,
      adresse,
    });
    res.json({
      message: "Position mise à jour",
      position: unit.position,
      carburant: unit.carburant,
      kilometrage: unit.kilometrage,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/units/:id/statut
const updateStatut = async (req, res) => {
  try {
    const { statut } = req.body;
    const valides = [
      "disponible",
      "en_mission",
      "maintenance",
      "hors_service",
      "pause",
      "retour_base",
    ];
    if (!valides.includes(statut))
      return res
        .status(400)
        .json({ message: `Statut invalide. Valides: ${valides.join(", ")}` });
    const unit = await Unit.findById(req.params.id);
    if (!unit) return res.status(404).json({ message: "Introuvable" });
    const ancien = unit.statut;
    unit.statut = statut;
    unit.lastStatusChangeAt = new Date();
    await unit.save();
    socketService.emitUnitStatusChanged({
      unite: unit,
      ancienStatut: ancien,
      nouveauStatut: statut,
    });
    await audit.uniteStatusChange(unit, ancien, statut, req.user);
    res.json(unit);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getUnits,
  getStats,
  getUnit,
  createUnit,
  updateUnit,
  deleteUnit,
  assignUnit,
  marquerEnRoute,
  marquerSurPlace,
  marquerTransport,
  terminerMission,
  updateLocation,
  updateStatut,
};
