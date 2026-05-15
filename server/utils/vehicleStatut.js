/**
 * BlancBleu — Normalisation centralisée des statuts véhicules
 *
 * Valeurs canoniques (celles du modèle Mongoose) :
 *   Disponible | En service | Maintenance | Hors service
 *
 * Aliases legacy acceptés (snake_case/lowercase) :
 *   disponible   → Disponible
 *   en_mission   → En service
 *   en_service   → En service
 *   maintenance  → Maintenance
 *   hors_service → Hors service
 */

const CANONICAL = {
  DISPONIBLE:   "Disponible",
  EN_SERVICE:   "En service",
  MAINTENANCE:  "Maintenance",
  HORS_SERVICE: "Hors service",
};

// Map: every accepted alias (including the canonical value itself) → canonical
const ALIAS_MAP = {
  // Canonical
  "Disponible":   "Disponible",
  "En service":   "En service",
  "Maintenance":  "Maintenance",
  "Hors service": "Hors service",
  // Legacy snake_case / lowercase
  "disponible":   "Disponible",
  "en_mission":   "En service",
  "en_service":   "En service",
  "maintenance":  "Maintenance",
  "hors_service": "Hors service",
};

/** All accepted input values (canonical + aliases), for Joi / express validation */
const STATUTS_VALIDES = Object.keys(ALIAS_MAP);

/** Canonical values only (for Mongoose enum) */
const STATUTS_CANONIQUES = Object.values(CANONICAL);

/**
 * Normalize a vehicle statut to its canonical form.
 * Returns null if the value is not recognized.
 */
function normalizeStatut(value) {
  if (!value || typeof value !== "string") return null;
  return ALIAS_MAP[value] ?? null;
}

/**
 * Like normalizeStatut, but throws if value is unrecognized.
 */
function assertStatut(value) {
  const normalized = normalizeStatut(value);
  if (!normalized) {
    throw new Error(
      `Statut véhicule invalide : "${value}". Valeurs acceptées : ${STATUTS_VALIDES.join(", ")}`,
    );
  }
  return normalized;
}

module.exports = { CANONICAL, ALIAS_MAP, STATUTS_VALIDES, STATUTS_CANONIQUES, normalizeStatut, assertStatut };
