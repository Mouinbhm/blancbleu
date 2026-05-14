/**
 * BlancBleu — Service de Notifications Transport (PART E)
 *
 * Centralise toutes les notifications liées aux événements du transport :
 *   - Persistance en base (modèle Notification)
 *   - Émission Socket.IO temps réel (salles par rôle + patient + chauffeur)
 *   - Envoi email (optionnel, best-effort)
 *
 * Appeler depuis transportLifecycle._transition() après chaque transition.
 */

const Notification  = require("../models/Notification");
const socketService = require("./socketService");
const { LABELS }    = require("./transportStateMachine");
const logger = (() => { try { return require("../utils/logger"); } catch { return console; } })();

// ── Labels & icônes par type de notification ──────────────────────────────────
const NOTIF_CONFIG = {
  TRANSPORT_CREATED:    { title: "Nouveau transport créé",     icon: "🚑" },
  TRANSPORT_CONFIRMED:  { title: "Transport confirmé",         icon: "✅" },
  TRANSPORT_SCHEDULED:  { title: "Transport planifié",         icon: "📅" },
  VEHICLE_ASSIGNED:     { title: "Véhicule assigné",           icon: "🚐" },
  DRIVER_ACCEPTED:      { title: "Mission acceptée",           icon: "👍" },
  DRIVER_REJECTED:      { title: "Mission refusée",            icon: "❌" },
  EN_ROUTE:             { title: "Ambulance en route",         icon: "🛣️" },
  ARRIVED_PICKUP:       { title: "Arrivée chez le patient",    icon: "📍" },
  PATIENT_ON_BOARD:     { title: "Patient à bord",             icon: "🏥" },
  ARRIVED_DESTINATION:  { title: "Arrivée à destination",      icon: "🏁" },
  COMPLETED:            { title: "Transport terminé",          icon: "🏆" },
  NO_SHOW:              { title: "Patient absent (no-show)",   icon: "⚠️" },
  CANCELLED:            { title: "Transport annulé",           icon: "🚫" },
  RESCHEDULED:          { title: "Transport reprogrammé",      icon: "🔄" },
  BILLING_PENDING:      { title: "Facturation en cours",       icon: "💳" },
  BILLED:               { title: "Transport facturé",          icon: "🧾" },
  PAID:                 { title: "Paiement confirmé",          icon: "💰" },
  FAILED:               { title: "Transport en échec",         icon: "🔴" },
  SIGNATURE_ADDED:      { title: "Signature enregistrée",      icon: "✍️" },
  PMT_UPLOADED:         { title: "PMT ajoutée au transport",   icon: "📄" },
  PMT_OCR_DONE:         { title: "Extraction PMT terminée",    icon: "🤖" },
  STATUS_CHANGED:       { title: "Statut mis à jour",          icon: "🔔" },
};

// ── Mapping statut → type notif ───────────────────────────────────────────────
const STATUT_TO_TYPE = {
  CONFIRMED:            "TRANSPORT_CONFIRMED",
  SCHEDULED:            "TRANSPORT_SCHEDULED",
  ASSIGNED:             "VEHICLE_ASSIGNED",
  DRIVER_ACCEPTED:      "DRIVER_ACCEPTED",
  DRIVER_REJECTED:      "DRIVER_REJECTED",
  EN_ROUTE_TO_PICKUP:   "EN_ROUTE",
  ARRIVED_AT_PICKUP:    "ARRIVED_PICKUP",
  PATIENT_ON_BOARD:     "PATIENT_ON_BOARD",
  ARRIVED_AT_DESTINATION: "ARRIVED_DESTINATION",
  COMPLETED:            "COMPLETED",
  NO_SHOW:              "NO_SHOW",
  CANCELLED:            "CANCELLED",
  RESCHEDULED:          "RESCHEDULED",
  BILLING_PENDING:      "BILLING_PENDING",
  BILLED:               "BILLED",
  PAID:                 "PAID",
  FAILED:               "FAILED",
};

