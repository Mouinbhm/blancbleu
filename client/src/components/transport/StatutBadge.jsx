// Fichier : client/src/components/transport/StatutBadge.jsx
const CONFIG = {
  REQUESTED:              { label: "Demandé",              bg: "bg-slate-100",  text: "text-slate-700",  dot: "bg-slate-500"  },
  CONFIRMED:              { label: "Confirmé",             bg: "bg-blue-100",   text: "text-blue-700",   dot: "bg-blue-500"   },
  SCHEDULED:              { label: "Planifié",             bg: "bg-indigo-100", text: "text-indigo-700", dot: "bg-indigo-500" },
  ASSIGNED:               { label: "Assigné",              bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500" },
  EN_ROUTE_TO_PICKUP:     { label: "En route",             bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
  ARRIVED_AT_PICKUP:      { label: "Sur place",            bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500" },
  PATIENT_ON_BOARD:       { label: "Patient à bord",       bg: "bg-cyan-100",   text: "text-cyan-700",   dot: "bg-cyan-500"   },
  ARRIVED_AT_DESTINATION: { label: "Arrivé destination",   bg: "bg-teal-100",   text: "text-teal-700",   dot: "bg-teal-500"   },
  COMPLETED:              { label: "Terminé",              bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500"  },
  CANCELLED:              { label: "Annulé",               bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500"    },
  NO_SHOW:                { label: "Non présenté",         bg: "bg-pink-100",   text: "text-pink-700",   dot: "bg-pink-500"   },
  RESCHEDULED:            { label: "Reprogrammé",          bg: "bg-amber-100",  text: "text-amber-700",  dot: "bg-amber-500"  },
};

export default function StatutBadge({ statut, size = "sm" }) {
  const cfg = CONFIG[statut] || {
    label: statut,
    bg: "bg-slate-100",
    text: "text-slate-600",
    dot: "bg-slate-400",
  };

  const padding = size === "lg" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${cfg.bg} ${cfg.text} ${padding}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export { CONFIG as STATUT_CONFIG };
