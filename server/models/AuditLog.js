/**
 * BlancBleu — Modèle AuditLog
 * Trace chaque action critique de la plateforme
 */
const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    // ── Qui ───────────────────────────────────────────────────────────────────
    utilisateur: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      email: { type: String, default: "système" },
      role: { type: String, default: "système" },
      ip: { type: String, default: "" },
    },

    // ── Quoi ──────────────────────────────────────────────────────────────────
    action: {
      type: String,
      required: true,
      enum: [
        "INTERVENTION_CREATED",
        "INTERVENTION_UPDATED",
        "INTERVENTION_DELETED",
        "STATUT_CHANGED",
        "UNITE_ASSIGNED",
        "UNITE_UNASSIGNED",
        "IA_PREDICTION",
        "IA_OVERRIDE",
        "IA_FALLBACK",
        "DISPATCH_AUTO",
        "DISPATCH_MANUEL",
        "ESCALADE_TRIGGERED",
        "ESCALADE_RESOLVED",
        "UNITE_CREATED",
        "UNITE_UPDATED",
        "UNITE_STATUS_CHANGED",
        "LOGIN",
        "LOGOUT",
        "LOGIN_FAILED",
        "FACTURE_CREATED",
        "FACTURE_UPDATED",
        "FACTURE_PAID",
      ],
    },

    // ── Origine ───────────────────────────────────────────────────────────────
    origine: {
      type: String,
      enum: ["IA", "HUMAIN", "SYSTÈME", "API"],
      default: "HUMAIN",
    },

    // ── Ressource concernée ───────────────────────────────────────────────────
    // Défini comme sous-document Mixed — accepte { type, id, reference }
    // sans contrainte de cast String sur l'objet entier
    ressource: {
      type: { type: String, default: "Autre" },
      id: { type: mongoose.Schema.Types.ObjectId, default: null },
      reference: { type: String, default: "" },
    },

    // ── Détails ───────────────────────────────────────────────────────────────
    details: {
      avant: { type: mongoose.Schema.Types.Mixed, default: null },
      apres: { type: mongoose.Schema.Types.Mixed, default: null },
      metadata: { type: mongoose.Schema.Types.Mixed, default: null },
      message: { type: String, default: "" },
    },

    // ── Résultat ──────────────────────────────────────────────────────────────
    succes: { type: Boolean, default: true },
    erreur: { type: String, default: "" },

    // ── Contexte HTTP ─────────────────────────────────────────────────────────
    route: { type: String, default: "" },
    methode: { type: String, default: "" },
    dureeMs: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  },
);

// TTL automatique — suppression après 90 jours
auditLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);

// Index pour les requêtes fréquentes
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ "ressource.id": 1 });
auditLogSchema.index({ "utilisateur.email": 1 });
auditLogSchema.index({ origine: 1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
