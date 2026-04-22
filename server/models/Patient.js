/**
 * BlancBleu — Modèle Patient v1.0
 * Entité propre représentant un patient suivi par la société de transport sanitaire.
 * Un patient peut avoir plusieurs transports, prescriptions et factures.
 */
const mongoose = require("mongoose");

const contactUrgenceSchema = new mongoose.Schema(
  {
    nom: { type: String, default: "" },
    telephone: { type: String, default: "" },
    lien: { type: String, default: "" }, // ex: "Conjoint", "Parent", "Tuteur légal"
  },
  { _id: false },
);

const patientSchema = new mongoose.Schema(
  {
    // ── Identité ──────────────────────────────────────────────────────────────
    numeroPatient: { type: String, unique: true, index: true },
    nom: { type: String, required: [true, "Le nom est obligatoire"], trim: true },
    prenom: { type: String, default: "", trim: true },
    dateNaissance: { type: Date },
    genre: { type: String, enum: ["M", "F", "autre"], default: "M" },

    // ── Contact ───────────────────────────────────────────────────────────────
    telephone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    adresse: {
      rue: { type: String, default: "" },
      ville: { type: String, default: "" },
      codePostal: { type: String, default: "" },
    },

    // ── Informations médicales / administratives ──────────────────────────────
    numeroSecu: { type: String, default: "", trim: true },
    caisse: { type: String, default: "" }, // CPAM, MSA, RSI…
    exoneration: { type: Boolean, default: false }, // ALD / 100%
    mutuelle: { type: String, default: "" },

    // ── Mobilité & besoins spécifiques ───────────────────────────────────────
    mobilite: {
      type: String,
      enum: ["ASSIS", "FAUTEUIL_ROULANT", "ALLONGE", "CIVIERE"],
      default: "ASSIS",
    },
    oxygene: { type: Boolean, default: false },
    brancardage: { type: Boolean, default: false },
    accompagnateur: { type: Boolean, default: false },

    // ── Contact d'urgence ─────────────────────────────────────────────────────
    contactUrgence: { type: contactUrgenceSchema, default: () => ({}) },

    // ── Informations complémentaires ──────────────────────────────────────────
    antecedents: { type: String, default: "" },
    allergies: { type: String, default: "" },
    preferences: { type: String, default: "" },
    notes: { type: String, default: "" },

    // ── Statut ────────────────────────────────────────────────────────────────
    actif: { type: Boolean, default: true, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// ── Index ─────────────────────────────────────────────────────────────────────
patientSchema.index({ nom: 1, prenom: 1 });
patientSchema.index({ numeroSecu: 1 }, { sparse: true });
patientSchema.index({ telephone: 1 }, { sparse: true });
patientSchema.index({ deletedAt: 1 });

// ── Numéro patient automatique : PAT-YYYYMMDD-XXXX ───────────────────────────
patientSchema.pre("save", async function (next) {
  if (!this.numeroPatient) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const count = await mongoose.model("Patient").countDocuments();
    this.numeroPatient = `PAT-${date}-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

// ── Virtual : nom complet ─────────────────────────────────────────────────────
patientSchema.virtual("nomComplet").get(function () {
  return `${this.nom} ${this.prenom}`.trim();
});

patientSchema.set("toJSON", { virtuals: true });
patientSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Patient", patientSchema);
