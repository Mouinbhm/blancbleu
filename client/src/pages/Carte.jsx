export default function Carte() {
  const units = [
    { id: "AMB-01", x: "22%", y: "35%", status: "disponible", label: "AMB-01" },
    {
      id: "AMB-03",
      x: "47%",
      y: "28%",
      status: "en-route",
      label: "AMB-03 ETA 4m",
    },
    { id: "AMB-07", x: "62%", y: "52%", status: "disponible", label: "AMB-07" },
    { id: "AMB-11", x: "78%", y: "38%", status: "disponible", label: "AMB-11" },
  ];
  const incidents = [
    { id: "P1-1", x: "50%", y: "32%", priority: 1, label: "Arrêt cardiaque" },
    { id: "P2-1", x: "30%", y: "55%", priority: 2, label: "Accident route" },
    { id: "P3-1", x: "70%", y: "62%", priority: 3, label: "Malaise" },
  ];

  const statusColor = {
    disponible: "bg-blue-500",
    "en-route": "bg-yellow-500",
    "sur-place": "bg-red-500",
  };
  const incidentColor = {
    1: "bg-red-500",
    2: "bg-yellow-500",
    3: "bg-blue-500",
  };

  return (
    <div className="p-7 fade-in">
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          ["Unités actives", "9", "success"],
          ["Incidents actifs", "12", "danger"],
          ["Zones critiques", "2", "warning"],
          ["Couverture", "87%", "primary"],
        ].map(([l, v, c]) => (
          <div
            key={l}
            className={`bg-white rounded-xl p-4 border-t-4 shadow-sm ${
              c === "success"
                ? "border-emerald-500"
                : c === "danger"
                  ? "border-red-500"
                  : c === "warning"
                    ? "border-yellow-500"
                    : "border-blue-500"
            }`}
          >
            <p className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-1">
              {l}
            </p>
            <p className="font-mono text-2xl font-bold text-navy">{v}</p>
          </div>
        ))}
      </div>

      {/* MAP */}
      <div
        className="bg-slate-900 rounded-2xl overflow-hidden relative"
        style={{ height: "520px" }}
      >
        {/* Grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(29,110,245,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(29,110,245,0.08) 1px,transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* SVG routes */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <path
            d="M 47% 28% Q 48% 30% 50% 32%"
            stroke="rgba(29,110,245,0.6)"
            strokeWidth="2"
            fill="none"
            strokeDasharray="8 5"
          />
          <path
            d="M 22% 35% Q 25% 45% 30% 55%"
            stroke="rgba(217,119,6,0.5)"
            strokeWidth="2"
            fill="none"
            strokeDasharray="6 4"
          />
          {/* Zones */}
          <ellipse
            cx="40%"
            cy="40%"
            rx="15%"
            ry="12%"
            fill="rgba(29,110,245,0.06)"
            stroke="rgba(29,110,245,0.2)"
            strokeWidth="1"
          />
        </svg>

        {/* Unit pins */}
        {units.map((u) => (
          <div
            key={u.id}
            className="absolute cursor-pointer group"
            style={{ left: u.x, top: u.y, transform: "translate(-50%,-50%)" }}
          >
            <div
              className={`w-9 h-9 rounded-full ${statusColor[u.status]} flex items-center justify-center text-white border-2 border-white shadow-lg
              ${u.status === "disponible" ? "animate-pulse" : ""} hover:scale-110 transition-transform`}
            >
              <span className="material-symbols-outlined text-sm">
                ambulance
              </span>
            </div>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black/70 text-white text-xs font-mono px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              {u.label}
            </div>
          </div>
        ))}

        {/* Incident pins */}
        {incidents.map((inc) => (
          <div
            key={inc.id}
            className="absolute cursor-pointer group"
            style={{
              left: inc.x,
              top: inc.y,
              transform: "translate(-50%,-50%)",
            }}
          >
            <div
              className={`w-8 h-8 rounded-full ${incidentColor[inc.priority]} flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-lg
              ${inc.priority === 1 ? "animate-ping" : ""}`}
            >
              P{inc.priority}
            </div>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              {inc.label}
            </div>
          </div>
        ))}

        {/* Overlay title */}
        <div className="absolute top-4 left-4 bg-navy/90 backdrop-blur border border-blue-500/30 rounded-xl px-4 py-2">
          <p className="font-brand font-bold text-white text-sm">BlancBleu</p>
          <p className="font-mono text-xs text-blue-400 tracking-widest">
            CARTE OPÉRATIONNELLE EN DIRECT
          </p>
        </div>

        {/* Layer toggles */}
        <div className="absolute top-4 right-4 flex gap-2">
          {["Unités", "Incidents", "Zones", "Trafic"].map((l, i) => (
            <button
              key={l}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                i < 2
                  ? "bg-primary/80 border-primary text-white"
                  : "bg-black/50 border-white/20 text-white/70 hover:bg-black/70"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-navy/95 border-t border-blue-500/20 px-5 py-3 flex gap-5 overflow-x-auto">
          {[
            { code: "AMB-01", s: "disponible", d: "0.8 km" },
            { code: "AMB-03", s: "en-route", d: "2.1 km" },
            { code: "AMB-07", s: "disponible", d: "3.4 km" },
            { code: "AMB-11", s: "disponible", d: "4.2 km" },
            { code: "AMB-05", s: "sur-place", d: "1.9 km" },
          ].map((u) => (
            <div key={u.code} className="flex items-center gap-2 flex-shrink-0">
              <span
                className={`w-2 h-2 rounded-full ${
                  u.s === "disponible"
                    ? "bg-emerald-400"
                    : u.s === "en-route"
                      ? "bg-yellow-400"
                      : "bg-red-400"
                }`}
              />
              <span className="font-mono text-white text-xs font-bold">
                {u.code}
              </span>
              <span className="text-white/50 text-xs">
                • {u.s} • {u.d}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
