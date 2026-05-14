// Fichier : client/src/pages/Notifications.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { notificationService } from "../services/api";
import useNotifications from "../hooks/useNotifications";

const FILTERS = [
  { key: "all",       label: "Toutes" },
  { key: "unread",    label: "Non lues" },
  { key: "important", label: "Importantes" },
];

const PRIORITY_COLOR = {
  URGENT: "bg-red-100 text-red-700",
  HIGH:   "bg-orange-100 text-orange-700",
  NORMAL: "bg-slate-100 text-slate-600",
  LOW:    "bg-green-100 text-green-700",
};

const TYPE_ICON = {
  TRANSPORT_CREATED:       "directions_car",
  TRANSPORT_ASSIGNED:      "directions_car",
  TRANSPORT_STATUS_CHANGED:"sync",
  TRANSPORT_COMPLETED:     "check_circle",
  TRANSPORT_CANCELLED:     "cancel",
  DRIVER_ASSIGNED:         "person_pin",
  DRIVER_ACCEPTED:         "thumb_up",
  DRIVER_REJECTED:         "thumb_down",
  DELAY_ALERT:             "warning",
  NO_SHOW:                 "person_off",
  INVOICE_READY:           "receipt_long",
  PAYMENT_SUCCEEDED:       "payments",
  PAYMENT_FAILED:          "money_off",
  MAINTENANCE_ALERT:       "build",
  SYSTEM_ALERT:            "info",
};

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400)return `${Math.floor(diff / 3600)} h`;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function Notifications() {
  const navigate = useNavigate();
  const { markAsRead, markAllAsRead } = useNotifications();

  const [activeFilter, setActiveFilter] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 20 };
      if (activeFilter === "unread")    params.read     = false;
      if (activeFilter === "important") params.priority = "HIGH,URGENT";
      const { data } = await notificationService.getAll(params);
      setNotifications(data?.notifications ?? []);
      setPagination(data?.pagination ?? null);
      setPage(p);
    } catch {
      showToast("Impossible de charger les notifications");
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => { load(1); }, [load]);

  const handleMarkRead = async (notif) => {
    if (notif.read) return;
    await markAsRead(notif._id);
    setNotifications((prev) => prev.map((n) => n._id === notif._id ? { ...n, read: true } : n));
  };

  const handleMarkAll = async () => {
    await markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    showToast("Toutes les notifications ont été lues");
  };

  const handleArchive = async (notif) => {
    setArchiving(notif._id);
    try {
      await notificationService.archive(notif._id);
      setNotifications((prev) => prev.filter((n) => n._id !== notif._id));
      showToast("Notification archivée");
    } catch {
      showToast("Erreur lors de l'archivage");
    } finally {
      setArchiving(null);
    }
  };

  const handleClick = (notif) => {
    handleMarkRead(notif);
    if (notif.transportId) navigate(`/transports/${notif.transportId}`);
    else if (notif.invoiceId) navigate(`/factures`);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-navy">Notifications</h1>
          <p className="text-xs text-slate-400 mt-0.5">Historique de vos alertes et mises à jour</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            className="text-xs font-bold text-primary border border-primary px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="flex gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setActiveFilter(f.key); }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              activeFilter === f.key
                ? "bg-primary text-white shadow"
                : "bg-white text-slate-500 border border-slate-200 hover:border-primary hover:text-primary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-3">notifications_none</span>
          <p className="text-sm font-medium">Aucune notification</p>
          <p className="text-xs mt-1">Revenez plus tard</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n._id}
              className={`bg-white rounded-xl border transition-all ${
                !n.read ? "border-primary/20 shadow-sm shadow-primary/5" : "border-slate-100"
              } hover:shadow-md cursor-pointer group`}
              onClick={() => handleClick(n)}
            >
              <div className="flex items-start gap-3 p-4">
                {/* Icône */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${!n.read ? "bg-primary text-white" : "bg-slate-100 text-slate-400"}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    {TYPE_ICON[n.type] || "notifications"}
                  </span>
                </div>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold leading-tight ${!n.read ? "text-navy" : "text-slate-600"}`}>
                      {n.title}
                    </p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {n.priority && n.priority !== "NORMAL" && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${PRIORITY_COLOR[n.priority] || ""}`}>
                          {n.priority}
                        </span>
                      )}
                      <span className="text-xs text-slate-300">{timeAgo(n.createdAt)}</span>
                    </div>
                  </div>
                  {n.message && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                  )}
                </div>

                {/* Indicateur non-lu */}
                {!n.read && (
                  <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1" />
                )}
              </div>

              {/* Actions */}
              <div
                className="hidden group-hover:flex items-center gap-2 px-4 pb-3 -mt-1"
                onClick={(e) => e.stopPropagation()}
              >
                {!n.read && (
                  <button
                    onClick={() => handleMarkRead(n)}
                    className="text-xs text-primary hover:underline"
                  >
                    Marquer comme lu
                  </button>
                )}
                <button
                  onClick={() => handleArchive(n)}
                  disabled={archiving === n._id}
                  className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
                >
                  {archiving === n._id ? "Archivage…" : "Archiver"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            disabled={page <= 1}
            onClick={() => load(page - 1)}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
          >
            Précédent
          </button>
          <span className="px-4 py-2 text-xs text-slate-400">
            Page {page} / {pagination.pages}
          </span>
          <button
            disabled={page >= pagination.pages}
            onClick={() => load(page + 1)}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
          >
            Suivant
          </button>
        </div>
      )}

      {/* Toast local */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-navy text-white text-xs px-5 py-2.5 rounded-full shadow-lg z-[9999]">
          {toast}
        </div>
      )}
    </div>
  );
}
