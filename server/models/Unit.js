/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  BlancBleu — Modèle Unit v3.0 — Mode Réel Métier            ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
const mongoose = require("mongoose");

// ─── Sous-schémas ─────────────────────────────────────────────────────────────
const locationSchema = new mongoose.Schema(
  {
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
    adresse: { type: String, default: "" },
    vitesse: { type: Number, default: 0, min: 0 },
    cap: { type: Number, default: 0, min: 0, max: 360 },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const equipageSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true },
    role: {
      type: String,
      enum: ["Médecin", "Infirmier", "Ambulancier", "Secouriste", "Chauffeur"],
    },
  },
  { _id: false },
);

const specsSchema = new mongoose.Schema(
  {
    consommationL100: { type: Number, default: 12 }, // L/100km
    capaciteReservoir: { type: Number, default: 80 }, // litres
    vitesseMoyenneUrb: { type: Number, default: 45 }, // km/h urbain
    vitesseMoyennePrio: { type: Number, default: 75 }, // km/h prioritaire
  },
  { _id: false },
);

// ─── Schéma principal ─────────────────────────────────────────────────────────
const unitSchema = new mongoose.Schema(
  {
    // ── Identification ────────────────────────────────────────────────────────
    immatriculation: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    nom: { type: String, required: true, trim: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ["VSAV", "SMUR", "VSL", "VPSP", "AR"],
      index: true,
    },
    annee: { type: Number, min: 2000 },

    // ── STATUT OPÉRATIONNEL ───────────────────────────────────────────────────
    statut: {
      type: String,
      enum: [
        "disponible",
        "en_mission",
        "maintenance",
        "hors_service",
        "pause",
        "retour_base",
      ],
      default: "disponible",
      index: true,
    },
    lastStatusChangeAt: { type: Date, default: Date.now },

    // ── GÉOLOCALISATION TEMPS RÉEL ────────────────────────────────────────────
    position: {
      type: locationSchema,
      default: () => ({
        lat: 43.7102,
        lng: 7.262,
        adresse: "Base principale — 59 Bd Madeleine, Nice",
      }),
    },

    // ── BASE ──────────────────────────────────────────────────────────────────
    baseAdresse: { type: String, default: "59 Bd Madeleine, Nice" },
    basePosition: {
      lat: { type: Number, default: 43.7102 },
      lng: { type: Number, default: 7.262 },
    },

    // ── MÉTRIQUES PHYSIQUES ───────────────────────────────────────────────────
    kilometrage: { type: Number, default: 0, min: 0 }, // km total
    carburant: { type: Number, default: 100, min: 0, max: 100 }, // %

    // ── SPECS TECHNIQUES ──────────────────────────────────────────────────────
    specs: { type: specsSchema, default: () => ({}) },

    // ── MISSION EN COURS ──────────────────────────────────────────────────────
    interventionEnCours: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Intervention",
      default: null,
    },
    missionStartedAt: { type: Date, default: null },
    missionKmDebut: { type: Number, default: null },
    missionFuelDebut: { type: Number, default: null },

    // ── ÉQUIPAGE ──────────────────────────────────────────────────────────────
    equipage: { type: [equipageSchema], default: [] },
    socketId: { type: String, default: null },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

// ── Index ──────────────────────────────────────────────────────────────────────
unitSchema.index({ statut: 1, type: 1 });
unitSchema.index({ "position.lat": 1, "position.lng": 1 });

// ── Méthode : démarrer mission ─────────────────────────────────────────────────
unitSchema.methods.demarrerMission = function (interventionId) {
  this.statut = "en_mission";
  this.interventionEnCours = interventionId;
  this.missionStartedAt = new Date();
  this.missionKmDebut = this.kilometrage;
  this.missionFuelDebut = this.carburant;
  this.lastStatusChangeAt = new Date();
  return this.save();
};

// ── Méthode : terminer mission ─────────────────────────────────────────────────
unitSchema.methods.terminerMission = function () {
  this.statut = "disponible";
  this.interventionEnCours = null;
  this.missionStartedAt = null;
  this.missionKmDebut = null;
  this.missionFuelDebut = null;
  this.lastStatusChangeAt = new Date();
  this.position = {
    ...this.basePosition,
    adresse: this.baseAdresse,
    updatedAt: new Date(),
  };
  return this.save();
};

// ── Méthode : consommer carburant selon distance ───────────────────────────────
unitSchema.methods.consommerCarburant = function (distanceKm) {
  const conso = this.specs?.consommationL100 || 12; // L/100km
  const reservoir = this.specs?.capaciteReservoir || 80; // litres
  const litres = (distanceKm * conso) / 100;
  const pctConso = (litres / reservoir) * 100;
  this.carburant = Math.max(0, this.carburant - pctConso);
  this.kilometrage += distanceKm;
};

unitSchema.set("toJSON", { virtuals: true });
unitSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Unit", unitSchema);