// ── Helper interne : créer une Notification en base ───────────────────────────
async function _persist({ recipientId, recipientRole, type, title, message, transportId, metadata }) {
  try {
    await Notification.create({ recipientId, recipientRole, type, title, message, transportId, metadata });
  } catch (err) {
    logger.warn("[TransportNotif] Persistance notification échouée", { err: err.message });
  }
}

// ── Helper interne : émettre via Socket.IO ────────────────────────────────────
function _emit(event, payload) {
  try {
    const io = socketService.getIO?.();
    if (!io) return;
    io.to(payload.room || "broadcast").emit(event, payload);
  } catch (err) {
    logger.warn("[TransportNotif] Émission socket échouée", { err: err.message });
  }
}

// ── Construire le message lisible ─────────────────────────────────────────────
function _buildMessage(transport, newStatus, reason) {
  const label = LABELS[newStatus]?.fr || newStatus;
  const num   = transport.numero || "";
  const patient = [transport.patient?.nom, transport.patient?.prenom].filter(Boolean).join(" ");
  let msg = `Transport ${num} (${patient}) : ${label}`;
  if (reason) msg += ` — ${reason}`;
  return msg;
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTS PUBLICS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Notification à chaque changement de statut.
 * Appelé automatiquement par _transition() du lifecycle.
 */
async function notifyStatusChanged(transport, fromStatus, toStatus, user, reason) {
  const type    = STATUT_TO_TYPE[toStatus] || "STATUS_CHANGED";
  const config  = NOTIF_CONFIG[type] || NOTIF_CONFIG.STATUS_CHANGED;
  const title   = config.title;
  const message = _buildMessage(transport, toStatus, reason);
  const meta    = { fromStatus, toStatus, reason };

  // 1. Notifier admin + dispatcher
  await Promise.all([
    _persist({ recipientRole: "admin",      type, title, message, transportId: transport._id, metadata: meta }),
    _persist({ recipientRole: "dispatcher", type, title, message, transportId: transport._id, metadata: meta }),
  ]);

  // 2. Notifier le patient si lié
  if (transport.patientId) {
    await _persist({ recipientId: transport.patientId, type, title, message, transportId: transport._id, metadata: meta });
  }

  // 3. Émettre Socket.IO (salles par rôle)
  const socketPayload = {
    type,
    title,
    message,
    transportId:  transport._id,
    transportNum: transport.numero,
    fromStatus,
    toStatus,
    toStatusLabel: LABELS[toStatus]?.fr || toStatus,
    reason,
    createdAt: new Date(),
    icon: config.icon,
  };

  const io = socketService.getIO?.();
  if (io) {
    io.to("role:admin").emit("notification:transport", socketPayload);
    io.to("role:dispatcher").emit("notification:transport", socketPayload);
    io.to("role:superviseur").emit("notification:transport", socketPayload);

    if (transport.chauffeur) {
      io.to(`driver:${transport.chauffeur}`).emit("notification:transport", socketPayload);
    }
    if (transport.patientId) {
      io.to(`patient:${transport.patientId}`).emit("notification:transport", socketPayload);
    }
  }

  logger.info("[TransportNotif] Notification envoyée", { type, toStatus, numero: transport.numero });
}

async function notifyTransportCreated(transport, user) {
  const type    = "TRANSPORT_CREATED";
  const config  = NOTIF_CONFIG[type];
  const patient = [transport.patient?.nom, transport.patient?.prenom].filter(Boolean).join(" ");
  const message = `Nouveau transport ${transport.numero} créé pour ${patient}`;

  await Promise.all([
    _persist({ recipientRole: "admin",      type, title: config.title, message, transportId: transport._id }),
    _persist({ recipientRole: "dispatcher", type, title: config.title, message, transportId: transport._id }),
  ]);

  const io = socketService.getIO?.();
  if (io) {
    const payload = { type, title: config.title, message, transportId: transport._id, transportNum: transport.numero, icon: config.icon, createdAt: new Date() };
    io.to("role:admin").emit("notification:transport", payload);
    io.to("role:dispatcher").emit("notification:transport", payload);
    io.to("role:superviseur").emit("notification:transport", payload);
  }
}

async function notifySignatureAdded(transport) {
  const type   = "SIGNATURE_ADDED";
  const config = NOTIF_CONFIG[type];
  const message = `Signature enregistrée pour le transport ${transport.numero} (${transport.proofOfCare?.signedByName || "patient"})`;

  await _persist({ recipientRole: "admin", type, title: config.title, message, transportId: transport._id });
  await _persist({ recipientRole: "dispatcher", type, title: config.title, message, transportId: transport._id });

  const io = socketService.getIO?.();
  if (io) {
    const payload = { type, title: config.title, message, transportId: transport._id, transportNum: transport.numero, icon: config.icon, createdAt: new Date() };
    io.to("role:admin").emit("notification:transport", payload);
    io.to("role:dispatcher").emit("notification:transport", payload);
  }
}

async function notifyPmtUploaded(transport, fileName) {
  const type   = "PMT_UPLOADED";
  const config = NOTIF_CONFIG[type];
  const message = `Document PMT "${fileName}" ajouté au transport ${transport.numero}`;

  await _persist({ recipientRole: "admin", type, title: config.title, message, transportId: transport._id });
  await _persist({ recipientRole: "dispatcher", type, title: config.title, message, transportId: transport._id });

  const io = socketService.getIO?.();
  if (io) {
    const payload = { type, title: config.title, message, transportId: transport._id, transportNum: transport.numero, icon: config.icon, createdAt: new Date() };
    io.to("role:admin").emit("notification:transport", payload);
    io.to("role:dispatcher").emit("notification:transport", payload);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// NOUVEAU : Chauffeur assigné
// ══════════════════════════════════════════════════════════════════════════════
async function notifyDriverAssigned(transport, driverId) {
  const patient = [transport.patient?.nom, transport.patient?.prenom].filter(Boolean).join(" ");

  // Notifier le chauffeur (via room driver:{id})
  const io = socketService.getIO?.();
  const driverPayload = {
    type:         "DRIVER_ASSIGNED",
    title:        "Nouvelle mission assignée",
    message:      `Mission pour ${patient} — Transport ${transport.numero}`,
    transportId:  transport._id,
    transportNum: transport.numero,
    icon:         "🚑",
    priority:     "HIGH",
    createdAt:    new Date(),
  };
  if (io && driverId) {
    io.to(`driver:${driverId}`).emit("notification:new", driverPayload);
  }
  await _persist({ recipientId: driverId, type: "DRIVER_ASSIGNED", title: driverPayload.title, message: driverPayload.message, transportId: transport._id });

  // Notifier le patient
  if (transport.patientId) {
    const patientPayload = {
      type:        "TRANSPORT_ASSIGNED",
      title:       "Transport assigné",
      message:     `Votre transport ${transport.numero} a été assigné à un chauffeur.`,
      transportId: transport._id,
      icon:        "🚐",
      priority:    "NORMAL",
      createdAt:   new Date(),
    };
    if (io) io.to(`patient:${transport.patientId}`).emit("notification:new", patientPayload);
    await _persist({ recipientId: transport.patientId, type: "TRANSPORT_ASSIGNED", title: patientPayload.title, message: patientPayload.message, transportId: transport._id });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// NOUVEAU : Facture prête
// ══════════════════════════════════════════════════════════════════════════════
async function notifyInvoiceReady(facture, patientId) {
  const type    = "INVOICE_READY";
  const title   = "Facture disponible";
  const message = `Votre facture ${facture.numero || facture._id} est disponible. Montant : ${facture.montantTotal ?? facture.montant ?? '—'} €`;

  const io = socketService.getIO?.();

  // Patient
  if (patientId) {
    if (io) io.to(`patient:${patientId}`).emit("notification:new", { type, title, message, invoiceId: facture._id, icon: "🧾", priority: "NORMAL", createdAt: new Date() });
    await _persist({ recipientId: patientId, type, title, message, metadata: { invoiceId: facture._id } });
  }

  // Admin / comptable
  if (io) {
    const adminPayload = { type, title: "Nouvelle facture créée", message: `Facture ${facture.numero || facture._id} prête`, icon: "🧾", priority: "NORMAL", createdAt: new Date() };
    io.to("role:admin").emit("notification:new", adminPayload);
    io.to("role:comptable").emit("notification:new", adminPayload);
  }
  await Promise.all([
    _persist({ recipientRole: "admin",     type, title: "Nouvelle facture créée", message: `Facture ${facture.numero || facture._id} prête`, metadata: { invoiceId: facture._id } }),
    _persist({ recipientRole: "comptable", type, title: "Nouvelle facture créée", message: `Facture ${facture.numero || facture._id} prête`, metadata: { invoiceId: facture._id } }),
  ]);
}

// ══════════════════════════════════════════════════════════════════════════════
// NOUVEAU : Alerte retard
// ══════════════════════════════════════════════════════════════════════════════
async function notifyDelayAlert(transport, retardMinutes) {
  const type    = "DELAY_ALERT";
  const title   = "Alerte retard";
  const message = `Transport ${transport.numero} en retard de ${retardMinutes} minute(s).`;

  const io = socketService.getIO?.();
  const payload = { type, title, message, transportId: transport._id, icon: "⚠️", priority: "HIGH", createdAt: new Date() };

  if (io) {
    io.to("role:admin").to("role:dispatcher").emit("notification:new", payload);
    if (transport.patientId) io.to(`patient:${transport.patientId}`).emit("notification:new", payload);
  }

  await Promise.all([
    _persist({ recipientRole: "admin",      type, title, message, transportId: transport._id, metadata: { retardMinutes } }),
    _persist({ recipientRole: "dispatcher", type, title, message, transportId: transport._id, metadata: { retardMinutes } }),
    transport.patientId
      ? _persist({ recipientId: transport.patientId, type, title, message, transportId: transport._id, metadata: { retardMinutes } })
      : Promise.resolve(),
  ]);
}

// ══════════════════════════════════════════════════════════════════════════════
// NOUVEAU : Résultat paiement
// ══════════════════════════════════════════════════════════════════════════════
async function notifyPaymentResult(facture, patientId, succeeded) {
  const type    = succeeded ? "PAYMENT_SUCCEEDED" : "PAYMENT_FAILED";
  const title   = succeeded ? "Paiement confirmé" : "Paiement échoué";
  const message = succeeded
    ? `Votre paiement de ${facture.montantTotal ?? facture.montant ?? '—'} € a été confirmé.`
    : `Votre paiement a échoué. Veuillez réessayer ou contacter le support.`;

  const io = socketService.getIO?.();

  if (patientId) {
    const payload = { type, title, message, invoiceId: facture._id, icon: succeeded ? "💰" : "❌", priority: succeeded ? "NORMAL" : "HIGH", createdAt: new Date() };
    if (io) io.to(`patient:${patientId}`).emit("notification:new", payload);
    await _persist({ recipientId: patientId, type, title, message, metadata: { invoiceId: facture._id, succeeded } });
  }

  // Admin / comptable
  const adminMsg = succeeded
    ? `Paiement reçu — Facture ${facture.numero || facture._id}`
    : `Paiement échoué — Facture ${facture.numero || facture._id}`;
  await Promise.all([
    _persist({ recipientRole: "admin",     type, title: adminMsg, message: adminMsg, metadata: { invoiceId: facture._id } }),
    _persist({ recipientRole: "comptable", type, title: adminMsg, message: adminMsg, metadata: { invoiceId: facture._id } }),
  ]);
}

module.exports = {
  notifyStatusChanged,
  notifyTransportCreated,
  notifyDriverAssigned,
  notifyInvoiceReady,
  notifyDelayAlert,
  notifyPaymentResult,
  notifySignatureAdded,
  notifyPmtUploaded,
};
