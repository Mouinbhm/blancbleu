/**
 * BlancBleu — Routes Notifications
 * Toutes les routes sont protégées par JWT (protect).
 */

const express = require("express");
const router  = express.Router();
const { protect } = require("../middleware/auth");
const ctrl = require("../controllers/notificationController");

// Toutes les routes requièrent une authentification
router.use(protect);

// GET    /api/notifications                → liste paginée avec filtres
// GET    /api/notifications/unread-count   → compteur non lus
// PATCH  /api/notifications/read-all       → marquer tout comme lu
// PATCH  /api/notifications/:id/read       → marquer une notif comme lue
// PATCH  /api/notifications/:id/archive    → archiver
// DELETE /api/notifications/:id            → supprimer

router.get   ("/",               ctrl.getNotifications);
router.get   ("/unread-count",   ctrl.getUnreadCount);
router.patch ("/read-all",       ctrl.markAllAsRead);
router.patch ("/:id/read",       ctrl.markAsRead);
router.patch ("/:id/archive",    ctrl.archiveNotification);
router.delete("/:id",            ctrl.deleteNotification);

module.exports = router;
