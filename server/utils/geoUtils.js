/**
 * BlancBleu — GeoUtils v4.0
 * Transport sanitaire NON urgent
 *
 * Fonctions :
 *   - haversine()           : distance à vol d'oiseau
 *   - calculerRouteOSRM()   : route réelle via OSRM
 *   - calculerETA()         : ETA synchrone (Haversine, usage interne)
 *   - calculerETARoutier()  : ETA asynchrone via OSRM
 *   - calculerConsommation(): estimation carburant
 *   - distanceTrajet()      : distance complète base→prise en charge→destination
 *   - trierParProximite()   : tri véhicules par distance
 *
 * SUPPRIMÉ en v4.0 :
 *   - Facteurs P1/P2/P3 (vitesse sirènes, feux bleus) — hors domaine
 *   - Terminologie "incident", "hopital" → "prise en charge", "destination"
 */

const axios = require("axios");
const logger = require("./logger");

// ─── Configuration OSRM ───────────────────────────────────────────────────────
const OSRM_BASE = process.env.OSRM_URL || "https://router.project-osrm.org";
const OSRM_TIMEOUT = 3000; // 3s — fallback Haversine si dépassé

// ─── Cache OSRM (mémoire, TTL 5 min) ─────────────────────────────────────────
const _cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function _cacheKey(lat1, lng1, lat2, lng2) {
  return `${lat1.toFixed(4)},${lng1.toFixed(4)}-${lat2.toFixed(4)},${lng2.toFixed(4)}`;
}

function _cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    _cache.delete(key);
    return null;
  }
  return entry.value;
}

