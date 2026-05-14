/**
 * BlancBleu — Service central de Notifications
 *
 * Combine persistance MongoDB + émission Socket.IO temps réel.
 * Un utilisateur hors-ligne retrouve ses notifications après reconnexion.
 *
 * ANCIENNE RESPONSABILITÉ (emails P1/NOVI) → conservée dans emailAlertService.js
 * Ce fichier est désormais le hub central de toutes les notifications in-app.
 */

const Notification  = require("../models/Notification");
const socketService = require("./socketService");
const logger = (() => { try { return require("../utils/logger"); } catch { return console; } })();

// ══════════════════════════════════════════════════════════════════════════════
// FONCTION CENTRALE : createNotification
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Crée une notification persistante et tente une émission Socket.IO temps réel.
 * deliveredRealtime = true si l'utilisateur est connecté au moment de l'émission.
 */
async function createNotification(data) {
  const {
    recipientId,
    recipientRole,
    recipientType,
    senderId,
    senderRole,
    type,
    title,
    message,
    entityType,
    entityId,
    transportId,
    patientId,
    vehicleId,
    invoiceId,
    priority = "NORMAL",
    channel  = "IN_APP",
    metadata = {},
  } = data;

  let deliveredRealtime = false;
  const io = socketService.getIO?.();

  const notifPayload = {
    type,
    title,
    message,
    entityType,
    entityId,
    transportId,
    patientId,
    vehicleId,
    invoiceId,
    priority,
    metadata,
    createdAt: new Date(),
  };

  // Tenter l'émission temps réel avant la persistance
  if (io) {
    if (recipientId) {
      io.to(`user:${recipientId}`).emit("notification:new", notifPayload);
      deliveredRealtime = true;
    }
    if (recipientRole) {
      io.to(`role:${recipientRole}`).emit("notification:new", notifPayload);
      deliveredRealtime = true;
    }
  }

  try {
    const notif = await Notification.create({
      recipientId:       recipientId  || null,
      recipientRole:     recipientRole || null,
      recipientType:     recipientType || null,
      senderId:          senderId      || null,
      senderRole:        senderRole    || null,
      type,
      title,
      message:           message || "",
      entityType:        entityType || null,
      entityId:          entityId   || null,
      transportId:       transportId || null,
      patientId:         patientId   || null,
      vehicleId:         vehicleId   || null,
      invoiceId:         invoiceId   || null,
      priority,
      channel,
      deliveredRealtime,
      deliveredAt:       deliveredRealtime ? new Date() : null,
      metadata,
    });
    return notif;
  } catch (err) {
    logger.warn("[NotifService] Persistance échouée", { err: err.message, type });
    return null;
  }
}

