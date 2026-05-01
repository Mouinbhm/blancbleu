const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true, trim: true },
    prenom: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Email invalide"],
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: {
      type: String,
      enum: ["dispatcher", "superviseur", "admin", "patient"],
      default: "dispatcher",
    },
    actif: { type: Boolean, default: true },

    // ── Champs patient ────────────────────────────────────────────────────────
    telephone: { type: String, default: "" },
    adresse:   { type: String, default: "" },
    mobilite: {
      type: String,
      enum: ["ASSIS", "FAUTEUIL_ROULANT", "ALLONGE", "CIVIERE"],
      default: "ASSIS",
    },
    medecin:  { type: String, default: "" },
    mutuelle: { type: String, default: "" },
    contactUrgence: {
      nom:       { type: String, default: "" },
      telephone: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

// Pas de hook pre('save') — hash géré manuellement dans les controllers
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
