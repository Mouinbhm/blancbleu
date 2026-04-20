const mongoose = require("mongoose");

const factureSchema = new mongoose.Schema(
  {
    numero: { type: String, unique: true },
    date: { type: Date, required: true, default: Date.now },
    motif: { type: String, required: true, trim: true },
    lieu: { type: String, required: true, trim: true },
    montant: { type: Number, required: true, min: 0 },
    statut: {
      type: String,
      enum: ["payée", "en-attente", "annulée"],
      default: "en-attente",
    },
    patient: { type: String, trim: true, default: "" },
    transport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transport",
      default: null,
    },
    // ── Données CPAM (pré-remplies automatiquement à la complétion du transport)
    distanceKm: { type: Number, default: null },
    montantCPAM: { type: Number, default: null },
    montantPatient: { type: Number, default: null },
    typeVehicule: {
      type: String,
      enum: ["VSL", "TPMR", "AMBULANCE"],
      default: null,
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

factureSchema.pre("save", async function (next) {
  if (!this.numero) {
    const count = await mongoose.model("Facture").countDocuments();
    const y = new Date().getFullYear();
    this.numero = `FAC-${y}-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

module.exports = mongoose.model("Facture", factureSchema);
