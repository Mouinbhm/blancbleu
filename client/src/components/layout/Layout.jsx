import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

const navItems = [
  { path: "/dashboard", icon: "dashboard", label: "Tableau de bord" },
  {
    path: "/interventions",
    icon: "emergency",
    label: "Interventions",
    badge: 4,
  },
  { path: "/carte", icon: "map", label: "Carte en direct" },
  { path: "/flotte", icon: "ambulance", label: "Flotte & Ressources" },
  { path: "/ia", icon: "psychology", label: "Aide IA" },
  { path: "/rapports", icon: "assessment", label: "Rapports" },
  { path: "/parametres", icon: "settings", label: "Paramètres" },
];

const pageTitles = {
  "/dashboard": "Tableau de bord — Vue opérationnelle",
  "/interventions": "Interventions — Gestion des appels",
  "/carte": "Carte en direct — Vue opérationnelle",
  "/flotte": "Flotte & Ressources",
  "/ia": "Aide à la décision — Intelligence Artificielle",
  "/rapports": "Rapports Opérationnels",
};

export default function Layout() {
  const location = useLocation();
  const [shiftTime, setShiftTime] = useState("06:24:11");
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    let s = 6 * 3600 + 24 * 60 + 11;
    const iv = setInterval(() => {
      s++;
      const h = String(Math.floor(s / 3600)).padStart(2, "0");
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const sc = String(s % 60).padStart(2, "0");
      setShiftTime(`${h}:${m}:${sc}`);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex min-h-screen bg-surface">
      {/* ═══════════════ SIDEBAR ═══════════════ */}
      <aside className="w-60 h-screen fixed left-0 top-0 bg-navy flex flex-col z-50 shadow-xl">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-white text-lg">
                emergency
              </span>
            </div>
            <div>
              <div className="font-brand text-xl font-bold leading-none">
                <span className="text-white">Blanc</span>
                <span className="text-primary">Bleu</span>
              </div>
              <p className="text-xs text-slate-500 font-mono tracking-widest mt-0.5">
                DISPATCH · AI
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          <p className="text-xs font-mono text-slate-600 uppercase tracking-widest px-4 py-2">
            Principal
          </p>
          {navItems.slice(0, 3).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-between px-4 py-2.5 rounded-lg transition-all text-sm font-medium ${
                  isActive
                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-xl">
                  {item.icon}
                </span>
                {item.label}
              </div>
              {item.badge && (
                <span className="bg-danger text-white text-xs font-mono font-bold px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}

          <p className="text-xs font-mono text-slate-600 uppercase tracking-widest px-4 py-2 mt-3">
            Ressources
          </p>
          {navItems.slice(3).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm font-medium ${
                  isActive
                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <span className="material-symbols-outlined text-xl">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Dispatcher */}
        <div className="px-4 pb-5 border-t border-white/10 pt-4 space-y-3">
          <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              KM
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-semibold truncate">
                Karim Mansouri
              </p>
              <p className="text-yellow-400 font-mono text-xs">
                SHIFT: {shiftTime}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-1">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse flex-shrink-0" />
            <span className="text-xs font-mono text-slate-500 tracking-widest">
              SYSTÈME OPÉRATIONNEL
            </span>
          </div>
        </div>
      </aside>

      {/* ═══════════════ MAIN ═══════════════ */}
      <div className="flex-1 ml-60 flex flex-col min-h-screen">
        {/* TOPBAR */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-40 flex items-center justify-between px-8 shadow-sm">
          <h1 className="font-brand font-semibold text-navy text-sm">
            {pageTitles[location.pathname] || "BlancBleu"}
          </h1>

          <div className="flex items-center gap-2 bg-surface rounded-lg border border-slate-200 px-3 py-2 w-56">
            <span className="material-symbols-outlined text-slate-400 text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Rechercher..."
              className="bg-transparent text-sm outline-none w-full text-slate-700 placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-mono">
              Mar 28 Jan 2025
            </span>
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-surface transition-colors"
              >
                <span className="material-symbols-outlined text-slate-500 text-lg">
                  notifications
                </span>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full border-2 border-white" />
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-11 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 fade-in">
                  <div className="p-4 border-b border-slate-100">
                    <p className="font-brand font-bold text-navy text-sm">
                      Notifications
                    </p>
                  </div>
                  {[
                    {
                      t: "P1 — Arrêt cardiaque",
                      s: "AMB-03 dispatché",
                      c: "text-danger",
                    },
                    {
                      t: "P2 — Accident route",
                      s: "En attente d'unité",
                      c: "text-warning",
                    },
                    {
                      t: "IA — Recommandation",
                      s: "Redéployer AMB-09",
                      c: "text-primary",
                    },
                  ].map((n, i) => (
                    <div
                      key={i}
                      className="px-4 py-3 border-b border-slate-50 hover:bg-surface cursor-pointer"
                    >
                      <p className={`text-xs font-bold ${n.c}`}>{n.t}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{n.s}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="w-9 h-9 rounded-lg bg-navy flex items-center justify-center text-white text-xs font-bold cursor-pointer hover:bg-primary transition-colors">
              KM
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