function _cacheSet(key, value) {
  _cache.set(key, { value, ts: Date.now() });
  if (_cache.size > 500) {
    const firstKey = _cache.keys().next().value;
    _cache.delete(firstKey);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HAVERSINE — Distance à vol d'oiseau (km)
// ══════════════════════════════════════════════════════════════════════════════
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const d1 = ((lat2 - lat1) * Math.PI) / 180;
  const d2 = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(d1 / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(d2 / 2) ** 2;
  return (
    Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// OSRM ROUTING — Distance et durée réelle par la route
// ══════════════════════════════════════════════════════════════════════════════
/**
 * @returns {{ distanceKm, dureeSecondes, source: 'osrm'|'osrm_cache'|'haversine' }}
 */
async function calculerRouteOSRM(lat1, lng1, lat2, lng2) {
  const key = _cacheKey(lat1, lng1, lat2, lng2);
  const cached = _cacheGet(key);
  if (cached) return { ...cached, source: "osrm_cache" };

  try {
    const url = `${OSRM_BASE}/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;
    const { data } = await axios.get(url, { timeout: OSRM_TIMEOUT });

    if (data.code !== "Ok" || !data.routes?.[0]) {
      throw new Error("Réponse OSRM invalide");
    }

    const route = data.routes[0];
    const result = {
      distanceKm: Math.round((route.distance / 1000) * 100) / 100,
      dureeSecondes: Math.round(route.duration),
    };

    _cacheSet(key, result);
    return { ...result, source: "osrm" };
  } catch (err) {
    logger.warn("OSRM indisponible — fallback Haversine", { err: err.message });
    const distKm = haversine(lat1, lng1, lat2, lng2);
    // Facteur sinuosité moyen : les routes sont ~35% plus longues à vol d'oiseau
    return {
      distanceKm: Math.round(distKm * 1.35 * 100) / 100,
      dureeSecondes: null,
      source: "haversine",
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ETA — Estimation temps d'arrivée (transport sanitaire non urgent)
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Calcule un ETA pour un trajet de transport sanitaire non urgent.
 * Vitesse de référence : 50 km/h en ville (avec feux, ronds-points, stops).
 * Pas de vitesse d'urgence (pas de sirènes, pas de feux bleus).
 *
 * @param {number} distanceKm
 * @returns {{ minutes, formate, fourchette, distanceKm, source }}
 */
function calculerETA(distanceKm) {
  const vitesseMoyenne = 50; // km/h — conduite normale, zone urbaine/périurbaine

  // Facteur heure de pointe (trafic dense)
  const h = new Date().getHours();
  let facteurTrafic = 1.0;
  if ((h >= 7 && h < 9) || (h >= 17 && h < 19)) {
    facteurTrafic = 1.25; // +25% en heure de pointe
  } else if (h >= 22 || h < 6) {
    facteurTrafic = 0.85; // -15% la nuit (moins de trafic)
  }

  // Temps de préparation véhicule avant départ (départ de base)
  const tempsPreparation = 3; // minutes

  const minutes = Math.ceil(
    (distanceKm / vitesseMoyenne) * 60 * facteurTrafic + tempsPreparation
  );

  return {
    minutes,
    formate:
      minutes < 60
        ? `${minutes} min`
        : `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`,
    fourchette: `${Math.floor(minutes * 0.8)}-${Math.ceil(minutes * 1.2)} min`,
    distanceKm,
    source: "haversine",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ETA ROUTIER — Via OSRM (plus précis, asynchrone)
// ══════════════════════════════════════════════════════════════════════════════
/**
 * ETA via OSRM pour transport sanitaire non urgent.
 * La durée OSRM est la durée de conduite normale (pas de feux bleus).
 */
async function calculerETARoutier(lat1, lng1, lat2, lng2) {
  const route = await calculerRouteOSRM(lat1, lng1, lat2, lng2);

  let minutes;

  if (route.dureeSecondes !== null) {
    // Durée OSRM + marge réaliste (+10%) + préparation
    const tempsPreparation = 3;
    minutes = Math.ceil((route.dureeSecondes / 60) * 1.1) + tempsPreparation;
  } else {
    // Fallback Haversine
    const eta = calculerETA(route.distanceKm);
    minutes = eta.minutes;
  }

  return {
    minutes,
    formate:
      minutes < 60
        ? `${minutes} min`
        : `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`,
    fourchette: `${Math.floor(minutes * 0.8)}-${Math.ceil(minutes * 1.2)} min`,
    distanceKm: route.distanceKm,
    source: route.source,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// UTILITAIRES
// ══════════════════════════════════════════════════════════════════════════════

function formatETA(minutes) {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}min`;
}

/**
 * Estime la consommation carburant (% du réservoir utilisé)
 */
function calculerConsommation(distanceKm, specs = {}) {
  const conso = specs.consommationL100 || 12;
  const reservoir = specs.capaciteReservoir || 80;
  const litres = (distanceKm * conso) / 100;
  return Math.round((litres / reservoir) * 100 * 100) / 100;
}

/**
 * Distance totale d'un trajet complet de transport sanitaire :
 *   base → prise en charge patient → destination médicale → retour base
 *
 * @param {{ lat, lng }} base          - Garage / point de départ du véhicule
 * @param {{ lat, lng }} priseEnCharge - Adresse du patient
 * @param {{ lat, lng }} destination   - Établissement de santé (peut être null si retour direct)
 * @returns {{ baseVersPriseEnCharge, priseEnChargeVersDestination, destinationVersBase, total }}
 */
function distanceTrajet(base, priseEnCharge, destination) {
  const d1 = haversine(base.lat, base.lng, priseEnCharge.lat, priseEnCharge.lng);
  const d2 = destination
    ? haversine(priseEnCharge.lat, priseEnCharge.lng, destination.lat, destination.lng)
    : 0;
  const d3 = destination
    ? haversine(destination.lat, destination.lng, base.lat, base.lng)
    : haversine(priseEnCharge.lat, priseEnCharge.lng, base.lat, base.lng);

  return {
    baseVersPriseEnCharge: d1,
    priseEnChargeVersDestination: d2,
    destinationVersBase: d3,
    total: Math.round((d1 + d2 + d3) * 100) / 100,
  };
}

/**
 * Trie une liste de véhicules par proximité d'un point géographique.
 * @param {Array} vehicules - Liste de véhicules avec position GPS
 * @param {number} lat
 * @param {number} lng
 * @returns {Array} Véhicules triés du plus proche au plus éloigné
 */
function trierParProximite(vehicules, lat, lng) {
  return vehicules
    .filter((v) => v.position?.lat && v.position?.lng)
    .map((v) => {
      const dist = haversine(v.position.lat, v.position.lng, lat, lng);
      const eta = calculerETA(dist);
      return {
        ...(v.toObject?.() || v),
        _id: v._id,
        geo: {
          distanceKm: dist,
          etaMinutes: eta.minutes,
          etaFormate: eta.formate,
        },
      };
    })
    .sort((a, b) => a.geo.distanceKm - b.geo.distanceKm);
}

/**
 * Vérifie si un point est dans la zone d'activité de la société (Nice/Alpes-Maritimes)
 */
function estDansZone(lat, lng) {
  return lat >= 43.5 && lat <= 44.2 && lng >= 6.9 && lng <= 7.6;
}

module.exports = {
  haversine,
  calculerETA,
  calculerETARoutier,
  calculerRouteOSRM,
  formatETA,
  calculerConsommation,
  distanceTrajet,
  trierParProximite,
  estDansZone,
  // Alias rétrocompatibilité (anciens appels)
  distanceMissionComplete: distanceTrajet,
  estDansZoneNice: estDansZone,
};
