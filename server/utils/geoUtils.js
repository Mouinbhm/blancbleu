/**
 * BlancBleu — GeoUtils v2.0
 * Haversine · ETA · Consommation · Itinéraire mission
 */

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

function calculerETA(distanceKm, priorite = "P2") {
  const cfg = {
    P1: { vitesse: 75, facteur: 1.25, depart: 1 },
    P2: { vitesse: 55, facteur: 1.35, depart: 2 },
    P3: { vitesse: 35, facteur: 1.45, depart: 3 },
  };
  const { vitesse, facteur, depart } = cfg[priorite] || cfg.P2;

  // Facteur heure de pointe Nice
  const h = new Date().getHours();
  const fp =
    (h >= 8 && h < 10) || (h >= 17 && h < 19)
      ? 1.2
      : h >= 22 || h < 6
        ? 0.85
        : 1.0;

  const minutes = Math.ceil(
    (distanceKm / vitesse) * 60 * facteur * fp + depart,
  );
  return {
    minutes,
    formate:
      minutes < 60
        ? `${minutes} min`
        : `${Math.floor(minutes / 60)}h${minutes % 60}min`,
    fourchette: `${Math.floor(minutes * 0.8)}-${Math.ceil(minutes * 1.2)} min`,
    distanceKm,
  };
}

function formatETA(minutes) {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

/**
 * Calcule la consommation carburant selon distance
 * @param {number} distanceKm
 * @param {Object} specs - { consommationL100, capaciteReservoir }
 * @returns {number} pourcentage consommé
 */
function calculerConsommation(distanceKm, specs = {}) {
  const conso = specs.consommationL100 || 12; // L/100km
  const reservoir = specs.capaciteReservoir || 80; // litres
  const litres = (distanceKm * conso) / 100;
  return Math.round((litres / reservoir) * 100 * 100) / 100; // % consommé
}

/**
 * Distance totale d'un itinéraire de mission
 * Base → Incident → Hôpital → Base
 */
function distanceMissionComplete(base, incident, hopital) {
  const d1 = haversine(base.lat, base.lng, incident.lat, incident.lng);
  const d2 = hopital
    ? haversine(incident.lat, incident.lng, hopital.lat, hopital.lng)
    : 0;
  const d3 = hopital
    ? haversine(hopital.lat, hopital.lng, base.lat, base.lng)
    : haversine(incident.lat, incident.lng, base.lat, base.lng);
  return {
    baseVersIncident: d1,
    incidentVersHopital: d2,
    hopitalVersBase: d3,
    total: Math.round((d1 + d2 + d3) * 100) / 100,
  };
}

function trierParProximite(units, lat, lng, priorite = "P2") {
  return units
    .filter((u) => u.position?.lat && u.position?.lng)
    .map((u) => {
      const dist = haversine(u.position.lat, u.position.lng, lat, lng);
      const eta = calculerETA(dist, priorite);
      return {
        ...(u.toObject?.() || u),
        _id: u._id,
        geo: {
          distanceKm: dist,
          etaMinutes: eta.minutes,
          etaFormate: eta.formate,
        },
      };
    })
    .sort((a, b) => a.geo.distanceKm - b.geo.distanceKm);
}

function estDansZoneNice(lat, lng) {
  return lat >= 43.6 && lat <= 43.8 && lng >= 7.15 && lng <= 7.35;
}

module.exports = {
  haversine,
  calculerETA,
  formatETA,
  calculerConsommation,
  distanceMissionComplete,
  trierParProximite,
  estDansZoneNice,
};
