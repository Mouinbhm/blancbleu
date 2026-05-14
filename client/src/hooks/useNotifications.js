/**
 * BlancBleu — Hook useNotifications
 *
 * - Charge le compteur de non-lus au montage
 * - Écoute notification:new via Socket.IO
 * - Écoute notification:unread_count pour synchro en temps réel
 * - Expose toast, mark as read, mark all, refresh
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { notificationService } from "../services/api";
import { getSocket } from "../services/socketClient";

export default function useNotifications() {
  const { user } = useAuth();
  const [unreadCount,    setUnreadCount]    = useState(0);
  const [notifications,  setNotifications]  = useState([]);
  const [toasts,         setToasts]         = useState([]);
  const [loading,        setLoading]        = useState(false);
  const loadedRef = useRef(false);

  // ── Charger compteur initial ───────────────────────────────────────────────
  const refreshUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await notificationService.getUnreadCount();
      setUnreadCount(data?.count ?? 0);
    } catch { /* silencieux */ }
  }, [user]);

  // ── Charger liste de notifications ────────────────────────────────────────
  const fetchNotifications = useCallback(async (filters = {}) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await notificationService.getAll({ limit: 10, ...filters });
      setNotifications(data?.notifications ?? []);
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, [user]);

  // ── Marquer une notification comme lue ────────────────────────────────────
  const markAsRead = useCallback(async (notifId) => {
    try {
      await notificationService.markAsRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => n._id === notifId ? { ...n, read: true } : n)
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* silencieux */ }
  }, []);

  // ── Marquer tout comme lu ─────────────────────────────────────────────────
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* silencieux */ }
  }, []);

  // ── Archiver ──────────────────────────────────────────────────────────────
  const archive = useCallback(async (notifId) => {
    try {
      await notificationService.archive(notifId);
      setNotifications((prev) => prev.filter((n) => n._id !== notifId));
    } catch { /* silencieux */ }
  }, []);

  // ── Dismisser un toast ────────────────────────────────────────────────────
  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Initialisation + écoute Socket.IO ────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    // Chargement initial une seule fois
    if (!loadedRef.current) {
      loadedRef.current = true;
      refreshUnreadCount();
      fetchNotifications();
    }

    const socket = getSocket();

    const onNewNotif = (notif) => {
      // Incrémenter le compteur
      setUnreadCount((c) => c + 1);

      // Prépendre dans la liste
      setNotifications((prev) => [{ ...notif, read: false, _id: notif._id || Date.now() }, ...prev].slice(0, 50));

      // Afficher un toast
      const toastId = Date.now();
      setToasts((prev) => [{ id: toastId, notif }, ...prev].slice(0, 3));
      setTimeout(() => dismissToast(toastId), 7000);
    };

    const onUnreadCount = ({ count }) => {
      setUnreadCount(count ?? 0);
    };

    socket.on("notification:new",          onNewNotif);
    socket.on("notification:unread_count", onUnreadCount);

    return () => {
      socket.off("notification:new",          onNewNotif);
      socket.off("notification:unread_count", onUnreadCount);
    };
  }, [user, refreshUnreadCount, fetchNotifications, dismissToast]);

  return {
    unreadCount,
    notifications,
    toasts,
    loading,
    fetchNotifications,
    refreshUnreadCount,
    markAsRead,
    markAllAsRead,
    archive,
    dismissToast,
  };
}
