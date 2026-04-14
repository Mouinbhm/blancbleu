// Fichier : client/src/components/transport/TransportTimeline.jsx
import { STATUT_CONFIG } from "./StatutBadge";

const ORDRE_STATUTS = [
  "REQUESTED",
  "CONFIRMED",
  "SCHEDULED",
  "ASSIGNED",
  "EN_ROUTE_TO_PICKUP",
  "ARRIVED_AT_PICKUP",
  "PATIENT_ON_BOARD",
  "ARRIVED_AT_DESTINATION",
  "COMPLETED",
];

// Horodatages associés à chaque statut dans le modèle Transport
const HORO_MAP = {
  REQUESTED:              null, // createdAt
  CONFIRMED:              "heureConfirmation",
  SCHEDULED:              "heurePlanification",
  ASSIGNED:               "heureAssignation",
  EN_ROUTE_TO_PICKUP:     "heureEnRoute",
  ARRIVED_AT_PICKUP:      null,
  PATIENT_ON_BOARD:       "heurePriseEnCharge",
  ARRIVED_AT_DESTINATION: "heureArriveeDestination",
  COMPLETED:              "heureTerminee",
  CANCELLED:              "heureAnnulation",
  NO_SHOW:                null,
  RESCHEDULED:            "heureReprogrammation",
};

function fmtDatetime(d) {
  if (!d) return null;
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TransportTimeline({ transport }) {
  const statutActuel = transport.statut;
  const idxActuel = ORDRE_STATUTS.indexOf(statutActuel);

  // Statuts terminaux hors du flux normal
  const estTerminal = ["CANCELLED", "NO_SHOW", "RESCHEDULED"].includes(statutActuel);

  const statuts = estTerminal
    ? [...ORDRE_STATUTS.slice(0, Math.max(idxActuel, 1)), statutActuel]
    : ORDRE_STATUTS;

  return (
    <div className="relative">
      {statuts.map((statut, idx) => {
        const cfg = STATUT_CONFIG[statut] || {
          label: statut,
          dot: "bg-slate-300",
          text: "text-slate-500",
        };

        const horoKey = HORO_MAP[statut];
        const horo =
          statut === "REQUESTED"
            ? transport.createdAt
            : horoKey
              ? transport[horoKey]
              : null;

        let etat;
        if (estTerminal && idx === statuts.length - 1) {
          etat = "actuel";
        } else if (statut === statutActuel) {
          etat = "actuel";
        } else if (ORDRE_STATUTS.indexOf(statut) < idxActuel) {
          etat = "passe";
        } else {
          etat = "futur";
        }

        return (
          <div key={statut} className="flex gap-4 mb-0">
            {/* Ligne + point */}
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 border-2 ${
                  etat === "passe"
                    ? `${cfg.dot} border-transparent`
                    : etat === "actuel"
                      ? `${cfg.dot} border-white shadow-md ring-2 ring-offset-1 ring-current`
                      : "bg-slate-200 border-slate-200"
                }`}
              />
              {idx < statuts.length - 1 && (
                <div
                  className={`w-0.5 flex-1 my-1 min-h-[20px] ${
                    etat === "passe" ? "bg-slate-300" : "bg-slate-100"
                  }`}
                />
              )}
            </div>

            {/* Contenu */}
            <div className="pb-4 flex-1 min-w-0">
              <p
                className={`text-sm font-semibold ${
                  etat === "actuel"
                    ? cfg.text
                    : etat === "passe"
                      ? "text-slate-700"
                      : "text-slate-400"
                }`}
              >
                {cfg.label}
              </p>
              {horo && etat !== "futur" && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {fmtDatetime(horo)}
                </p>
              )}
              {etat === "actuel" && !horo && (
                <p className="text-xs text-slate-400 mt-0.5">En cours</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
