const colorMap = {
  danger: { border: "border-red-500", icon: "text-red-400" },
  warning: { border: "border-yellow-500", icon: "text-yellow-400" },
  success: { border: "border-emerald-500", icon: "text-emerald-400" },
  primary: { border: "border-blue-500", icon: "text-blue-400" },
};

export default function KpiCard({
  label,
  value,
  color = "primary",
  trend,
  trendType,
  icon,
}) {
  const c = colorMap[color] || colorMap.primary;
  return (
    <div
      className={`bg-white rounded-xl border-t-4 ${c.border} shadow-sm p-5 hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest leading-tight">
          {label}
        </p>
        {icon && (
          <span
            className={`material-symbols-outlined text-2xl ${c.icon} opacity-30`}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="font-mono text-3xl font-bold text-navy leading-none">
        {value}
      </p>
      {trend && (
        <p
          className={`text-xs mt-2 font-medium flex items-center gap-1 ${
            trendType === "good"
              ? "text-emerald-600"
              : trendType === "bad"
                ? "text-red-500"
                : "text-slate-400"
          }`}
        >
          {trend}
        </p>
      )}
    </div>
  );
}
