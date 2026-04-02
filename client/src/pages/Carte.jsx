import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { unitService, interventionService } from "../services/api";

// ─── Fix icônes Leaflet avec React ───────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// ─── Icône ambulance selon statut ─────────────────────────────────────────────
const makeUnitIcon = (statut) => {
  const colors = {
    disponible: "#10b981",
    en_mission: "#f59e0b",
    maintenance: "#ef4444",
    indisponible: "#6b7280",
  };
  const color = colors[statut] || "#6b7280";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="42" viewBox="0 0 36 42">
      <circle cx="18" cy="18" r="16" fill="${color}" stroke="white" stroke-width="3"/>
      <text x="18" y="23" text-anchor="middle" font-size="16" fill="white">🚑</text>
      <polygon points="18,38 10,28 26,28" fill="${color}"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [36, 42],
    iconAnchor: [18, 42],
    popupAnchor: [0, -42],
  });
};

// ─── Icône intervention selon priorité ────────────────────────────────────────
const makeIncidentIcon = (priorite) => {
  const colors = { P1: "#ef4444", P2: "#f59e0b", P3: "#3b82f6" };
  const color = colors[priorite] || "#6b7280";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="38" viewBox="0 0 32 38">
      <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2.5"/>
      <text x="16" y="21" text-anchor="middle" font-size="13" font-weight="bold" fill="white">${priorite}</text>
      <polygon points="16,34 9,24 23,24" fill="${color}"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [32, 38],
    iconAnchor: [16, 38],
    popupAnchor: [0, -38],
  });
};

