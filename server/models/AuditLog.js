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
        // Interventions
        "INTERVENTION_CREATED",
        "INTERVENTION_UPDATED",
        "INTERVENTION_DELETED",
        "STATUT_CHANGED",
        "UNITE_ASSIGNED",
        "UNITE_UNASSIGNED",
        // IA
        "IA_PREDICTION",
        "IA_OVERRIDE",
        "IA_FALLBACK",
        // Dispatch
        "DISPATCH_AUTO",
        "DISPATCH_MANUEL",
        // Escalade
        "ESCALADE_TRIGGERED",
        "ESCALADE_RESOLVED",
        // Unités
        "UNITE_CREATED",
        "UNITE_UPDATED",
        "UNITE_STATUS_CHANGED",
        // Auth
        "LOGIN",
        "LOGOUT",
        "LOGIN_FAILED",
        // Factures
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
    ressource: {
      type: String, // 'Intervention', 'Unit', 'Facture'...
      id: { type: mongoose.Schema.Types.ObjectId },
      reference: { type: String }, // numéro lisible ex: INT-20260407-0001
    },

    // ── Détails ───────────────────────────────────────────────────────────────
    details: {
      avant: { type: mongoose.Schema.Types.Mixed }, // état avant
      apres: { type: mongoose.Schema.Types.Mixed }, // état après
      metadata: { type: mongoose.Schema.Types.Mixed }, // données supplémentaires
      message: { type: String, default: "" },
    },

    // ── Résultat ──────────────────────────────────────────────────────────────
    succes: { type: Boolean, default: true },
    erreur: { type: String, default: "" },

    // ── Technique ─────────────────────────────────────────────────────────────
    route: { type: String, default: "" },
    methode: { type: String, default: "" },
    dureeMs: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    // TTL : supprimer les logs > 90 jours automatiquement
    expireAfterSeconds: 90 * 24 * 3600,
  },
);

// Index pour requêtes fréquentes
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ "ressource.id": 1 });
auditLogSchema.index({ "utilisateur.id": 1 });
auditLogSchema.index({ origine: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
