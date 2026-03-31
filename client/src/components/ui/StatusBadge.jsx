const config = {
  "en-route": {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    label: "EN ROUTE",
  },
  "sur-place": { bg: "bg-blue-100", text: "text-blue-700", label: "SUR PLACE" },
  termine: { bg: "bg-green-100", text: "text-green-700", label: "TERMINÉ" },
  attente: { bg: "bg-red-100", text: "text-red-600", label: "EN ATTENTE" },
  disponible: {
    bg: "bg-green-100",
    text: "text-green-700",
    label: "DISPONIBLE",
  },
  "hors-service": {
    bg: "bg-slate-100",
    text: "text-slate-500",
    label: "HORS SERVICE",
  },
};

export default function StatusBadge({ status }) {
  const s = config[status] || config["attente"];
  return (
    <span
      className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}
    >
      {s.label}
    </span>
  );
}
