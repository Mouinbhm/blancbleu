const mongoose = require("mongoose");

const interventionSchema = new mongoose.Schema(
  {
    // ─── Identifiant lisible ──────────────────────────────────────────
    numero: {
      type: String,
      unique: true,
    },

    // ─── Type d'incident ──────────────────────────────────────────────
    typeIncident: {
      type: String,
      required: [true, "Le type d'incident est obligatoire"],
      enum: [
        "Arrêt cardiaque",
        "Accident de la route",
        "AVC",
        "Traumatisme grave",
        "Détresse respiratoire",
        "Douleur thoracique",
        "Malaise",
        "Chute",
        "Brûlure",
        "Intoxication",
        "Accouchement",
        "Autre",
      ],
    },

    // ─── Priorité (calculée par le module IA) ────────────────────────
    priorite: {
      type: String,
      enum: ["P1", "P2", "P3"],
      default: "P3",
    },
    scoreIA: {
      type: Number,
      default: 0,
    },

    // ─── Statut ───────────────────────────────────────────────────────
    statut: {
      type: String,
      enum: ["en_attente", "en_cours", "terminee", "annulee"],
      default: "en_attente",
    },

    // ─── Patient ──────────────────────────────────────────────────────
    patient: {
      nom: { type: String, default: "Inconnu" },
      age: { type: Number },
      etat: {
        type: String,
        enum: ["conscient", "inconscient", "critique", "stable", "inconnu"],
        default: "inconnu",
      },
      symptomes: [{ type: String }],
      nbVictimes: { type: Number, default: 1 },
    },

    // ─── Localisation ─────────────────────────────────────────────────
    adresse: {
      type: String,
      required: [true, "L'adresse est obligatoire"],
    },
    coordonnees: {
      lat: { type: Number },
      lng: { type: Number },
    },

    // ─── Unité assignée ───────────────────────────────────────────────
    unitAssignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      default: null,
    },

    // ─── Dispatcher ───────────────────────────────────────────────────
    dispatcher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // ─── Notes ────────────────────────────────────────────────────────
    notes: { type: String, default: "" },

    // ─── Horodatages opérationnels ────────────────────────────────────
    heureAppel: { type: Date, default: Date.now },
    heureDepart: { type: Date },
    heureArrivee: { type: Date },
    heureTerminee: { type: Date },
  },
  {
    timestamps: true,
  },
);

// ─── Génération automatique du numéro d'intervention ─────────────────────────
interventionSchema.pre("save", async function (next) {
  if (!this.numero) {
    const count = await mongoose.model("Intervention").countDocuments();
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    this.numero = `INT-${dateStr}-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

module.exports = mongoose.model("Intervention", interventionSchema);
