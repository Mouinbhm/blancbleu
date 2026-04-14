/**
 * BlancBleu — Contrôleur Maintenances
 * Adapté transport sanitaire — utilise Vehicle au lieu de Unit
 */
const Maintenance = require("../models/Maintenance");
const Vehicle = require("../models/Vehicle"); // ← remplace Unit

const getMaintenances = async (req, res) => {
  try {
    const { statut, uniteId } = req.query;
    const filter = {};
    if (statut) filter.statut = statut;
    if (uniteId) filter.unite = uniteId;

    const maintenances = await Maintenance.find(filter)
      .populate("unite", "nom immatriculation type statut")
      .populate("responsable", "nom prenom")
      .sort({ dateDebut: -1 });

    res.json(maintenances);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMaintenance = async (req, res) => {
  try {
    const m = await Maintenance.findById(req.params.id)
      .populate("unite", "nom immatriculation type statut kilometrage")
      .populate("responsable", "nom prenom email");
    if (!m) return res.status(404).json({ message: "Maintenance introuvable" });
    res.json(m);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createMaintenance = async (req, res) => {
  try {
    const data = { ...req.body, responsable: req.user._id };
    const m = await Maintenance.create(data);

    // Passer le véhicule en maintenance si statut en-cours
    if (m.statut === "en-cours") {
      await Vehicle.findByIdAndUpdate(m.unite, { statut: "maintenance" });
    }

    const populated = await Maintenance.findById(m._id).populate(
      "unite",
      "nom immatriculation type",
    );

    res
      .status(201)
      .json({ message: "Maintenance planifiée", maintenance: populated });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const updateMaintenance = async (req, res) => {
  try {
    const m = await Maintenance.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("unite", "nom immatriculation type");
    if (!m) return res.status(404).json({ message: "Maintenance introuvable" });
    res.json({ message: "Maintenance mise à jour", maintenance: m });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const updateStatut = async (req, res) => {
  try {
    const { statut } = req.body;
    const valides = ["planifié", "en-cours", "terminé", "annulé"];
    if (!valides.includes(statut)) {
      return res
        .status(400)
        .json({ message: `Statut invalide. Valeurs : ${valides.join(", ")}` });
    }

    const m = await Maintenance.findById(req.params.id);
    if (!m) return res.status(404).json({ message: "Maintenance introuvable" });

    const ancienStatut = m.statut;
    m.statut = statut;
    if (statut === "terminé") m.dateFin = new Date();
    await m.save();

    // Remettre le véhicule disponible si maintenance terminée/annulée
    if (
      ["terminé", "annulé"].includes(statut) &&
      ["en-cours", "planifié"].includes(ancienStatut)
    ) {
      await Vehicle.findByIdAndUpdate(m.unite, { statut: "disponible" });
    }
    // Passer en maintenance si en-cours
    if (statut === "en-cours") {
      await Vehicle.findByIdAndUpdate(m.unite, { statut: "maintenance" });
    }

    res.json({ message: "Statut mis à jour", maintenance: m });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteMaintenance = async (req, res) => {
  try {
    await Maintenance.findByIdAndDelete(req.params.id);
    res.json({ message: "Maintenance supprimée" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getStats = async (req, res) => {
  try {
    const [total, planifiees, enCours, terminees] = await Promise.all([
      Maintenance.countDocuments(),
      Maintenance.countDocuments({ statut: "planifié" }),
      Maintenance.countDocuments({ statut: "en-cours" }),
      Maintenance.countDocuments({ statut: "terminé" }),
    ]);
    res.json({ total, planifiees, enCours, terminees });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getMaintenances,
  getMaintenance,
  createMaintenance,
  updateMaintenance,
  updateStatut,
  deleteMaintenance,
  getStats,
};
