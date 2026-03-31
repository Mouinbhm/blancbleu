import { useState } from "react";
import KpiCard from "../components/ui/KpiCard";
import InterventionCard from "../components/interventions/InterventionCard";
import UnitsPanel from "../components/units/UnitsPanel";

const MOCK_INTERVENTIONS = [
  {
    id: 1,
    ref: "#INT-2025-0847",
    priority: 1,
    type: "Arrêt cardiaque",
    address: "14 Rue Victor Hugo, Lyon 3ème",
    unit: "AMB-03",
    status: "en-route",
    elapsed: "00:04:32",
    aiScore: 94,
  },
  {
    id: 2,
    ref: "#INT-2025-0841",
    priority: 1,
    type: "AVC suspecté",
    address: "8 Av. Berthelot, Lyon 7ème",
    unit: "AMB-05",
    status: "sur-place",
    elapsed: "00:12:18",
    aiScore: 91,
  },
  {
    id: 3,
    ref: "#INT-2025-0838",
    priority: 2,
    type: "Accident voie pub.",
    address: "Quai Gailleton, Lyon 2ème",
    unit: "AMB-07",
    status: "en-route",
    elapsed: "00:07:05",
    aiScore: 78,
  },
  {
    id: 4,
    ref: "#INT-2025-0832",
    priority: 2,
    type: "Traumatisme",
    address: "Parc Tête d'Or, Lyon",
    unit: "AMB-02",
    status: "sur-place",
    elapsed: "00:19:44",
    aiScore: 65,
  },
  {
    id: 5,
    ref: "#INT-2025-0829",
    priority: 3,
    type: "Malaise général",
    address: "Gare Part-Dieu, Lyon 3ème",
    unit: "AMB-09",
    status: "en-route",
    elapsed: "00:03:20",
    aiScore: 55,
  },
  {
    id: 6,
    ref: "#INT-2025-0825",
    priority: 3,
    type: "Chute domicile",
    address: "150 Cours Lafayette, Lyon",
    unit: "AMB-04",
    status: "attente",
    elapsed: "00:01:47",
    aiScore: 42,
  },
];

const FILTERS = ["Tout", "P1 Critique", "P2 Urgent", "P3 Standard"];

export default function Dashboard() {
  const [filter, setFilter] = useState("Tout");
  const [selected, setSelected] = useState(null);

  const filtered =
    filter === "Tout"
      ? MOCK_INTERVENTIONS
      : MOCK_INTERVENTIONS.filter((i) =>
          filter === "P1 Critique"
            ? i.priority === 1
            : filter === "P2 Urgent"
              ? i.priority === 2
              : i.priority === 3,
        );

  return (
    <div className="p-7 fade-in">
      {/* KPI STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-7">
        <KpiCard
          label="Interventions actives"
          value={12}
          color="danger"
          icon="emergency"
          trend="↑2 depuis 1h"
          trendType="bad"
        />
        <KpiCard
          label="En attente"
          value={4}
          color="warning"
          icon="hourglass_empty"
          trend="Avg: 02:15"
        />
        <KpiCard
          label="Terminées aujourd'hui"
          value={31}
          color="success"
          icon="check_circle"
          trend="↑8% vs hier"
          trendType="good"
        />
        <KpiCard
          label="TMR moyen"
          value="5.8 min"
          color="primary"
          icon="speed"
          trend="↓0.4min vs hier"
          trendType="good"
        />
      </div>

      {/* IA INSIGHT BANNER */}
      <div className="bg-gradient-to-r from-navy to-blue-900 rounded-xl p-4 mb-6 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/30 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-white text-xl">
            psychology
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-blue-300 uppercase tracking-widest mb-0.5">
            Aide IA
          </p>
          <p className="text-sm text-white font-medium">
            Hausse de <span className="text-yellow-400 font-bold">+12%</span>{" "}
            des appels P1 prévue dans 2h. Suggestion : Redéployer{" "}
            <span className="text-blue-300 font-bold">AMB-09</span> vers Secteur
            4.
          </p>
        </div>
        <button className="text-xs font-bold text-primary border border-primary/40 px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white transition-all flex-shrink-0">
          Appliquer
        </button>
      </div>

      {/* MAIN GRID */}
      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 300px" }}>
        {/* Interventions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-brand font-bold text-navy text-base uppercase tracking-tight">
                Interventions en cours
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {filtered.length} intervention(s) affichée(s)
              </p>
            </div>
            <div className="flex gap-1 bg-surface rounded-lg p-1 border border-slate-200">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    filter === f
                      ? "bg-white text-navy shadow-sm"
                      : "text-slate-500 hover:text-navy"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filtered.map((i) => (
              <InterventionCard
                key={i.id}
                data={i}
                onClick={() => setSelected(selected?.id === i.id ? null : i)}
              />
            ))}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="mt-4 bg-white rounded-xl border border-slate-200 p-5 slide-up shadow-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-brand font-bold text-navy">
                  {selected.ref} — Détails
                </h3>
                <button
                  onClick={() => setSelected(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  ["Type", selected.type],
                  ["Unité", selected.unit],
                  ["Statut", selected.status],
                  ["Priorité", `P${selected.priority}`],
                  ["Durée", selected.elapsed],
                  ["Score IA", `${selected.aiScore}%`],
                ].map(([k, v]) => (
                  <div key={k} className="bg-surface rounded-lg p-3">
                    <p className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-1">
                      {k}
                    </p>
                    <p className="font-bold text-navy text-sm">{v}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-4">
                <button className="flex-1 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">
                  Voir sur la carte
                </button>
                <button className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-surface transition-colors">
                  Modifier le statut
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Units Panel */}
        <UnitsPanel />
      </div>
    </div>
  );
}
