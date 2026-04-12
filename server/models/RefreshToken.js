const mongoose = require("mongoose");
const crypto = require("crypto");

const refreshTokenSchema = new mongoose.Schema(
  {
    // Référence à l'utilisateur propriétaire du token
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Token stocké hashé (SHA-256) — la valeur brute n'est jamais persistée
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },

    // Métadonnées pour l'audit de sécurité
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },

    // Révocation manuelle (logout, changement de mot de passe)
    revoked: { type: Boolean, default: false },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },

    // Expiration : 7 jours
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true },
);

// TTL MongoDB — suppression automatique après expiration
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index composite pour la révocation par userId (logout de tous les appareils)
refreshTokenSchema.index({ userId: 1, revoked: 1 });

// ─── Helpers statiques ───────────────────────────────────────────────────────

// Hash un token brut avant de le stocker ou comparer
refreshTokenSchema.statics.hashToken = (rawToken) =>
  crypto.createHash("sha256").update(rawToken).digest("hex");

// Trouver un token valide (non révoqué, non expiré) par valeur brute
refreshTokenSchema.statics.findValid = function (rawToken) {
  const hash = this.hashToken(rawToken);
  return this.findOne({
    tokenHash: hash,
    revoked: false,
    expiresAt: { $gt: new Date() },
  }).populate("userId");
};

// Révoquer tous les tokens d'un utilisateur (logout global)
refreshTokenSchema.statics.revokeAllForUser = function (userId, reason = "logout") {
  return this.updateMany(
    { userId, revoked: false },
    { revoked: true, revokedAt: new Date(), revokedReason: reason },
  );
};

module.exports = mongoose.model("RefreshToken", refreshTokenSchema);