/**
 * BlancBleu — Modèle Prescription (PMT) v1.0
 * Prescription Médicale de Transport — entité propre liée à un Patient.
 * Une prescription peut couvrir plusieurs transports (ex: dialyse hebdomadaire).
 */
const mongoose = require("mongoose");

const medecinSchema = new mongoose.Schema(
  {
    nom: { type: String, default: "" },
    prenom: { type: String, default: "" },
    rpps: { type: String, default: "" }, // Numéro RPPS
    telephone: { type: String, default: "" },
    specialite: { type: String, default: "" },
    etablissement: { type: String, default: "" },
  },
  { _id: false },
);

const prescriptionSchema = new mongoose.Schema(
  {
    // ── Numéro auto : PMT-YYYYMMDD-XXXX ──────────────────────────────────────
    numero: { type: String, unique: true, index: true },

    // ── Liens métier ──────────────────────────────────────────────────────────
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: [true, "Le patient est obligatoire"],
      index: true,
    },

    // ── Informations médicales ─────────────────────────────────────────────────
    medecin: { type: medecinSchema, default: () => ({}) },
    dateEmission: { type: Date, required: [true, "La date d'émission est obligatoire"] },
    dateExpiration: { type: Date },
    motif: {
      type: String,
      enum: [
        "Dialyse",
        "Chimiothérapie",
        "Radiothérapie",
        "Consultation",
        "Hospitalisation",
        "Sortie hospitalisation",
        "Rééducation",
        "Analyse",
        "Autre",
      ],
      required: [true, "Le motif est obligatoire"],
    },
    etablissementDestination: { type: String, default: "" },

    // ── Statut de la prescription ─────────────────────────────────────────────
    statut: {
      type: String,
      enum: ["active", "expiree", "annulee", "en_attente_validation"],
      default: "en_attente_validation",
    },

    // ── Document original ─────────────────────────────────────────────────────
    fichierUrl: { type: String, default: "" },
    fichierNom: { type: String, default: "" },

    // ── Extraction IA (OCR + NLP) ─────────────────────────────────────────────
    extractionIA: { type: mongoose.Schema.Types.Mixed, default: null },
    confiance: { type: Number, min: 0, max: 1, default: null },
    champsManquants: [{ type: String }],

    // ── Validation humaine ────────────────────────────────────────────────────
    validee: { type: Boolean, default: false },
    validePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    valideAt: { type: Date, default: null },

    // ── Contenu extrait/validé (champs structurés finaux) ─────────────────────
    contenuExtrait: { type: mongoose.Schema.Types.Mixed, default: null },

    notes: { type: String, default: "" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// ── Index ─────────────────────────────────────────────────────────────────────
prescriptionSchema.index({ patientId: 1, statut: 1 });
prescriptionSchema.index({ dateExpiration: 1 });
prescriptionSchema.index({ deletedAt: 1 });

// ── Numéro automatique ────────────────────────────────────────────────────────
prescriptionSchema.pre("save", async function (next) {
  if (!this.numero) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const count = await mongoose.model("Prescription").countDocuments();
    this.numero = `PMT-${date}-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

// ── Auto-expiration au statut ─────────────────────────────────────────────────
prescriptionSchema.pre("save", function (next) {
  if (this.dateExpiration && this.dateExpiration < new Date() && this.statut === "active") {
    this.statut = "expiree";
  }
  next();
});

module.exports = mongoose.model("Prescription", prescriptionSchema);
