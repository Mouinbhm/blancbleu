/**
 * BlancBleu — Modèle Maintenance
 * Adapté transport sanitaire — ref Vehicle au lieu de Unit
 */
const mongoose = require("mongoose");

const maintenanceSchema = new mongoose.Schema(
  {
    unite: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle", // ← remplace "Unit"
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "Révision complète",
        "Vidange + filtres",
        "Changement freins",
        "Changement pneus",
        "Contrôle technique",
        "Réparation moteur",
        "Carrosserie",
        "Électricité",
        "Autre",
      ],
    },
    statut: {
      type: String,
      enum: ["planifié", "en-cours", "terminé", "annulé"],
      default: "planifié",
    },
    dateDebut: { type: Date, required: true },
    dateFin: { type: Date },
    garage: { type: String, trim: true },
    cout: { type: Number, default: 0 },
    kilometrage: { type: Number },
    responsable: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Maintenance", maintenanceSchema);
