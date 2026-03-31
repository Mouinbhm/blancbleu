import StatusBadge from "../ui/StatusBadge";

const priorityConfig = {
  1: {
    border: "border-l-red-500",
    bg: "bg-gradient-to-r from-red-50/60 to-white",
    badge: "bg-red-100 text-red-600",
    label: "P1 CRITIQUE",
    time: "text-red-500",
  },
  2: {
    border: "border-l-yellow-500",
    bg: "bg-gradient-to-r from-yellow-50/40 to-white",
    badge: "bg-yellow-100 text-yellow-700",
    label: "P2 URGENT",
    time: "text-yellow-600",
  },
  3: {
    border: "border-l-blue-500",
    bg: "",
    badge: "bg-blue-100 text-blue-700",
    label: "P3 STANDARD",
    time: "text-blue-500",
  },
};

export default function InterventionCard({ data, onClick }) {
  const p = priorityConfig[data.priority] || priorityConfig[3];

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border-l-4 shadow-sm p-4 flex items-center justify-between
        cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200
        ${p.border} ${p.bg}`}
    >
      {/* LEFT */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${p.badge}`}
        >
          <span className="material-symbols-outlined text-xl">emergency</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-xs font-bold text-slate-400">
              {data.ref}
            </span>
            <span
              className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${p.badge}`}
            >
              {p.label}
            </span>
            {data.priority === 1 && (
              <span className="w-2 h-2 rounded-full bg-red-500 pulse-red flex-shrink-0" />
            )}
          </div>
          <h3 className="font-brand font-bold text-navy text-sm uppercase truncate">
            {data.type}
          </h3>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
            <span className="material-symbols-outlined text-sm flex-shrink-0">
              location_on
            </span>
            {data.address}
          </p>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-5 flex-shrink-0 ml-4">
        <div className="text-center hidden sm:block">
          <p className="text-xs font-mono text-slate-400 uppercase mb-1">
            Unité
          </p>
          <p className="font-mono text-xs font-bold text-navy">{data.unit}</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-mono text-slate-400 uppercase mb-1">
            Durée
          </p>
          <p className={`font-mono text-sm font-bold ${p.time}`}>
            {data.elapsed}
          </p>
        </div>
        <div className="w-20 hidden md:block">
          <p className="text-xs font-mono text-slate-400 uppercase mb-1">
            Score IA
          </p>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                data.aiScore > 80
                  ? "bg-emerald-500"
                  : data.aiScore > 60
                    ? "bg-yellow-500"
                    : "bg-blue-500"
              }`}
              style={{ width: `${data.aiScore}%` }}
            />
          </div>
          <p
            className={`text-xs font-mono font-bold text-right mt-0.5 ${
              data.aiScore > 80
                ? "text-emerald-600"
                : data.aiScore > 60
                  ? "text-yellow-600"
                  : "text-blue-500"
            }`}
          >
            {data.aiScore}%
          </p>
        </div>
        <StatusBadge status={data.status} />
        <span className="material-symbols-outlined text-slate-300 hidden sm:block">
          chevron_right
        </span>
      </div>
    </div>
  );
}
