// Fichier : client/src/pages/TransportDetail.jsx
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import StatutBadge from "../components/transport/StatutBadge";
import TransportTimeline from "../components/transport/TransportTimeline";
import TransportMap from "../components/map/TransportMap";
import { transportService, vehicleService } from "../services/api";
import useSocket from "../hooks/useSocket";

const fmtDatetime = (d) =>
  d
    ? new Date(d).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function InfoBlock({ label, value, icon }) {
  return (
    <div className="bg-surface rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon && (
          <span className="material-symbols-outlined text-slate-400 text-sm">
            {icon}
          </span>
        )}
        <p className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
          {label}
        </p>
      </div>
      <p className="font-semibold text-navy text-sm">{value || "—"}</p>
    </div>
  );
}

// Boutons d'action selon statut
const ACTIONS_CONFIG = {
  REQUESTED: [
    { label: "Confirmer", fn: "confirmer", color: "blue", icon: "check_circle" },
  ],
  CONFIRMED: [
    { label: "Planifier", fn: "planifier", color: "indigo", icon: "calendar_month" },
  ],
  SCHEDULED: [],
  ASSIGNED: [
    { label: "En route", fn: "enRoute", color: "orange", icon: "directions_car" },
  ],
  EN_ROUTE_TO_PICKUP: [
    { label: "Arrivé patient", fn: "arriveePatient", color: "yellow", icon: "location_on" },
  ],
  ARRIVED_AT_PICKUP: [
    { label: "Patient à bord", fn: "patientABord", color: "cyan", icon: "personal_injury" },
  ],
  PATIENT_ON_BOARD: [
    { label: "Arrivé destination", fn: "arriveeDestination", color: "teal", icon: "flag" },
  ],
  ARRIVED_AT_DESTINATION: [
    { label: "Terminer", fn: "completer", color: "green", icon: "check_circle" },
  ],
};

const BTN_COLOR = {
  blue:   "bg-blue-600 hover:bg-blue-700 text-white",
  indigo: "bg-indigo-600 hover:bg-indigo-700 text-white",
  orange: "bg-orange-500 hover:bg-orange-600 text-white",
  yellow: "bg-yellow-500 hover:bg-yellow-600 text-white",
  cyan:   "bg-cyan-600 hover:bg-cyan-700 text-white",
  teal:   "bg-teal-600 hover:bg-teal-700 text-white",
  green:  "bg-emerald-600 hover:bg-emerald-700 text-white",
  red:    "bg-red-600 hover:bg-red-700 text-white",
};