// ── Émettre le compteur non-lu à un utilisateur ───────────────────────────────
async function _emitUnreadCount(userId) {
  if (!userId) return;
  try {
    const count = await Notification.countDocuments({
      recipientId: userId,
      read: false,
      archived: false,
    });
    socketService.emitToUser?.(userId, "notification:unread_count", { count });
  } catch { /* silencieux */ }
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS : notifier par cible
// ══════════════════════════════════════════════════════════════════════════════

async function notifyUser(userId, notificationData) {
  return createNotification({ ...notificationData, recipientId: userId });
}

async function notifyRole(role, notificationData) {
  return createNotification({ ...notificationData, recipientRole: role });
}

async function notifyAdmins(notificationData) {
  return createNotification({ ...notificationData, recipientRole: "admin" });
}

async function notifyDispatchers(notificationData) {
  return createNotification({ ...notificationData, recipientRole: "dispatcher" });
}

async function notifyPatient(patientId, notificationData) {
  return createNotification({
    ...notificationData,
    recipientId:   patientId,
    recipientType: "patient",
    patientId,
  });
}

async function notifyDriver(driverId, notificationData) {
  // Les chauffeurs sont dans Personnel, pas User — on cible la room driver:{driverId}
  const io = socketService.getIO?.();
  if (io) {
    io.to(`driver:${driverId}`).emit("notification:new", {
      ...notificationData,
      createdAt: new Date(),
    });
  }
  // Persistance avec recipientId = driverId (même si c'est un Personnel id)
  return createNotification({
    ...notificationData,
    recipientId:   driverId,
    recipientType: "personnel",
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// LECTURE / GESTION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère les notifications d'un utilisateur avec filtres.
 */
async function getUserNotifications(user, filters = {}) {
  const { read, type, priority, page = 1, limit = 20 } = filters;

  const query = { archived: false };

  if (user.role === "admin" || user.role === "superviseur") {
    query.$or = [
      { recipientId: user._id },
      { recipientRole: user.role },
      { recipientRole: "admin" },
    ];
  } else if (user.role === "dispatcher") {
    query.$or = [
      { recipientId: user._id },
      { recipientRole: "dispatcher" },
      { recipientRole: "admin" },
    ];
  } else if (user.role === "patient") {
    query.recipientId = user._id;
  } else {
    // comptable, autres
    query.$or = [
      { recipientId: user._id },
      { recipientRole: user.role },
    ];
  }

  if (read !== undefined) query.read = read === "true" || read === true;
  if (type) query.type = type;
  if (priority) query.priority = priority;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [notifications, total] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Notification.countDocuments(query),
  ]);

  return {
    notifications,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  };
}

/**
 * Nombre de notifications non lues pour un utilisateur.
 */
async function getUnreadCount(user) {
  const query = { read: false, archived: false };

  if (user.role === "admin" || user.role === "superviseur") {
    query.$or = [
      { recipientId: user._id },
      { recipientRole: { $in: ["admin", user.role] } },
    ];
  } else if (user.role === "dispatcher") {
    query.$or = [
      { recipientId: user._id },
      { recipientRole: { $in: ["dispatcher", "admin"] } },
    ];
  } else {
    query.$or = [
      { recipientId: user._id },
      { recipientRole: user.role },
    ];
  }

  return Notification.countDocuments(query);
}

/**
 * Marquer une notification comme lue.
 */
async function markAsRead(notificationId, user) {
  const notif = await Notification.findById(notificationId);
  if (!notif) throw new Error("Notification introuvable");

  const isOwner = (notif.recipientId && String(notif.recipientId) === String(user._id))
    || notif.recipientRole === user.role
    || ["admin", "superviseur"].includes(user.role);

  if (!isOwner) throw new Error("Accès refusé");

  notif.read   = true;
  notif.readAt = new Date();
  await notif.save();

  setImmediate(() => _emitUnreadCount(user._id));
  return notif;
}

/**
 * Marquer toutes les notifications d'un utilisateur comme lues.
 */
async function markAllAsRead(user) {
  const query = { read: false, archived: false };

  if (user.role === "admin" || user.role === "superviseur") {
    query.$or = [
      { recipientId: user._id },
      { recipientRole: { $in: ["admin", user.role] } },
    ];
  } else if (user.role === "dispatcher") {
    query.$or = [
      { recipientId: user._id },
      { recipientRole: { $in: ["dispatcher", "admin"] } },
    ];
  } else {
    query.$or = [
      { recipientId: user._id },
      { recipientRole: user.role },
    ];
  }

  const result = await Notification.updateMany(query, {
    $set: { read: true, readAt: new Date() },
  });

  setImmediate(() => _emitUnreadCount(user._id));
  return result.modifiedCount;
}

/**
 * Archiver une notification.
 */
async function archiveNotification(notificationId, user) {
  const notif = await Notification.findById(notificationId);
  if (!notif) throw new Error("Notification introuvable");

  const isOwner = (notif.recipientId && String(notif.recipientId) === String(user._id))
    || notif.recipientRole === user.role
    || ["admin", "superviseur"].includes(user.role);

  if (!isOwner) throw new Error("Accès refusé");

  notif.archived   = true;
  notif.archivedAt = new Date();
  await notif.save();
  return notif;
}

/**
 * Supprimer une notification (admin uniquement ou propriétaire).
 */
async function deleteNotification(notificationId, user) {
  const notif = await Notification.findById(notificationId);
  if (!notif) throw new Error("Notification introuvable");

  const canDelete = user.role === "admin"
    || (notif.recipientId && String(notif.recipientId) === String(user._id));

  if (!canDelete) throw new Error("Accès refusé");
  await notif.deleteOne();
}

module.exports = {
  createNotification,
  notifyUser,
  notifyRole,
  notifyAdmins,
  notifyDispatchers,
  notifyPatient,
  notifyDriver,
  markAsRead,
  markAllAsRead,
  getUserNotifications,
  getUnreadCount,
  archiveNotification,
  deleteNotification,
};
