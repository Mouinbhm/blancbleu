// Fichier : client/src/pages/Flotte.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import VehicleCard from "../components/vehicle/VehicleCard";
import { vehicleService } from "../services/api";
import useSocket from "../hooks/useSocket";

const FILTRES_STATUT = [
  { value: "", label: "Tous" },
  { value: "disponible", label: "Disponibles" },
  { value: "en_mission", label: "En mission" },
  { value: "maintenance", label: "Maintenance" },
  { value: "hors_service", label: "Hors service" },
];

const FILTRES_TYPE = [
  { value: "", label: "Tous types" },
  { value: "VSL", label: "VSL" },
  { value: "AMBULANCE", label: "Ambulance" },
  { value: "TPMR", label: "TPMR" },
];

const Spinner = () => (
  <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
    <div
      style={{
        width: 20,
        height: 20,
        border: "2px solid #e2e8f0",
        borderTop: "2px solid #1D6EF5",
        borderRadius: "50%",
        animation: "spin .7s linear infinite",
      }}
    />
    Chargement…
  </div>
);

const inputCls =
  "border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-white";

// ── Modal nouveau véhicule ────────────────────────────────────────────────────
function ModalNouveauVehicule({ onClose, onCreated }) {
  const [form, setForm] = useState({
    immatriculation: "",
    nom: "",
    type: "VSL",
    annee: new Date().getFullYear(),
    equipeFauteuil: false,
    equipeOxygene: false,
    equipeBrancard: false,
  });
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.immatriculation.trim() || !form.nom.trim()) {
      setErreur("Immatriculation et nom sont obligatoires.");
      return;
    }
    setLoading(true);
    try {
      await vehicleService.create(form);
      onCreated();
    } catch (err) {
      setErreur(err.response?.data?.message || "Erreur lors de la création.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-brand font-bold text-navy text-base">
            Nouveau véhicule
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {erreur && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
            {erreur}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">
                Immatriculation *
              </label>
              <input
                type="text"
                value={form.immatriculation}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    immatriculation: e.target.value.toUpperCase(),
                  }))
                }
                className={`w-full ${inputCls}`}
                placeholder="AA-000-AA"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">
                Type *
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className={`w-full ${inputCls}`}
              >
                <option value="VSL">VSL</option>
                <option value="AMBULANCE">Ambulance</option>
                <option value="TPMR">TPMR</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">
              Nom / Désignation *
            </label>
            <input
              type="text"
              value={form.nom}
              onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
              className={`w-full ${inputCls}`}
              placeholder="Ex : VSL Nice 01"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">
              Année
            </label>
            <input
              type="number"
              value={form.annee}
              onChange={(e) =>
                setForm((f) => ({ ...f, annee: parseInt(e.target.value) }))
              }
              className={`w-full ${inputCls}`}
              min={2000}
              max={new Date().getFullYear() + 1}
            />
          </div>
          <div className="flex flex-wrap gap-4">
            {[
              { key: "equipeOxygene", label: "Oxygène" },
              { key: "equipeFauteuil", label: "Fauteuil/rampe" },
              { key: "equipeBrancard", label: "Brancard" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.checked }))
                  }
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-surface"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Création…" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Flotte() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtreStatut, setFiltreStatut] = useState("");
  const [filtreType, setFiltreType] = useState("");
  const [showModal, setShowModal] = useState(false);

  const { subscribe } = useSocket();

  const loadData = useCallback(async () => {
    try {
      const vehRes = await vehicleService.getAll();
      const list = Array.isArray(vehRes.data)
        ? vehRes.data
        : vehRes.data?.vehicles || [];
      setVehicles(list);
    } catch {
      /* silencieux */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const unsub = subscribe("unit:location_updated", () => loadData());
    return unsub;
  }, [subscribe, loadData]);

  const vehiclesFiltres = vehicles.filter((v) => {
    if (filtreStatut && v.statut !== filtreStatut) return false;
    if (filtreType && v.type !== filtreType) return false;
    return true;
  });

  const disponibles = vehicles.filter((v) => v.statut === "disponible").length;
  const enMission = vehicles.filter((v) => v.statut === "en_mission").length;
  const maintenance = vehicles.filter((v) => v.statut === "maintenance").length;

  return (
    <div className="p-7 fade-in">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-brand font-bold text-navy text-xl">Flotte</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {vehicles.length} véhicule(s) enregistré(s)
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors shadow-md shadow-primary/20"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Nouveau véhicule
        </button>
      </div>

      {/* KPIs rapides */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {
            label: "Disponibles",
            value: disponibles,
            color: "text-green-600",
            bg: "bg-green-50",
          },
          {
            label: "En mission",
            value: enMission,
            color: "text-orange-600",
            bg: "bg-orange-50",
          },
          {
            label: "Maintenance",
            value: maintenance,
            color: "text-yellow-600",
            bg: "bg-yellow-50",
          },
        ].map((k) => (
          <div
            key={k.label}
            className={`${k.bg} rounded-xl p-4 text-center border border-white`}
          >
            <p className={`text-2xl font-mono font-bold ${k.color}`}>
              {k.value}
            </p>
            <p className="text-xs text-slate-500 mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {FILTRES_STATUT.map((f) => (
          <button
            key={f.value}
            onClick={() => setFiltreStatut(f.value)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              filtreStatut === f.value
                ? "bg-primary text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-surface"
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {FILTRES_TYPE.map((f) => (
            <button
              key={f.value}
              onClick={() => setFiltreType(f.value)}
              className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                filtreType === f.value
                  ? "bg-navy text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-surface"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grille véhicules */}
      {loading ? (
        <Spinner />
      ) : vehiclesFiltres.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <span
            className="material-symbols-outlined text-slate-300"
            style={{ fontSize: 56 }}
          >
            airport_shuttle
          </span>
          <p className="text-slate-400 text-sm mt-3">
            Aucun véhicule correspondant aux filtres
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {vehiclesFiltres.map((v) => (
            <VehicleCard
              key={v._id}
              vehicle={v}
              onClick={() =>
                v.transportEnCours
                  ? navigate(`/transports/${v.transportEnCours}`)
                  : null
              }
            />
          ))}
        </div>
      )}

      {showModal && (
        <ModalNouveauVehicule
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
