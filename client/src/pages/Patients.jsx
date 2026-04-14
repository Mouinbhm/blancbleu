// Fichier : client/src/pages/Patients.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import StatutBadge from "../components/transport/StatutBadge";
import { transportService } from "../services/api";

const MOBILITE_LABEL = {
  ASSIS: "Assis",
  FAUTEUIL_ROULANT: "Fauteuil roulant",
  ALLONGE: "Allongé",
  CIVIERE: "Civière",
};

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

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

// Grouper les transports par patient (nom+prenom)
function groupByPatient(transports) {
  const map = new Map();
  for (const t of transports) {
    const key = `${t.patient?.nom || ""}__${t.patient?.prenom || ""}`.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        nom: t.patient?.nom || "Inconnu",
        prenom: t.patient?.prenom || "",
        telephone: t.patient?.telephone || "",
        mobilite: t.patient?.mobilite || "",
        transports: [],
      });
    }
    map.get(key).transports.push(t);
  }
  // Trier par nom
  return Array.from(map.values()).sort((a, b) =>
    a.nom.localeCompare(b.nom, "fr"),
  );
}

export default function Patients() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [patientSelectionne, setPatientSelectionne] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    try {
      // On charge les transports récents pour en déduire les patients
      const { data } = await transportService.getAll({ limit: 500 });
      const liste = Array.isArray(data)
        ? data
        : data?.transports || data?.data || [];
      setPatients(groupByPatient(liste));
    } catch {
      setErreur("Impossible de charger les patients.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const patientsFiltres = patients.filter((p) => {
    if (!recherche.trim()) return true;
    const q = recherche.toLowerCase();
    return (
      p.nom.toLowerCase().includes(q) ||
      p.prenom.toLowerCase().includes(q) ||
      p.telephone.includes(q)
    );
  });

  const recurrents = patients.filter((p) =>
    p.transports.some((t) => t.recurrence?.active),
  ).length;

  return (
    <div className="p-7 fade-in">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-brand font-bold text-navy text-xl">Patients</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {patients.length} patient(s) · {recurrents} avec récurrence active
          </p>
        </div>
        <button
          onClick={() => navigate("/transports/new")}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors shadow-md shadow-primary/20"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Nouveau transport
        </button>
      </div>

      {/* Recherche */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-5 flex items-center gap-2">
        <span className="material-symbols-outlined text-slate-400">search</span>
        <input
          type="text"
          placeholder="Rechercher un patient par nom, prénom ou téléphone…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="flex-1 text-sm outline-none text-slate-700 placeholder-slate-400"
        />
        {recherche && (
          <button onClick={() => setRecherche("")}>
            <span className="material-symbols-outlined text-slate-400 text-base">
              close
            </span>
          </button>
        )}
      </div>

      {erreur && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
          {erreur}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Liste patients */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
                {patientsFiltres.length} patient(s)
              </div>
              {patientsFiltres.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  Aucun patient trouvé
                </div>
              ) : (
                <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                  {patientsFiltres.map((p, idx) => {
                    const dernierTransport = [...p.transports].sort(
                      (a, b) => new Date(b.dateTransport) - new Date(a.dateTransport),
                    )[0];
                    const estRecurrent = p.transports.some(
                      (t) => t.recurrence?.active,
                    );
                    const isSelected =
                      patientSelectionne?.nom === p.nom &&
                      patientSelectionne?.prenom === p.prenom;

                    return (
                      <div
                        key={idx}
                        onClick={() =>
                          setPatientSelectionne(isSelected ? null : p)
                        }
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-primary/5 border-l-4 border-l-primary"
                            : "hover:bg-surface"
                        }`}
                      >
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-navy flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {p.nom[0]?.toUpperCase()}
                          {p.prenom[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-navy">
                            {p.nom} {p.prenom}
                          </p>
                          <p className="text-xs text-slate-400">
                            {p.transports.length} transport(s)
                            {estRecurrent && " · Récurrent"}
                          </p>
                        </div>
                        {estRecurrent && (
                          <span className="material-symbols-outlined text-primary text-base">
                            repeat
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Détail patient sélectionné */}
          <div className="lg:col-span-2">
            {!patientSelectionne ? (
              <div className="bg-white rounded-xl border border-slate-200 p-16 text-center h-full flex flex-col items-center justify-center">
                <span
                  className="material-symbols-outlined text-slate-300"
                  style={{ fontSize: 48 }}
                >
                  personal_injury
                </span>
                <p className="text-slate-400 text-sm mt-3">
                  Sélectionnez un patient pour voir son historique
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Fiche patient */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-navy flex items-center justify-center text-white text-xl font-bold">
                      {patientSelectionne.nom[0]?.toUpperCase()}
                      {patientSelectionne.prenom[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h2 className="font-brand font-bold text-navy text-lg">
                        {patientSelectionne.nom} {patientSelectionne.prenom}
                      </h2>
                      <div className="flex items-center gap-3 mt-1">
                        {patientSelectionne.telephone && (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">
                              call
                            </span>
                            {patientSelectionne.telephone}
                          </span>
                        )}
                        {patientSelectionne.mobilite && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {MOBILITE_LABEL[patientSelectionne.mobilite] ||
                              patientSelectionne.mobilite}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-2xl font-mono font-bold text-navy">
                        {patientSelectionne.transports.length}
                      </p>
                      <p className="text-xs text-slate-400">transport(s)</p>
                    </div>
                  </div>

                  {/* Récurrences actives */}
                  {patientSelectionne.transports.some(
                    (t) => t.recurrence?.active,
                  ) && (
                    <div className="bg-blue-50 rounded-xl p-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-base">
                        repeat
                      </span>
                      <p className="text-sm text-blue-800">
                        Ce patient a des transports récurrents actifs.
                      </p>
                    </div>
                  )}
                </div>

                {/* Historique transports */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100">
                    <h3 className="font-brand font-bold text-navy text-sm uppercase tracking-wide">
                      Historique des transports
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {[...patientSelectionne.transports]
                      .sort(
                        (a, b) =>
                          new Date(b.dateTransport) -
                          new Date(a.dateTransport),
                      )
                      .map((t) => (
                        <div
                          key={t._id}
                          onClick={() => navigate(`/transports/${t._id}`)}
                          className="flex items-center gap-4 px-5 py-3 hover:bg-surface cursor-pointer transition-colors"
                        >
                          <div className="min-w-[80px]">
                            <p className="text-xs font-mono text-slate-500">
                              {fmtDate(t.dateTransport)}
                            </p>
                            <p className="text-sm font-bold text-navy">
                              {t.heureRDV || "—"}
                            </p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">
                              {t.motif}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {t.adresseDestination?.nom ||
                                t.adresseDestination?.rue ||
                                "—"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">
                              {t.typeTransport}
                            </span>
                            <StatutBadge statut={t.statut} />
                          </div>
                          {t.recurrence?.active && (
                            <span className="material-symbols-outlined text-primary text-base">
                              repeat
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
