/**
 * BlancBleu — Service Equipements
 * Adapté transport sanitaire — utilise Vehicle au lieu de Unit
 */
const Equipement = require("../models/Equipement");
const Vehicle = require("../models/Vehicle"); // ← remplace Unit

const SEUILS = {
  EXPIRATION_BIENTOT_JOURS: 30,
  CONTROLE_BIENTOT_JOURS: 14,
};

async function creerEquipement(donnees) {
  if (donnees.numeroSerie) {
    const existe = await Equipement.findOne({
      numeroSerie: donnees.numeroSerie.toUpperCase(),
    });
    if (existe)
      throw {
        status: 409,
        message: `Numéro de série ${donnees.numeroSerie} déjà utilisé`,
      };
  }

  if (donnees.uniteAssignee) {
    const vehicle = await Vehicle.findById(donnees.uniteAssignee);
    if (!vehicle) throw { status: 404, message: "Véhicule introuvable" };
    donnees.typeLocalisation = "ambulance";
  }

  const equip = await Equipement.create(donnees);
  return equip.populate("uniteAssignee", "nom type statut");
}

async function mettreAJour(id, donnees) {
  const equip = await Equipement.findById(id);
  if (!equip) throw { status: 404, message: "Équipement introuvable" };

  if (donnees.numeroSerie && donnees.numeroSerie !== equip.numeroSerie) {
    const existe = await Equipement.findOne({
      numeroSerie: donnees.numeroSerie.toUpperCase(),
      _id: { $ne: id },
    });
    if (existe) throw { status: 409, message: "Numéro de série déjà utilisé" };
  }

  Object.assign(equip, donnees);
  await equip.save();
  return equip.populate("uniteAssignee", "nom type statut");
}

async function affecter(equipementId, vehicleId) {
  const [equip, vehicle] = await Promise.all([
    Equipement.findById(equipementId),
    Vehicle.findById(vehicleId),
  ]);

  if (!equip) throw { status: 404, message: "Équipement introuvable" };
  if (!vehicle) throw { status: 404, message: "Véhicule introuvable" };

  if (equip.etat === "en-panne") {
    throw {
      status: 422,
      message: "Impossible d'affecter un équipement en panne",
    };
  }

  equip.uniteAssignee = vehicleId;
  equip.typeLocalisation = "ambulance";
  await equip.save();
  return equip.populate("uniteAssignee", "nom type statut");
}

async function desaffecter(equipementId) {
  const equip = await Equipement.findById(equipementId);
  if (!equip) throw { status: 404, message: "Équipement introuvable" };

  equip.uniteAssignee = null;
  equip.typeLocalisation = "base";
  await equip.save();
  return equip;
}

async function getAlertes() {
  const maintenant = new Date();
  const dans30j = new Date(
    maintenant.getTime() + SEUILS.EXPIRATION_BIENTOT_JOURS * 86400000,
  );
  const dans14j = new Date(
    maintenant.getTime() + SEUILS.CONTROLE_BIENTOT_JOURS * 86400000,
  );

  const [expirationProche, controleProchain, enPanne] = await Promise.all([
    Equipement.find({
      dateExpiration: { $lte: dans30j, $gte: maintenant },
      estActif: true,
    }),
    Equipement.find({
      prochainControle: { $lte: dans14j, $gte: maintenant },
      estActif: true,
    }),
    Equipement.find({ etat: "en-panne", estActif: true }),
  ]);

  return { expirationProche, controleProchain, enPanne };
}

module.exports = {
  creerEquipement,
  mettreAJour,
  affecter,
  desaffecter,
  getAlertes,
  SEUILS,
};
