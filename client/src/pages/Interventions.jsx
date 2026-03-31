import { useState } from "react";
import InterventionCard from "../components/interventions/InterventionCard";
import KpiCard from "../components/ui/KpiCard";

const ALL = [
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
  {
    id: 7,
    ref: "#INT-2025-0820",
    priority: 1,
    type: "Détresse respirat.",
    address: "22 Rue de la Paix, Lyon 1er",
    unit: "AMB-11",
    status: "en-route",
    elapsed: "00:02:05",
    aiScore: 89,
  },
  {
    id: 8,
    ref: "#INT-2025-0815",
    priority: 3,
    type: "Malaise alcool",
    address: "Place Bellecour, Lyon",
    unit: "AMB-12",
    status: "sur-place",
    elapsed: "00:28:10",
    aiScore: 38,
  },
];

const FILTERS = ["Tout", "P1", "P2", "P3", "En route", "Sur place"];

export default function Interventions() {
  const [filter, setFilter] = useState("Tout");
  const [search, setSearch] = useState("");

  const filtered = ALL.filter((i) => {
    const matchFilter =
      filter === "Tout"
        ? true
        : filter === "P1"
          ? i.priority === 1
          : filter === "P2"
            ? i.priority === 2
            : filter === "P3"
              ? i.priority === 3
              : filter === "En route"
                ? i.status === "en-route"
                : filter === "Sur place"
                  ? i.status === "sur-place"
                  : true;
    const matchSearch =
      search === "" ||
      i.ref.toLowerCase().includes(search.toLowerCase()) ||
      i.type.toLowerCase().includes(search.toLowerCase()) ||
      i.address.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="p-7 fade-in">
      <div className="grid grid-cols-4 gap-5 mb-6">
        <KpiCard
          label="P1 Critique"
          value={ALL.filter((i) => i.priority === 1).length}
          color="danger"
        />
        <KpiCard
          label="P2 Urgent"
          value={ALL.filter((i) => i.priority === 2).length}
          color="warning"
        />
        <KpiCard
          label="P3 Standard"
          value={ALL.filter((i) => i.priority === 3).length}
          color="primary"
        />
        <KpiCard label="Total" value={ALL.length} color="success" />
      </div>

      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex gap-1 bg-surface rounded-lg p-1 border border-slate-200">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                filter === f
                  ? "bg-white text-navy shadow-sm"
                  : "text-slate-500 hover:text-navy"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2 w-56">
          <span className="material-symbols-outlined text-slate-400 text-lg">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="bg-transparent text-sm outline-none w-full text-slate-700 placeholder-slate-400"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
            <span className="material-symbols-outlined text-4xl block mb-2">
              search_off
            </span>
            Aucune intervention trouvée
          </div>
        ) : (
          filtered.map((i) => <InterventionCard key={i.id} data={i} />)
        )}
      </div>
    </div>
  );
}
