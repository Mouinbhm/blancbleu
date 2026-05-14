/**
 * BlancBleu — Service de nettoyage des notifications
 *
 * Archivage automatique des anciennes notifications (défaut 90 jours).
 * Suppression définitive des notifications archivées (défaut 180 jours).
 * Ne supprime jamais les notifications récentes.
 */

const Notification = require("../models/Notification");
const logger = (() => { try { return require("../utils/logger"); } catch { return console; } })();

const RETENTION_DAYS = parseInt(process.env.NOTIFICATION_RETENTION_DAYS || "90", 10);

/**
 * Archive les notifications lues antérieures à `days` jours.
 */
async function archiveOldNotifications(days = RETENTION_DAYS) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await Notification.updateMany(
    { read: true, archived: false, createdAt: { $lt: cutoff } },
    { $set: { archived: true, archivedAt: new Date() } },
  );
  if (result.modifiedCount > 0) {
    logger.info(`[NotifCleanup] ${result.modifiedCount} notification(s) archivée(s) (>${days}j)`);
  }
  return result.modifiedCount;
}

/**
 * Supprime définitivement les notifications archivées antérieures à `days` jours.
 */
async function deleteArchivedNotifications(days = 180) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await Notification.deleteMany({
    archived: true,
    archivedAt: { $lt: cutoff },
  });
  if (result.deletedCount > 0) {
    logger.info(`[NotifCleanup] ${result.deletedCount} notification(s) supprimée(s) définitivement (>${days}j)`);
  }
  return result.deletedCount;
}

/**
 * Lance le cycle complet de nettoyage.
 * À appeler périodiquement (ex. toutes les 24h depuis server.js).
 */
async function runCleanup() {
  try {
    const archived = await archiveOldNotifications();
    const deleted  = await deleteArchivedNotifications();
    logger.info("[NotifCleanup] Nettoyage terminé", { archived, deleted });
    return { archived, deleted };
  } catch (err) {
    logger.error("[NotifCleanup] Erreur nettoyage", { err: err.message });
    return { archived: 0, deleted: 0 };
  }
}

module.exports = { archiveOldNotifications, deleteArchivedNotifications, runCleanup };
