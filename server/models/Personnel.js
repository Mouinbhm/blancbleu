const mongoose = require("mongoose");

const personnelSchema = new mongoose.Schema(
  {
    // ─── Identité ─────────────────────────────────────────────────
    nom: { type: String, required: true, trim: true },
    prenom: { type: String, required: true, trim: true },

    // ─── Rôle professionnel ───────────────────────────────────────
    role: {
      type: String,
      required: true,
      enum: [
        "Ambulancier",
        "Secouriste",
        "Infirmier",
        "Médecin",
        "Chauffeur",
        "Autre",
      ],
    },

    // ─── Statut opérationnel ──────────────────────────────────────
    statut: {
      type: String,
      enum: ["en-service", "conge", "formation", "maladie", "inactif"],
      default: "en-service",
    },

    // ─── Unité assignée ───────────────────────────────────────────
    uniteAssignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      default: null,
    },

    // ─── Coordonnées ──────────────────────────────────────────────
    telephone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },

    // ─── Certifications ───────────────────────────────────────────
    certifications: [
      {
        nom: { type: String },
        dateObtention: { type: Date },
        dateExpiration: { type: Date },
      },
    ],

    // ─── Infos RH ─────────────────────────────────────────────────
    dateEmbauche: { type: Date },
    notes: { type: String, default: "" },
    actif: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Personnel", personnelSchema);
