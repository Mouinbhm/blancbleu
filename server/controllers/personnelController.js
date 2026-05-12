/**
 * BlancBleu — Contrôleur Personnel
 * Adapté transport sanitaire — utilise Vehicle au lieu de Unit
 */
const Personnel = require("../models/Personnel");
const Vehicle   = require("../models/Vehicle");
const bcrypt    = require("bcryptjs");

const getPersonnel = async (req, res) => {
  try {
    const { statut, role } = req.query;
    const filter = { actif: true };
    if (statut) filter.statut = statut;
    if (role) filter.role = role;

    const personnel = await Personnel.find(filter)
      .populate("uniteAssignee", "nom immatriculation statut type")
      .sort({ nom: 1 });

    res.json(personnel);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getPersonnelById = async (req, res) => {
  try {
    const membre = await Personnel.findById(req.params.id).populate(
      "uniteAssignee",
      "nom immatriculation statut position type",
    );
    if (!membre) return res.status(404).json({ message: "Membre introuvable" });
    res.json(membre);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const _genTempPassword = () =>
  "BlancBleu@" + String(Math.floor(1000 + Math.random() * 9000));

const createPersonnel = async (req, res) => {
  try {
    const { email } = req.body;

    if (email) {
      const exists = await Personnel.findOne({ email: email.toLowerCase().trim() });
      if (exists)
        return res.status(409).json({ message: "Un membre avec cet email existe déjà" });
    }

    const tempPassword = _genTempPassword();
    const hashed       = await bcrypt.hash(tempPassword, 12);

    const membre = await Personnel.create({
      ...req.body,
      email:               email?.toLowerCase().trim(),
      password:            hashed,
      forcePasswordChange: true,
    });

    // TODO: sendWelcomeEmail(email, membre.prenom, tempPassword) when email service ready

    const memberObj = membre.toObject();
    delete memberObj.password;
    res.status(201).json({ message: "Membre créé", membre: memberObj, tempPassword });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const updatePersonnel = async (req, res) => {
  try {
    // Block auth-sensitive fields from general updates
    const { password, email, forcePasswordChange, ...safe } = req.body;
    const membre = await Personnel.findByIdAndUpdate(req.params.id, safe, {
      new: true,
      runValidators: true,
    }).populate("uniteAssignee", "nom immatriculation type");
    if (!membre) return res.status(404).json({ message: "Membre introuvable" });
    res.json({ message: "Membre mis à jour", membre });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const membre = await Personnel.findById(req.params.id);
    if (!membre) return res.status(404).json({ message: "Membre introuvable" });

    const tempPassword = _genTempPassword();
    membre.password            = await bcrypt.hash(tempPassword, 12);
    membre.forcePasswordChange = true;
    await membre.save({ validateBeforeSave: false });

    res.json({ message: "Mot de passe réinitialisé", tempPassword });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateStatut = async (req, res) => {
  try {
    const { statut } = req.body;
    const valides = ["en-service", "conge", "formation", "maladie", "inactif"];
    if (!valides.includes(statut)) {
      return res
        .status(400)
        .json({ message: `Statut invalide. Valeurs : ${valides.join(", ")}` });
    }
    const membre = await Personnel.findByIdAndUpdate(
      req.params.id,
      { statut },
      { new: true },
    );
    if (!membre) return res.status(404).json({ message: "Membre introuvable" });
    res.json({ message: "Statut mis à jour", membre });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const assignerUnite = async (req, res) => {
  try {
    const { uniteId } = req.body;

    if (uniteId) {
      const vehicle = await Vehicle.findById(uniteId);
      if (!vehicle)
        return res.status(404).json({ message: "Véhicule introuvable" });
    }

    const membre = await Personnel.findByIdAndUpdate(
      req.params.id,
      { uniteAssignee: uniteId || null },
      { new: true },
    ).populate("uniteAssignee", "nom immatriculation type");

    if (!membre) return res.status(404).json({ message: "Membre introuvable" });
    res.json({ message: "Véhicule assigné", membre });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deletePersonnel = async (req, res) => {
  try {
    const membre = await Personnel.findByIdAndUpdate(
      req.params.id,
      { actif: false },
      { new: true },
    );
    if (!membre) return res.status(404).json({ message: "Membre introuvable" });
    res.json({ message: "Membre désactivé" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getStats = async (req, res) => {
  try {
    const [total, enService, conge, formation, maladie, parRole] =
      await Promise.all([
        Personnel.countDocuments({ actif: true }),
        Personnel.countDocuments({ actif: true, statut: "en-service" }),
        Personnel.countDocuments({ actif: true, statut: "conge" }),
        Personnel.countDocuments({ actif: true, statut: "formation" }),
        Personnel.countDocuments({ actif: true, statut: "maladie" }),
        Personnel.aggregate([
          { $match: { actif: true } },
          { $group: { _id: "$role", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
      ]);
    res.json({
      total,
      parStatut: { enService, conge, formation, maladie },
      parRole,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getPersonnel,
  getPersonnelById,
  createPersonnel,
  updatePersonnel,
  resetPassword,
  updateStatut,
  assignerUnite,
  deletePersonnel,
  getStats,
};
