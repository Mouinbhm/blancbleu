/**
 * BlancBleu — Contrôleur Notifications
 */

const notifService = require("../services/notificationService");
const logger = (() => { try { return require("../utils/logger"); } catch { return console; } })();

const ok  = (res, data, status = 200) => res.status(status).json({ success: true,  ...data });
const err = (res, message, code = "ERROR", status = 400) =>
  res.status(status).json({ success: false, message, code });

// ── GET /api/notifications ─────────────────────────────────────────────────────
exports.getNotifications = async (req, res) => {
  try {
    const { read, type, priority, page = 1, limit = 20 } = req.query;
    const result = await notifService.getUserNotifications(req.user, { read, type, priority, page, limit });
    ok(res, result);
  } catch (e) {
    logger.error("[NotifCtrl] getNotifications", { err: e.message });
    err(res, "Impossible de charger les notifications", "FETCH_ERROR", 500);
  }
};

// ── GET /api/notifications/unread-count ───────────────────────────────────────
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await notifService.getUnreadCount(req.user);
    ok(res, { count });
  } catch (e) {
    logger.error("[NotifCtrl] getUnreadCount", { err: e.message });
    err(res, "Impossible de récupérer le compteur", "COUNT_ERROR", 500);
  }
};

// ── PATCH /api/notifications/:id/read ─────────────────────────────────────────
exports.markAsRead = async (req, res) => {
  try {
    const notif = await notifService.markAsRead(req.params.id, req.user);
    ok(res, { data: notif });
  } catch (e) {
    if (e.message === "Notification introuvable") return err(res, e.message, "NOT_FOUND", 404);
    if (e.message === "Accès refusé")            return err(res, e.message, "FORBIDDEN", 403);
    logger.error("[NotifCtrl] markAsRead", { err: e.message });
    err(res, "Erreur lors de la mise à jour", "UPDATE_ERROR", 500);
  }
};

// ── PATCH /api/notifications/read-all ─────────────────────────────────────────
exports.markAllAsRead = async (req, res) => {
  try {
    const count = await notifService.markAllAsRead(req.user);
    ok(res, { data: { modifiedCount: count } });
  } catch (e) {
    logger.error("[NotifCtrl] markAllAsRead", { err: e.message });
    err(res, "Erreur lors de la mise à jour", "UPDATE_ERROR", 500);
  }
};

// ── PATCH /api/notifications/:id/archive ──────────────────────────────────────
exports.archiveNotification = async (req, res) => {
  try {
    const notif = await notifService.archiveNotification(req.params.id, req.user);
    ok(res, { data: notif });
  } catch (e) {
    if (e.message === "Notification introuvable") return err(res, e.message, "NOT_FOUND", 404);
    if (e.message === "Accès refusé")            return err(res, e.message, "FORBIDDEN", 403);
    logger.error("[NotifCtrl] archiveNotification", { err: e.message });
    err(res, "Notification archivée avec erreur", "ARCHIVE_ERROR", 500);
  }
};

// ── DELETE /api/notifications/:id ─────────────────────────────────────────────
exports.deleteNotification = async (req, res) => {
  try {
    await notifService.deleteNotification(req.params.id, req.user);
    ok(res, { message: "Notification supprimée" });
  } catch (e) {
    if (e.message === "Notification introuvable") return err(res, e.message, "NOT_FOUND", 404);
    if (e.message === "Accès refusé")            return err(res, e.message, "FORBIDDEN", 403);
    logger.error("[NotifCtrl] deleteNotification", { err: e.message });
    err(res, "Erreur lors de la suppression", "DELETE_ERROR", 500);
  }
};