export default function TransportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [transport, setTransport] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAssigner, setShowAssigner] = useState(false);
  const [vehicleSelectionne, setVehicleSelectionne] = useState("");
  const [vehiclePosition, setVehiclePosition] = useState(null);

  const { subscribe } = useSocket();

  const loadTransport = useCallback(async () => {
    try {
      setErreur(null);
      const { data } = await transportService.getOne(id);
      setTransport(data);
    } catch {
      setErreur("Transport introuvable.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadTransport(); }, [loadTransport]);

  // Charger les véhicules disponibles pour assignation
  useEffect(() => {
    vehicleService.getAll({ statut: "disponible" }).then(({ data }) => {
      const list = Array.isArray(data) ? data : data?.vehicles || [];
      setVehicles(list);
    }).catch(() => {});
  }, []);

  // Temps réel : statut mis à jour
  useEffect(() => {
    const unsub = subscribe("status:updated", (d) => {
      if (d.transportId === id || d._id === id) loadTransport();
    });
    return unsub;
  }, [subscribe, id, loadTransport]);

  // Temps réel : position véhicule
  useEffect(() => {
    const unsub = subscribe("unit:location_updated", (d) => {
      if (d.vehicleId === transport?.vehicule?._id) {
        setVehiclePosition({ lat: d.lat, lng: d.lng });
      }
    });
    return unsub;
  }, [subscribe, transport?.vehicule?._id]);

  const handleAction = async (fn) => {
    setActionLoading(true);
    try {
      await transportService[fn](id);
      await loadTransport();
    } catch (err) {
      alert(err.response?.data?.message || "Erreur lors de l'action");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssigner = async () => {
    if (!vehicleSelectionne) return;
    setActionLoading(true);
    try {
      await transportService.assigner(id, { vehiculeId: vehicleSelectionne });
      await loadTransport();
      setShowAssigner(false);
    } catch (err) {
      alert(err.response?.data?.message || "Erreur lors de l'assignation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAnnuler = async () => {
    const raison = window.prompt("Raison de l'annulation :");
    if (raison === null) return;
    setActionLoading(true);
    try {
      await transportService.annuler(id, raison);
      await loadTransport();
    } catch (err) {
      alert(err.response?.data?.message || "Erreur");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <div
          style={{
            width: 24,
            height: 24,
            border: "2px solid #e2e8f0",
            borderTop: "2px solid #1D6EF5",
            borderRadius: "50%",
            animation: "spin .7s linear infinite",
          }}
        />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (erreur || !transport) {
    return (
      <div className="p-7 text-center">
        <span className="material-symbols-outlined text-slate-300 text-5xl block mb-3">
          error
        </span>
        <p className="text-slate-500">{erreur || "Transport introuvable"}</p>
        <button
          onClick={() => navigate("/transports")}
          className="mt-4 text-primary font-semibold hover:underline text-sm"
        >
          ← Retour aux transports
        </button>
      </div>
    );
  }

  const actions = ACTIONS_CONFIG[transport.statut] || [];
  const peutAnnuler = !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(transport.statut);
  const peutAssigner = ["CONFIRMED", "SCHEDULED"].includes(transport.statut);

  return (
    <div className="p-7 fade-in">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/transports")}
            className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-surface transition-colors"
          >
            <span className="material-symbols-outlined text-slate-500">
              arrow_back
            </span>
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-brand font-bold text-navy text-xl">
                {transport.numero}
              </h1>
              <StatutBadge statut={transport.statut} size="lg" />
            </div>
            <p className="text-slate-400 text-sm">
              Créé le {fmtDatetime(transport.createdAt)}
            </p>
          </div>
        </div>

        {/* Actions principales */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {peutAssigner && (
            <button
              onClick={() => setShowAssigner(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 font-semibold text-sm hover:bg-purple-100 transition-colors"
            >
              <span className="material-symbols-outlined text-base">
                airport_shuttle
              </span>
              Assigner véhicule
            </button>
          )}
          {actions.map((a) => (
            <button
              key={a.fn}
              onClick={() => handleAction(a.fn)}
              disabled={actionLoading}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 ${BTN_COLOR[a.color]}`}
            >
              <span className="material-symbols-outlined text-base">
                {a.icon}
              </span>
              {a.label}
            </button>
          ))}
          {peutAnnuler && (
            <button
              onClick={handleAnnuler}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 font-semibold text-sm hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">cancel</span>
              Annuler
            </button>
          )}
        </div>
      </div>

      {/* Modal assignation */}
      {showAssigner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="font-brand font-bold text-navy text-base mb-4">
              Assigner un véhicule
            </h3>
            <select
              value={vehicleSelectionne}
              onChange={(e) => setVehicleSelectionne(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm mb-4 outline-none focus:border-primary bg-white"
            >
              <option value="">Choisir un véhicule disponible…</option>
              {vehicles.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.nom} — {v.immatriculation} ({v.type})
                </option>
              ))}
            </select>
            {vehicles.length === 0 && (
              <p className="text-sm text-amber-600 mb-4">
                Aucun véhicule disponible actuellement.
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowAssigner(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-surface"
              >
                Annuler
              </button>
              <button
                onClick={handleAssigner}
                disabled={!vehicleSelectionne || actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 disabled:opacity-50"
              >
                Assigner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Corps */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-4">
          {/* Infos patient */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-brand font-bold text-navy text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">
                personal_injury
              </span>
              Patient
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <InfoBlock
                label="Nom complet"
                value={`${transport.patient?.nom} ${transport.patient?.prenom}`}
                icon="person"
              />
              <InfoBlock
                label="Téléphone"
                value={transport.patient?.telephone}
                icon="call"
              />
              <InfoBlock
                label="Mobilité"
                value={transport.patient?.mobilite}
                icon="accessibility"
              />
              <InfoBlock
                label="Besoins"
                value={[
                  transport.patient?.oxygene && "Oxygène",
                  transport.patient?.brancardage && "Brancardage",
                  transport.patient?.accompagnateur && "Accompagnateur",
                ]
                  .filter(Boolean)
                  .join(", ") || "Aucun"}
                icon="medical_services"
              />
            </div>
          </div>

          {/* Infos transport */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-brand font-bold text-navy text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">
                directions_car
              </span>
              Transport
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <InfoBlock label="Motif" value={transport.motif} icon="medical_services" />
              <InfoBlock label="Type" value={transport.typeTransport} icon="airport_shuttle" />
              <InfoBlock
                label="Date & heure RDV"
                value={`${transport.dateTransport ? new Date(transport.dateTransport).toLocaleDateString("fr-FR") : "—"} à ${transport.heureRDV || "—"}`}
                icon="schedule"
              />
              <InfoBlock
                label="Aller-retour"
                value={transport.allerRetour ? "Oui" : "Non"}
                icon="repeat"
              />
              <InfoBlock
                label="Départ"
                value={[
                  transport.adresseDepart?.rue,
                  transport.adresseDepart?.ville,
                ]
                  .filter(Boolean)
                  .join(", ")}
                icon="location_on"
              />
              <InfoBlock
                label="Destination"
                value={[
                  transport.adresseDestination?.nom,
                  transport.adresseDestination?.service,
                  transport.adresseDestination?.rue,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                icon="flag"
              />
            </div>
          </div>

          {/* Véhicule assigné */}
          {transport.vehicule && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-brand font-bold text-navy text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  airport_shuttle
                </span>
                Véhicule assigné
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <InfoBlock
                  label="Nom"
                  value={transport.vehicule?.nom}
                  icon="badge"
                />
                <InfoBlock
                  label="Immatriculation"
                  value={transport.vehicule?.immatriculation}
                  icon="pin"
                />
                <InfoBlock
                  label="Type"
                  value={transport.vehicule?.type}
                  icon="airport_shuttle"
                />
                <InfoBlock
                  label="Assigné le"
                  value={fmtDatetime(transport.heureAssignation)}
                  icon="schedule"
                />
              </div>
            </div>
          )}

          {/* Carte */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={{ height: 300 }}>
            <TransportMap
              transport={transport}
              vehiclePosition={
                vehiclePosition ||
                (transport.vehicule?.position?.lat
                  ? transport.vehicule.position
                  : null)
              }
            />
          </div>
        </div>

        {/* Colonne timeline */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-brand font-bold text-navy text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">
                timeline
              </span>
              Suivi du transport
            </h2>
            <TransportTimeline transport={transport} />
          </div>

          {/* Journal */}
          {transport.journal?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-brand font-bold text-navy text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  history
                </span>
                Journal
              </h2>
              <div className="space-y-3">
                {[...transport.journal].reverse().map((entry, i) => (
                  <div key={i} className="text-xs">
                    <div className="flex items-center gap-2 text-slate-400">
                      <span>{fmtDatetime(entry.timestamp)}</span>
                      <span>·</span>
                      <span>{entry.utilisateur}</span>
                    </div>
                    <p className="text-slate-700 mt-0.5">
                      {entry.de} → {entry.vers}
                    </p>
                    {entry.notes && (
                      <p className="text-slate-400 italic mt-0.5">{entry.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {transport.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-mono font-bold text-amber-600 uppercase tracking-widest mb-2">
                Notes
              </p>
              <p className="text-sm text-amber-800">{transport.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
