import { useState, useEffect, useCallback } from "react";
import {
  unitService,
  personnelService,
  equipementService,
  maintenanceService,
} from "../services/api";

const TABS = ["Ambulances", "Personnel", "Équipements", "Maintenance"];

// ─── Helper : formatage date ──────────────────────────────────────────────────
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

// ─── Helper : spinner ─────────────────────────────────────────────────────────
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

export default function Flotte() {
  const [tab, setTab] = useState("Ambulances");
  const [filter, setFilter] = useState("Tous");

  // ── États par onglet ────────────────────────────────────────────────────
  const [units, setUnits] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [equipements, setEquipements] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Chargement selon l'onglet actif ────────────────────────────────────
  const load = useCallback(async (t) => {
    setLoading(true);
    setError(null);
    try {
      if (t === "Ambulances") {
        const { data } = await unitService.getAll();
        setUnits(data);
      } else if (t === "Personnel") {
        const { data } = await personnelService.getAll();
        setPersonnel(data);
      } else if (t === "Équipements") {
        const { data } = await equipementService.getAll();
        setEquipements(data);
      } else if (t === "Maintenance") {
        const { data } = await maintenanceService.getAll();
        setMaintenances(data);
      }
    } catch {
      setError("Impossible de charger les données.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  // ── KPIs ambulances ──────────────────────────────────────────────────────
  const kpis = [
    { l: "Total unités", v: units.length, bar: 100, color: "bg-slate-400" },
    {
      l: "Disponibles",
      v: units.filter((u) => u.statut === "disponible").length,
      bar: 56,
      color: "bg-emerald-500",
    },
    {
      l: "En mission",
      v: units.filter((u) => u.statut === "en_mission").length,
      bar: 37,
      color: "bg-blue-500",
    },
    {
      l: "Maintenance",
      v: units.filter(
        (u) => u.statut === "maintenance" || u.statut === "indisponible",
      ).length,
      bar: 7,
      color: "bg-yellow-500",
    },
  ];

  // ── Filtre ambulances ────────────────────────────────────────────────────
  const filterMap = {
    Tous: null,
    Disponible: "disponible",
    "En route": "en_mission",
    "Sur place": "en_mission",
    "Hors service": "maintenance",
  };
  const filtered =
    filter === "Tous"
      ? units
      : units.filter((u) => u.statut === filterMap[filter]);

  // ── Action : changer statut unité ────────────────────────────────────────
  const handleUnitStatus = async (id, statut) => {
    try {
      await unitService.updateStatus(id, statut);
      setUnits((prev) =>
        prev.map((u) => (u._id === id ? { ...u, statut } : u)),
      );
    } catch {
      alert("Erreur statut unité.");
    }
  };

  // ── Action : changer statut personnel ───────────────────────────────────
  const handlePersonnelStatus = async (id, statut) => {
    try {
      await personnelService.updateStatut(id, statut);
      setPersonnel((prev) =>
        prev.map((p) => (p._id === id ? { ...p, statut } : p)),
      );
    } catch {
      alert("Erreur statut personnel.");
    }
  };

  // ── Action : changer état équipement ────────────────────────────────────
  const handleEquipementEtat = async (id, etat) => {
    try {
      await equipementService.updateEtat(id, etat);
      setEquipements((prev) =>
        prev.map((e) => (e._id === id ? { ...e, etat } : e)),
      );
    } catch {
      alert("Erreur état équipement.");
    }
  };

  // ── Action : enregistrer contrôle équipement ────────────────────────────
  const handleControle = async (id) => {
    try {
      const { data } = await equipementService.enregistrerControle(id, {});
      setEquipements((prev) =>
        prev.map((e) => (e._id === id ? data.equipement : e)),
      );
    } catch {
      alert("Erreur contrôle.");
    }
  };

  // ── Action : changer statut maintenance ─────────────────────────────────
  const handleMaintenanceStatus = async (id, statut) => {
    try {
      await maintenanceService.updateStatut(id, statut);
      setMaintenances((prev) =>
        prev.map((m) => (m._id === id ? { ...m, statut } : m)),
      );
    } catch {
      alert("Erreur statut maintenance.");
    }
  };

  return (
    <div className="p-7 fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-brand font-bold text-2xl text-navy">
            Flotte & Ressources
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Gestion opérationnelle des unités de secours
          </p>
        </div>
        <button className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-lg">add</span>
          Nouvelle Unité
        </button>
      </div>

      {/* ── KPIs (toujours visibles) ── */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {kpis.map((k) => (
          <div
            key={k.l}
            className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm"
          >
            <p className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-2">
              {k.l}
            </p>
            <p className="font-mono text-3xl font-bold text-navy mb-3">{k.v}</p>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${k.color}`}
                style={{ width: `${k.bar}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── TABS ── */}
      <div className="flex border-b border-slate-200 mb-5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setFilter("Tous");
            }}
            className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-navy"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          ONGLET 1 — AMBULANCES
      ══════════════════════════════════════════ */}
      {tab === "Ambulances" && (
        <>
          <div className="flex gap-2 mb-4">
            {[
              "Tous",
              "Disponible",
              "En route",
              "Sur place",
              "Hors service",
            ].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  filter === f
                    ? "bg-navy text-white"
                    : "bg-white border border-slate-200 text-slate-500 hover:border-navy"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100">
            {loading ? (
              <Spinner />
            ) : error ? (
              <div className="text-center py-12 text-red-400">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                Aucune unité trouvée
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-navy">
                    {[
                      "ID",
                      "Type",
                      "Statut",
                      "Adresse",
                      "Équipage",
                      "Carburant",
                      "KM",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-4 text-left font-mono text-xs text-white/70 uppercase tracking-widest"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u, i) => (
                    <tr
                      key={u._id}
                      className={`border-b border-slate-100 hover:bg-blue-50 hover:border-l-4 hover:border-l-primary cursor-pointer transition-all ${i % 2 === 1 ? "bg-slate-50/30" : "bg-white"}`}
                    >
                      <td className="px-5 py-4 font-mono font-bold text-navy text-sm">
                        {u.nom}
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-slate-700">
                        {u.type}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-bold ${
                            u.statut === "disponible"
                              ? "bg-emerald-100 text-emerald-700"
                              : u.statut === "en_mission"
                                ? "bg-blue-100 text-blue-700"
                                : u.statut === "maintenance"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                          }`}
                        >
                          {u.statut === "disponible"
                            ? "DISPONIBLE"
                            : u.statut === "en_mission"
                              ? "EN MISSION"
                              : u.statut === "maintenance"
                                ? "MAINTENANCE"
                                : "INDISPONIBLE"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {u.position?.adresse || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {u.equipage?.length > 0
                          ? `${u.equipage.length} membre(s)`
                          : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${u.carburant > 60 ? "bg-emerald-500" : u.carburant > 30 ? "bg-yellow-500" : "bg-red-500"}`}
                              style={{ width: `${u.carburant || 0}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-slate-500">
                            {u.carburant || 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-sm text-slate-600">
                        {u.kilometrage?.toLocaleString() || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-1">
                          <button
                            title="Voir"
                            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-blue-50 hover:border-primary transition-all group"
                          >
                            <span className="material-symbols-outlined text-slate-400 text-sm group-hover:text-primary">
                              visibility
                            </span>
                          </button>
                          <button
                            title="Carte"
                            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-blue-50 hover:border-primary transition-all group"
                          >
                            <span className="material-symbols-outlined text-slate-400 text-sm group-hover:text-primary">
                              location_on
                            </span>
                          </button>
                          {u.statut === "disponible" ? (
                            <button
                              title="Mettre en maintenance"
                              onClick={() =>
                                handleUnitStatus(u._id, "maintenance")
                              }
                              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-yellow-50 hover:border-yellow-400 transition-all group"
                            >
                              <span className="material-symbols-outlined text-slate-400 text-sm group-hover:text-yellow-500">
                                build
                              </span>
                            </button>
                          ) : u.statut === "maintenance" ? (
                            <button
                              title="Remettre disponible"
                              onClick={() =>
                                handleUnitStatus(u._id, "disponible")
                              }
                              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-green-50 hover:border-green-400 transition-all group"
                            >
                              <span className="material-symbols-outlined text-slate-400 text-sm group-hover:text-green-500">
                                check_circle
                              </span>
                            </button>
                          ) : (
                            <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center opacity-40 cursor-not-allowed">
                              <span className="material-symbols-outlined text-slate-400 text-sm">
                                build
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Affichage de {filtered.length} sur {units.length} unités
              </span>
              <button className="flex items-center gap-2 text-xs font-bold text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white transition-all">
                <span className="material-symbols-outlined text-sm">
                  download
                </span>
                Exporter CSV
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════
          ONGLET 2 — PERSONNEL
      ══════════════════════════════════════════ */}
      {tab === "Personnel" && (
        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <p className="font-bold text-navy text-sm">
              {personnel.length} membres du personnel
            </p>
            <button className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors">
              <span className="material-symbols-outlined text-sm">
                person_add
              </span>
              Ajouter
            </button>
          </div>
          {loading ? (
            <Spinner />
          ) : error ? (
            <div className="text-center py-12 text-red-400">{error}</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-navy">
                  {[
                    "Nom",
                    "Rôle",
                    "Unité assignée",
                    "Statut",
                    "Contact",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-4 text-left font-mono text-xs text-white/70 uppercase tracking-widest"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {personnel.map((p, i) => (
                  <tr
                    key={p._id}
                    className={`border-b border-slate-100 hover:bg-blue-50 transition-all ${i % 2 === 1 ? "bg-slate-50/30" : "bg-white"}`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {`${p.prenom?.[0] || ""}${p.nom?.[0] || ""}`.toUpperCase()}
                        </div>
                        <span className="font-semibold text-navy text-sm">
                          {p.prenom} {p.nom}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${
                          p.role === "Médecin"
                            ? "bg-purple-100 text-purple-700"
                            : p.role === "Infirmier"
                              ? "bg-blue-100 text-blue-700"
                              : p.role === "Ambulancier"
                                ? "bg-teal-100 text-teal-700"
                                : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {p.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-navy text-sm">
                      {p.uniteAssignee?.nom || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <select
                        value={p.statut}
                        onChange={(e) =>
                          handlePersonnelStatus(p._id, e.target.value)
                        }
                        className={`px-2 py-1 rounded-full text-xs font-bold border-0 cursor-pointer ${
                          p.statut === "en-service"
                            ? "bg-emerald-100 text-emerald-700"
                            : p.statut === "conge"
                              ? "bg-yellow-100 text-yellow-700"
                              : p.statut === "maladie"
                                ? "bg-red-100 text-red-700"
                                : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        <option value="en-service">En service</option>
                        <option value="conge">Congé</option>
                        <option value="formation">Formation</option>
                        <option value="maladie">Maladie</option>
                        <option value="inactif">Inactif</option>
                      </select>
                    </td>
                    <td className="px-5 py-4 font-mono text-sm text-slate-500">
                      {p.telephone || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1">
                        <button
                          title="Voir fiche"
                          className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-blue-50 hover:border-primary transition-all group"
                        >
                          <span className="material-symbols-outlined text-slate-400 text-sm group-hover:text-primary">
                            visibility
                          </span>
                        </button>
                        <button
                          title="Modifier"
                          className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-blue-50 hover:border-primary transition-all group"
                        >
                          <span className="material-symbols-outlined text-slate-400 text-sm group-hover:text-primary">
                            edit
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              {personnel.length} membres —{" "}
              {personnel.filter((p) => p.statut === "en-service").length} en
              service
            </span>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          ONGLET 3 — ÉQUIPEMENTS
      ══════════════════════════════════════════ */}
      {tab === "Équipements" && (
        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <p className="font-bold text-navy text-sm">
              {equipements.length} équipements médicaux
            </p>
            <div className="flex gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                {equipements.filter((e) => e.etat === "en-panne").length} en
                panne
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
                {equipements.filter((e) => e.etat === "à-vérifier").length} à
                vérifier
              </span>
            </div>
          </div>
          {loading ? (
            <Spinner />
          ) : error ? (
            <div className="text-center py-12 text-red-400">{error}</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-navy">
                  {[
                    "Équipement",
                    "Unité",
                    "Catégorie",
                    "État",
                    "Dernier contrôle",
                    "Expiration",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-4 text-left font-mono text-xs text-white/70 uppercase tracking-widest"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {equipements.map((e, i) => (
                  <tr
                    key={e._id}
                    className={`border-b border-slate-100 hover:bg-blue-50 transition-all ${i % 2 === 1 ? "bg-slate-50/30" : "bg-white"}`}
                  >
                    <td className="px-5 py-4 font-semibold text-navy text-sm">
                      {e.nom}
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-primary text-sm">
                      {e.uniteAssignee?.nom || "—"}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {e.categorie || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <select
                        value={e.etat}
                        onChange={(ev) =>
                          handleEquipementEtat(e._id, ev.target.value)
                        }
                        className={`px-2 py-1 rounded-full text-xs font-bold border-0 cursor-pointer ${
                          e.etat === "opérationnel"
                            ? "bg-emerald-100 text-emerald-700"
                            : e.etat === "à-vérifier"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        <option value="opérationnel">Opérationnel</option>
                        <option value="à-vérifier">À vérifier</option>
                        <option value="en-panne">En panne</option>
                        <option value="réformé">Réformé</option>
                      </select>
                    </td>
                    <td className="px-5 py-4 font-mono text-sm text-slate-500">
                      {fmtDate(e.dernierControle)}
                    </td>
                    <td className="px-5 py-4 font-mono text-sm text-slate-500">
                      {fmtDate(e.dateExpiration)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1">
                        <button
                          title="Enregistrer contrôle"
                          onClick={() => handleControle(e._id)}
                          className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-blue-50 hover:border-primary transition-all group"
                        >
                          <span className="material-symbols-outlined text-slate-400 text-sm group-hover:text-primary">
                            fact_check
                          </span>
                        </button>
                        <button
                          title="Signaler panne"
                          onClick={() =>
                            handleEquipementEtat(e._id, "en-panne")
                          }
                          className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-red-50 hover:border-red-400 transition-all group"
                        >
                          <span className="material-symbols-outlined text-slate-400 text-sm group-hover:text-red-500">
                            warning
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              {equipements.length} équipements ·{" "}
              {equipements.filter((e) => e.etat === "opérationnel").length}{" "}
              opérationnels
            </span>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          ONGLET 4 — MAINTENANCE
      ══════════════════════════════════════════ */}
      {tab === "Maintenance" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 mb-2">
            {[
              {
                l: "En cours",
                v: maintenances.filter((m) => m.statut === "en-cours").length,
                color: "bg-blue-100 text-blue-700",
              },
              {
                l: "Planifiés",
                v: maintenances.filter((m) => m.statut === "planifié").length,
                color: "bg-yellow-100 text-yellow-700",
              },
              {
                l: "Terminés",
                v: maintenances.filter((m) => m.statut === "terminé").length,
                color: "bg-emerald-100 text-emerald-700",
              },
            ].map((k) => (
              <div
                key={k.l}
                className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm flex items-center gap-4"
              >
                <span
                  className={`px-3 py-1 rounded-full text-sm font-bold ${k.color}`}
                >
                  {k.v}
                </span>
                <span className="text-slate-500 text-sm">{k.l}</span>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <p className="font-bold text-navy text-sm">
                Planification des maintenances
              </p>
              <button className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors">
                <span className="material-symbols-outlined text-sm">add</span>
                Planifier
              </button>
            </div>
            {loading ? (
              <Spinner />
            ) : error ? (
              <div className="text-center py-12 text-red-400">{error}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-navy">
                    {[
                      "Unité",
                      "Type",
                      "Statut",
                      "Début",
                      "Fin prévue",
                      "Garage",
                      "Coût",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-4 text-left font-mono text-xs text-white/70 uppercase tracking-widest"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {maintenances.map((m, i) => (
                    <tr
                      key={m._id}
                      className={`border-b border-slate-100 hover:bg-blue-50 transition-all ${i % 2 === 1 ? "bg-slate-50/30" : "bg-white"}`}
                    >
                      <td className="px-4 py-4 font-mono font-bold text-navy text-sm">
                        {m.unite?.nom || "—"}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {m.type}
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={m.statut}
                          onChange={(e) =>
                            handleMaintenanceStatus(m._id, e.target.value)
                          }
                          className={`px-2 py-1 rounded-full text-xs font-bold border-0 cursor-pointer ${
                            m.statut === "en-cours"
                              ? "bg-blue-100 text-blue-700"
                              : m.statut === "planifié"
                                ? "bg-yellow-100 text-yellow-700"
                                : m.statut === "annulé"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          <option value="planifié">Planifié</option>
                          <option value="en-cours">En cours</option>
                          <option value="terminé">Terminé</option>
                          <option value="annulé">Annulé</option>
                        </select>
                      </td>
                      <td className="px-4 py-4 font-mono text-sm text-slate-500">
                        {fmtDate(m.dateDebut)}
                      </td>
                      <td className="px-4 py-4 font-mono text-sm text-slate-500">
                        {fmtDate(m.dateFin)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500">
                        {m.garage || "—"}
                      </td>
                      <td className="px-4 py-4 font-mono text-sm text-slate-600">
                        {m.cout ? `${m.cout.toLocaleString()} €` : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-1">
                          <button
                            title="Voir détails"
                            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-blue-50 hover:border-primary transition-all group"
                          >
                            <span className="material-symbols-outlined text-slate-400 text-sm group-hover:text-primary">
                              visibility
                            </span>
                          </button>
                          {m.statut !== "terminé" && m.statut !== "annulé" && (
                            <button
                              title="Marquer terminé"
                              onClick={() =>
                                handleMaintenanceStatus(m._id, "terminé")
                              }
                              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-green-50 hover:border-green-400 transition-all group"
                            >
                              <span className="material-symbols-outlined text-slate-400 text-sm group-hover:text-green-500">
                                check_circle
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                {maintenances.length} interventions de maintenance
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Insight ── */}
      <div className="mt-5 bg-gradient-to-r from-blue-50 to-white rounded-xl border border-blue-100 p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-primary">
            psychology
          </span>
        </div>
        <div>
          <p className="font-bold text-navy text-sm mb-1">
            Optimisation IA Flotte
          </p>
          <p className="text-sm text-slate-600">
            Pic d'activité prévu dans{" "}
            <span className="font-mono font-bold text-primary">45 min</span> en
            Secteur Nord. Déployer{" "}
            <span className="font-mono font-bold text-primary">AMB-01</span> en
            position stratégique Zone B-12.
          </p>
          <button className="mt-3 bg-primary text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Appliquer la recommandation
          </button>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
