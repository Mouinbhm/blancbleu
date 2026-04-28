/**
 * BlancBleu — Modèle Vehicle v1.0
 * Véhicule de transport sanitaire non urgent
 * Remplace Unit.js (urgences)
 */
const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    lat: { type: Number },
    lng: { type: Number },
    adresse: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const vehicleSchema = new mongoose.Schema(
  {
    // ── Identification ────────────────────────────────────────────────────────
    immatriculation: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    nom: { type: String, required: true, trim: true },

    // ── Type véhicule ─────────────────────────────────────────────────────────
    type: {
      type: String,
      required: true,
      enum: ["VSL", "AMBULANCE", "TPMR"],
      index: true,
    },

    // Capacités
    capacitePassagers: { type: Number, default: 1 },
    equipeFauteuil: { type: Boolean, default: false }, // rampe/hayon
    equipeOxygene: { type: Boolean, default: false },
    equipeBrancard: { type: Boolean, default: false },

    // ── Statut opérationnel ───────────────────────────────────────────────────
    statut: {
      type: String,
      enum: ["disponible", "en_mission", "maintenance", "hors_service"],
      default: "disponible",
      index: true,
    },

    // ── Chauffeur principal assigné ───────────────────────────────────────────
    chauffeurAssigne: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ── Position GPS ─────────────────────────────────────────────────────────
    position: { type: locationSchema, default: () => ({}) },
    baseAdresse: { type: String, default: "59 Bd Madeleine, Nice" },
    basePosition: {
      lat: { type: Number, default: 43.7102 },
      lng: { type: Number, default: 7.262 },
    },

    // ── Métriques ─────────────────────────────────────────────────────────────
    // Changed from flat Number to nested object for maintenance tracking
    kilometrage: {
      actuel:          { type: Number, default: 0, min: 0 },
      dernierControle: { type: Number, default: 0 },
      prochainVidange: { type: Number },
      prochainControle:{ type: Number },
    },
    carburant: { type: Number, default: 100, min: 0, max: 100 },
    annee: { type: Number, min: 2000 },
    tauxPonctualite: { type: Number, default: 95, min: 0, max: 100 },

    // ── Transport en cours ────────────────────────────────────────────────────
    transportEnCours: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transport",
      default: null,
    },

    // ── Identification étendue ────────────────────────────────────────────────────
    marque:      { type: String, trim: true, default: "" },
    modele:      { type: String, trim: true, default: "" },
    couleur:     { type: String, trim: true, default: "" },
    numeroSerie: { type: String, trim: true, default: "" },
    actif:       { type: Boolean, default: true },

    // ── Motorisation ──────────────────────────────────────────────────────────────
    typeEnergie: {
      type: String,
      enum: ["Diesel", "Essence", "Hybride", "Electrique", "GPL", "Hydrogène"],
      default: "Diesel",
    },
    consommationL100: { type: Number, min: 0, max: 30 },
    autonomieKm:      { type: Number, min: 0 },
    puissanceCv:      { type: Number, min: 0 },

    // ── Contrôles réglementaires ──────────────────────────────────────────────────
    controleTechnique: {
      dateExpiration: { type: Date },
      rappel30j:      { type: Boolean, default: true },
    },
    assurance: {
      compagnie:      { type: String, trim: true, default: "" },
      numeroPolice:   { type: String, trim: true, default: "" },
      dateExpiration: { type: Date },
      rappel30j:      { type: Boolean, default: true },
    },
    vignetteControlePollution: {
      categorie:      { type: String, enum: ["Crit'Air 1", "Crit'Air 2", "Crit'Air 3", "Non classé"] },
      dateExpiration: { type: Date },
    },

    // ── Équipements médicaux ──────────────────────────────────────────────────────
    equipements: {
      oxygene:       { type: Boolean, default: false },
      fauteuilRampe: { type: Boolean, default: false },
      brancard:      { type: Boolean, default: false },
      dae:           { type: Boolean, default: false },
      aspirateur:    { type: Boolean, default: false },
      chauffage:     { type: Boolean, default: false },
      climatisation: { type: Boolean, default: false },
    },

    // ── Capacité ──────────────────────────────────────────────────────────────────
    capacite: {
      placesAssises:  { type: Number, default: 1, min: 1, max: 6 },
      placesFauteuil: { type: Number, default: 0, min: 0, max: 2 },
      placesBrancard: { type: Number, default: 0, min: 0, max: 1 },
    },

    // ── Garage d'attache ──────────────────────────────────────────────────────────
    garage: {
      nom:     { type: String, default: "Garage principal" },
      adresse: { type: String, default: "59 Bd Madeleine, Nice" },
      lat:     { type: Number, default: 43.7102 },
      lng:     { type: Number, default: 7.262 },
    },

    notes:     { type: String, default: "" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

vehicleSchema.index({ statut: 1, type: 1 });
vehicleSchema.index({ "position.lat": 1, "position.lng": 1 });

module.exports = mongoose.model("Vehicle", vehicleSchema);
