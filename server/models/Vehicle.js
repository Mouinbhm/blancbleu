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
    kilometrage: { type: Number, default: 0 },
    carburant: { type: Number, default: 100, min: 0, max: 100 },
    annee: { type: Number, min: 2000 },
    tauxPonctualite: { type: Number, default: 95, min: 0, max: 100 },

    // ── Transport en cours ────────────────────────────────────────────────────
    transportEnCours: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transport",
      default: null,
    },

    notes: { type: String, default: "" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

vehicleSchema.index({ statut: 1, type: 1 });
vehicleSchema.index({ "position.lat": 1, "position.lng": 1 });

module.exports = mongoose.model("Vehicle", vehicleSchema);
