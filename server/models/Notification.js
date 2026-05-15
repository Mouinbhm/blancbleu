/**
 * BlancBleu — Modèle Notification persistante
 *
 * Combine Socket.IO (temps réel) + MongoDB (historique).
 * Un utilisateur hors-ligne retrouve ses notifications à la reconnexion.
 */

const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    // ── Destinataire ──────────────────────────────────────────────────────────
    recipientId:   { type: mongoose.Schema.Types.ObjectId, ref: "User",      default: null },
    recipientRole: { type: String, default: null }, // diffusion par rôle (admin, dispatcher…)
    recipientType: { type: String, default: null }, // "user" | "patient" | "personnel"

    // ── Expéditeur ────────────────────────────────────────────────────────────
    senderId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    senderRole: { type: String, default: null },

    // ── Contenu ───────────────────────────────────────────────────────────────
    type: {
      type: String,
      enum: [
        // Transport
        "TRANSPORT_CREATED",
        "TRANSPORT_ASSIGNED",
        "TRANSPORT_STATUS_CHANGED",
        "TRANSPORT_CONFIRMED",
        "TRANSPORT_SCHEDULED",
        "TRANSPORT_CANCELLED",
        "TRANSPORT_COMPLETED",
        "TRANSPORT_RESCHEDULED",
        // Chauffeur
        "DRIVER_ASSIGNED",
        "DRIVER_ACCEPTED",
        "DRIVER_REJECTED",
        // GPS & alertes
        "GPS_UPDATED",
        "DELAY_ALERT",
        "NO_SHOW",
        // Facturation
        "INVOICE_READY",
        "PAYMENT_SUCCEEDED",
        "PAYMENT_FAILED",
        // Véhicule
        "VEHICLE_ASSIGNED",
        "MAINTENANCE_ALERT",
        // PMT / Documents
        "SIGNATURE_ADDED",
        "PMT_UPLOADED",
        "PMT_OCR_DONE",
        // Système
        "SYSTEM_ALERT",
        // Cycle de vie opérationnel (chauffeur)
        "EN_ROUTE",
        "ARRIVED_PICKUP",
        "PATIENT_ON_BOARD",
        "ARRIVED_DESTINATION",
        "COMPLETED",
        "CANCELLED",
        "RESCHEDULED",
        // Cycle financier
        "BILLING_PENDING",
        "BILLED",
        "PAID",
        "FAILED",
        // Générique (rétrocompat)
        "VEHICLE_BLOCKED",
        "VEHICLE_OUT_OF_SERVICE",
        "HIGH_UTILIZATION",
        "LOW_UTILIZATION",
        "STATUS_CHANGED",
      ],
      required: true,
    },
    title:   { type: String, required: true },
    message: { type: String, default: "" },

    // ── Entité liée ───────────────────────────────────────────────────────────
    entityType: { type: String, default: null }, // "transport" | "facture" | "vehicle" | "patient"
    entityId:   { type: mongoose.Schema.Types.ObjectId, default: null },

    // ── Références directes (raccourcis requêtes) ─────────────────────────────
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", default: null },
    patientId:   { type: mongoose.Schema.Types.ObjectId, ref: "Patient",   default: null },
    vehicleId:   { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle",   default: null },
    invoiceId:   { type: mongoose.Schema.Types.ObjectId, ref: "Facture",   default: null },

    // ── Priorité ──────────────────────────────────────────────────────────────
    priority: {
      type: String,
      enum: ["LOW", "NORMAL", "HIGH", "URGENT"],
      default: "NORMAL",
    },

    // ── Canal ─────────────────────────────────────────────────────────────────
    channel: {
      type: String,
      enum: ["IN_APP", "SOCKET", "EMAIL", "PUSH"],
      default: "IN_APP",
    },

    // ── État de lecture ───────────────────────────────────────────────────────
    read:   { type: Boolean, default: false },
    readAt: { type: Date,    default: null },

    // ── Livraison temps réel ──────────────────────────────────────────────────
    deliveredRealtime: { type: Boolean, default: false },
    deliveredAt:       { type: Date,    default: null },

    // ── Archivage ─────────────────────────────────────────────────────────────
    archived:   { type: Boolean, default: false },
    archivedAt: { type: Date,    default: null },

    // ── Données supplémentaires ───────────────────────────────────────────────
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

// ── Indexes ───────────────────────────────────────────────────────────────────
notificationSchema.index({ recipientId: 1,   read: 1, createdAt: -1 });
notificationSchema.index({ recipientRole: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1,   archived: 1, createdAt: -1 });
notificationSchema.index({ transportId: 1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ entityType: 1, entityId: 1 });
notificationSchema.index({ createdAt: 1 }); // pour le cleanup

module.exports = mongoose.model("Notification", notificationSchema);