// ─── Composant qui centre la carte sur une unité ──────────────────────────────
function CenterOnUnit({ unitId, units }) {
  const map = useMap();
  useEffect(() => {
    if (!unitId || !units.length) return;
    const unit = units.find((u) => u._id === unitId);
    if (unit?.position?.lat && unit?.position?.lng) {
      map.flyTo([unit.position.lat, unit.position.lng], 15, { duration: 1.5 });
    }
  }, [unitId, units, map]);
  return null;
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function Carte() {
  const [searchParams] = useSearchParams();
  const unitId = searchParams.get("unitId");

  const [units, setUnits] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [layers, setLayers] = useState({
    unites: true,
    incidents: true,
    zones: true,
  });
  const [selectedUnit, setSelectedUnit] = useState(null);

  // Nice — 59 bd Madeleine
  const NICE_CENTER = [43.7102, 7.262];

  useEffect(() => {
    Promise.all([
      unitService.getAll(),
      interventionService.getAll({ statut: "en_cours", limit: 20 }),
    ])
      .then(([u, i]) => {
        setUnits(u.data);
        setInterventions(i.data.interventions || []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Refresh toutes les 30 secondes
  useEffect(() => {
    const iv = setInterval(() => {
      unitService.getAll().then(({ data }) => setUnits(data));
      interventionService
        .getAll({ statut: "en_cours", limit: 20 })
        .then(({ data }) => setInterventions(data.interventions || []));
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  const toggleLayer = (l) => setLayers((prev) => ({ ...prev, [l]: !prev[l] }));

  const statutLabel = {
    disponible: "Disponible",
    en_mission: "En mission",
    maintenance: "Maintenance",
    indisponible: "Indisponible",
  };
  const statutColor = {
    disponible: "text-emerald-400",
    en_mission: "text-yellow-400",
    maintenance: "text-red-400",
    indisponible: "text-slate-400",
  };

  // KPIs dynamiques
  const kpis = [
    {
      l: "Unités actives",
      v: units.filter((u) => u.statut === "en_mission").length,
      c: "border-emerald-500",
    },
    { l: "Incidents actifs", v: interventions.length, c: "border-red-500" },
    {
      l: "Disponibles",
      v: units.filter((u) => u.statut === "disponible").length,
      c: "border-yellow-500",
    },
    {
      l: "Couverture",
      v:
        units.length > 0
          ? `${Math.round((units.filter((u) => u.statut !== "maintenance").length / units.length) * 100)}%`
          : "—",
      c: "border-blue-500",
    },
  ];

  return (
    <div className="p-7 fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {kpis.map((k) => (
          <div
            key={k.l}
            className={`bg-white rounded-xl p-4 border-t-4 shadow-sm ${k.c}`}
          >
            <p className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-1">
              {k.l}
            </p>
            <p className="font-mono text-2xl font-bold text-navy">{k.v}</p>
          </div>
        ))}
      </div>

      {/* CARTE */}
      <div
        className="rounded-2xl overflow-hidden relative shadow-xl border border-slate-200"
        style={{ height: "540px" }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full bg-slate-900 text-slate-400 gap-3">
            <div
              style={{
                width: 24,
                height: 24,
                border: "3px solid rgba(29,110,245,0.3)",
                borderTop: "3px solid #1D6EF5",
                borderRadius: "50%",
                animation: "spin .7s linear infinite",
              }}
            />
            Chargement de la carte…
          </div>
        ) : (
          <MapContainer
            center={NICE_CENTER}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            {/* Centrer sur unité depuis Flotte */}
            <CenterOnUnit unitId={unitId} units={units} />

            {/* ── Marqueurs Ambulances ── */}
            {layers.unites &&
              units.map((u) => {
                if (!u.position?.lat || !u.position?.lng) return null;
                return (
                  <Marker
                    key={u._id}
                    position={[u.position.lat, u.position.lng]}
                    icon={makeUnitIcon(u.statut)}
                    eventHandlers={{ click: () => setSelectedUnit(u) }}
                  >
                    <Popup>
                      <div style={{ minWidth: 180, fontFamily: "sans-serif" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "8px",
                          }}
                        >
                          <span style={{ fontSize: "20px" }}>🚑</span>
                          <div>
                            <strong
                              style={{ fontSize: "14px", color: "#0f172a" }}
                            >
                              {u.nom}
                            </strong>
                            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                              {u.immatriculation} · {u.type}
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#475569",
                            lineHeight: 1.8,
                          }}
                        >
                          <div>📍 {u.position?.adresse || "—"}</div>
                          <div>⛽ Carburant : {u.carburant || 0}%</div>
                          <div>
                            👥 Équipage : {u.equipage?.length || 0} membre(s)
                          </div>
                          <div style={{ marginTop: "6px" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: "999px",
                                fontSize: "11px",
                                fontWeight: 600,
                                backgroundColor:
                                  u.statut === "disponible"
                                    ? "#d1fae5"
                                    : u.statut === "en_mission"
                                      ? "#fef3c7"
                                      : "#fee2e2",
                                color:
                                  u.statut === "disponible"
                                    ? "#065f46"
                                    : u.statut === "en_mission"
                                      ? "#92400e"
                                      : "#991b1b",
                              }}
                            >
                              {statutLabel[u.statut] || u.statut}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

            {/* ── Marqueurs Interventions ── */}
            {layers.incidents &&
              interventions.map((i) => {
                if (!i.coordonnees?.lat || !i.coordonnees?.lng) return null;
                return (
                  <Marker
                    key={i._id}
                    position={[i.coordonnees.lat, i.coordonnees.lng]}
                    icon={makeIncidentIcon(i.priorite)}
                  >
                    <Popup>
                      <div style={{ minWidth: 180, fontFamily: "sans-serif" }}>
                        <div style={{ marginBottom: "6px" }}>
                          <strong
                            style={{ fontSize: "13px", color: "#0f172a" }}
                          >
                            {i.typeIncident}
                          </strong>
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                            {i.numero}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#475569",
                            lineHeight: 1.8,
                          }}
                        >
                          <div>📍 {i.adresse}</div>
                          <div>
                            👤 {i.patient?.nom || "Inconnu"} ·{" "}
                            {i.patient?.etat || "—"}
                          </div>
                          <div>
                            🚑 {i.unitAssignee?.nom || "Aucune unité assignée"}
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

            {/* ── Zone de couverture Nice centre ── */}
            {layers.zones && (
              <Circle
                center={[43.7102, 7.262]}
                radius={3000}
                pathOptions={{
                  color: "#1D6EF5",
                  fillColor: "#1D6EF5",
                  fillOpacity: 0.05,
                  weight: 1,
                  dashArray: "6 4",
                }}
              />
            )}
          </MapContainer>
        )}

        {/* Overlay titre */}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            zIndex: 1000,
            background: "rgba(15,23,42,0.9)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(29,110,245,0.3)",
            borderRadius: "12px",
            padding: "10px 16px",
            pointerEvents: "none",
          }}
        >
          <p
            style={{
              fontWeight: 700,
              color: "#fff",
              fontSize: "13px",
              margin: 0,
            }}
          >
            Ambulances Blanc Bleu
          </p>
          <p
            style={{
              fontFamily: "monospace",
              fontSize: "10px",
              color: "#60a5fa",
              letterSpacing: "0.1em",
              margin: 0,
            }}
          >
            NICE · CARTE OPÉRATIONNELLE
          </p>
        </div>

        {/* Layer toggles */}
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 1000,
            display: "flex",
            gap: "6px",
          }}
        >
          {[
            { key: "unites", label: "Unités" },
            { key: "incidents", label: "Incidents" },
            { key: "zones", label: "Zones" },
          ].map((l) => (
            <button
              key={l.key}
              onClick={() => toggleLayer(l.key)}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid",
                transition: "all .2s",
                backgroundColor: layers[l.key]
                  ? "rgba(29,110,245,0.85)"
                  : "rgba(0,0,0,0.5)",
                borderColor: layers[l.key]
                  ? "#1D6EF5"
                  : "rgba(255,255,255,0.2)",
                color: "#fff",
              }}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Barre du bas — liste des unités */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            background: "rgba(15,23,42,0.95)",
            borderTop: "1px solid rgba(29,110,245,0.2)",
            padding: "10px 20px",
            display: "flex",
            gap: "20px",
            overflowX: "auto",
          }}
        >
          {units.length === 0 ? (
            <span
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: "12px",
                fontFamily: "monospace",
              }}
            >
              Aucune unité
            </span>
          ) : (
            units.map((u) => (
              <div
                key={u._id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexShrink: 0,
                  cursor: "pointer",
                }}
                onClick={() => setSelectedUnit(u)}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    flexShrink: 0,
                    backgroundColor:
                      u.statut === "disponible"
                        ? "#10b981"
                        : u.statut === "en_mission"
                          ? "#f59e0b"
                          : "#ef4444",
                  }}
                />
                <span
                  style={{
                    fontFamily: "monospace",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  {u.nom}
                </span>
                <span
                  style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px" }}
                >
                  · {statutLabel[u.statut] || u.statut}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Légende */}
      <div className="mt-4 bg-white rounded-xl p-4 border border-slate-100 shadow-sm flex items-center gap-8 flex-wrap">
        <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">
          Légende
        </p>
        {[
          { color: "#10b981", label: "Disponible" },
          { color: "#f59e0b", label: "En mission" },
          { color: "#ef4444", label: "Maintenance" },
          { color: "#ef4444", label: "P1 Critique", shape: "square" },
          { color: "#f59e0b", label: "P2 Urgent", shape: "square" },
          { color: "#3b82f6", label: "P3 Standard", shape: "square" },
        ].map((l) => (
          <div
            key={l.label}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: l.shape === "square" ? "3px" : "50%",
                backgroundColor: l.color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              {l.label}
            </span>
          </div>
        ))}
        <div className="ml-auto text-xs text-slate-400 font-mono">
          Mise à jour auto · 30s · OpenStreetMap
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
