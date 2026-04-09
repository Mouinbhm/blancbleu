/**
 * BlancBleu — Simulation Réaliste des Données Unités
 * Fait varier carburant, km, position selon le statut réel
 * Pas aléatoire — logique métier cohérente
 */
const Unit = require("../models/Unit");
const socketService = require("./socketService");

const INTERVAL_MS = 6000; // toutes les 6 secondes
let _interval = null;
let _actif = false;

// Zone Nice GPS
const ZONE = { latMin: 43.66, latMax: 43.76, lngMin: 7.18, lngMax: 7.32 };

// Déplacer légèrement une position
function deplacer(lat, lng, vitesse = 30) {
  const rayon = ((vitesse / 3600) * (INTERVAL_MS / 1000)) / 111; // degrés
  const angle = Math.random() * 2 * Math.PI;
  return {
    lat: Math.max(
      ZONE.latMin,
      Math.min(ZONE.latMax, lat + Math.cos(angle) * rayon),
    ),
    lng: Math.max(
      ZONE.lngMin,
      Math.min(ZONE.lngMax, lng + Math.sin(angle) * rayon),
    ),
    vitesse: Math.round(vitesse + (Math.random() - 0.5) * 10),
    cap: Math.round(Math.random() * 360),
  };
}

async function simulerDeplacement() {
  try {
    const units = await Unit.find({});

    for (const unit of units) {
      let modifie = false;

      if (unit.statut === "en_mission" && unit.position?.lat) {
        // ── EN MISSION : bouge + consomme carburant + augmente km ──────────
        const vitesse = unit.type === "SMUR" ? 70 : 50;
        const nouvellePos = deplacer(
          unit.position.lat,
          unit.position.lng,
          vitesse,
        );

        // Distance parcourue ce tick (km)
        const distTick = (vitesse / 3600) * (INTERVAL_MS / 1000);

        // Consommation : 12L/100km → % par tick
        const conso = unit.specs?.consommationL100 || 12;
        const reservoir = unit.specs?.capaciteReservoir || 80;
        const litresTick = (distTick * conso) / 100;
        const pctConso = (litresTick / reservoir) * 100;

        unit.position = {
          lat: Math.round(nouvellePos.lat * 100000) / 100000,
          lng: Math.round(nouvellePos.lng * 100000) / 100000,
          vitesse: Math.max(0, Math.min(120, nouvellePos.vitesse)),
          cap: nouvellePos.cap,
          adresse: unit.position.adresse || "En route",
          updatedAt: new Date(),
        };
        unit.kilometrage = Math.round((unit.kilometrage + distTick) * 10) / 10;
        unit.carburant = Math.max(
          0,
          Math.round((unit.carburant - pctConso) * 100) / 100,
        );
        modifie = true;
      } else if (unit.statut === "disponible") {
        // ── DISPONIBLE : position fixe, léger tick km moteur au ralenti ────
        // Carburant ne change pas (moteur éteint à la base)
        // Juste émettre position pour confirmer présence
        modifie = true; // émettre heartbeat position
      } else if (unit.statut === "maintenance") {
        // ── MAINTENANCE : rien ne bouge ─────────────────────────────────────
        continue;
      }

      if (modifie) {
        await unit.save();
        socketService.emitLocationUpdated?.({
          unitId: unit._id,
          nom: unit.nom,
          type: unit.type,
          statut: unit.statut,
          position: unit.position,
          carburant: Math.round(unit.carburant * 10) / 10,
          kilometrage: Math.round(unit.kilometrage * 10) / 10,
          interventionEnCours: unit.interventionEnCours,
        });
      }
    }
  } catch (err) {
    console.error("Simulation erreur:", err.message);
  }
}

function demarrer() {
  if (_actif) return;
  _actif = true;
  console.log("🗺️  Simulation GPS démarrée (toutes les 6s)");
  simulerDeplacement(); // premier tick immédiat
  _interval = setInterval(simulerDeplacement, INTERVAL_MS);
}

function arreter() {
  if (_interval) clearInterval(_interval);
  _actif = false;
  console.log("🗺️  Simulation GPS arrêtée");
}

function estActif() {
  return _actif;
}

module.exports = { demarrer, arreter, estActif };
