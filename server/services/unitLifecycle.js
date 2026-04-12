/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  BlancBleu — Service Cycle de Vie Unité (Mode Réel)         ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  Orchestre toutes les transitions métier d'une unité        ║
 * ║  selon le flux réel d'une intervention ambulancière         ║
 * ║                                                             ║
 * ║  FLUX :                                                     ║
 * ║  Base → Assignée → EN_ROUTE → ON_SITE →                    ║
 * ║  TRANSPORTING → Hôpital → Retour base → Disponible         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const Unit = require("../models/Unit");
const Intervention = require("../models/Intervention");
const socketService = require("./socketService");
const { audit } = require("./auditService");
const {
  haversine,
  calculerETA,
  calculerConsommation,
  distanceMissionComplete,
} = require("../utils/geoUtils");

// ══════════════════════════════════════════════════════════════════════════════
// RÈGLES MÉTIER
// ══════════════════════════════════════════════════════════════════════════════
const REGLES = {
  FACTEUR_CONSO_P1: 1.4,
  FACTEUR_CONSO_P2: 1.2,
  FACTEUR_CONSO_P3: 1.0,
  SEUIL_CARBURANT_BAS: 20,
  SEUIL_CARBURANT_CRIT: 10,
};

// ══════════════════════════════════════════════════════════════════════════════
// 1. ASSIGNER UNE UNITÉ À UNE INTERVENTION
// ══════════════════════════════════════════════════════════════════════════════
async function assignerUnite(unitId, interventionId, dispatchInfo = {}) {
  const [unit, intervention] = await Promise.all([
    Unit.findById(unitId),
    Intervention.findById(interventionId),
  ]);

  if (!unit) throw new Error("Unité introuvable");
  if (!intervention) throw new Error("Intervention introuvable");
  if (unit.statut !== "disponible")
    throw new Error(
      `Unité ${unit.nom} non disponible (statut: ${unit.statut})`,
    );

  const ancienStatut = unit.statut;

  unit.statut = "en_mission";
  unit.interventionEnCours = interventionId;
  unit.missionStartedAt = new Date();
  unit.missionKmDebut = unit.kilometrage;
  unit.missionFuelDebut = unit.carburant;
  unit.lastStatusChangeAt = new Date();
  await unit.save();

  await Intervention.findByIdAndUpdate(interventionId, {
    unitAssignee: unitId,
    statut: "ASSIGNED",
    heureAssignation: new Date(),
  });

  let eta = null;
  if (unit.position?.lat && intervention.coordonnees?.lat) {
    const dist = haversine(
      unit.position.lat,
      unit.position.lng,
      intervention.coordonnees.lat,
      intervention.coordonnees.lng,
    );
    eta = calculerETA(dist, intervention.priorite);
  }

  socketService.emitUnitStatusChanged({
    unite: unit,
    ancienStatut,
    nouveauStatut: "en_mission",
  });
  socketService.emitUnitAssigned({
    intervention,
    unite: unit,
    eta: eta?.formate,
    score: dispatchInfo.score || null,
    source: dispatchInfo.source || "MANUEL",
  });
  socketService.emitStatsUpdate?.();

  await audit.uniteAssignee(intervention, unit, { email: "système" });

  return { unit, intervention, eta };
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. UNITÉ EN ROUTE
// ══════════════════════════════════════════════════════════════════════════════
async function marquerEnRoute(unitId, interventionId) {
  const [unit, intervention] = await Promise.all([
    Unit.findById(unitId),
    Intervention.findById(interventionId).select(
      "coordonnees priorite statut heureCreation",
    ),
  ]);

  if (!unit) throw new Error("Unité introuvable");
  if (!intervention) throw new Error("Intervention introuvable");

  let distanceKm = 0;
  let eta = null;
  if (unit.position?.lat && intervention.coordonnees?.lat) {
    distanceKm = haversine(
      unit.position.lat,
      unit.position.lng,
      intervention.coordonnees.lat,
      intervention.coordonnees.lng,
    );
    eta = calculerETA(distanceKm, intervention.priorite);
  }

  unit.lastStatusChangeAt = new Date();
  await unit.save();

  await Intervention.findByIdAndUpdate(interventionId, {
    statut: "EN_ROUTE",
    heureDepart: new Date(),
  });

  socketService.emitStatusUpdated({
    intervention,
    ancienStatut: "ASSIGNED",
    nouveauStatut: "EN_ROUTE",
    utilisateur: "système",
  });
  _emitUnitUpdated(unit, { eta, distanceKm });

  return { unit, eta, distanceKm };
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. ARRIVÉE SUR SITE
// ══════════════════════════════════════════════════════════════════════════════
async function marquerSurPlace(
  unitId,
  interventionId,
  positionActuelle = null,
) {
  const [unit, intervention] = await Promise.all([
    Unit.findById(unitId),
    Intervention.findById(interventionId),
  ]);

  if (!unit || !intervention)
    throw new Error("Unité ou intervention introuvable");

  let distanceParcourue = 0;
  const posDepart = {
    lat: unit.basePosition?.lat || 43.7102,
    lng: unit.basePosition?.lng || 7.262,
  };
  const posSite = positionActuelle || intervention.coordonnees;

  if (posDepart.lat && posSite?.lat) {
    distanceParcourue = haversine(
      posDepart.lat,
      posDepart.lng,
      posSite.lat,
      posSite.lng,
    );
  }

  const facteur = REGLES[`FACTEUR_CONSO_${intervention.priorite}`] || 1.0;
  const distanceEffective = distanceParcourue * facteur;
  const consoKm = calculerConsommation(distanceEffective, unit.specs);

  unit.kilometrage =
    Math.round((unit.kilometrage + distanceParcourue) * 10) / 10;
  unit.carburant = Math.max(
    0,
    Math.round((unit.carburant - consoKm) * 10) / 10,
  );

  if (positionActuelle?.lat) {
    unit.position = { ...positionActuelle, updatedAt: new Date() };
  }

  unit.lastStatusChangeAt = new Date();
  await unit.save();

  await Intervention.findByIdAndUpdate(interventionId, {
    statut: "ON_SITE",
    heureArrivee: new Date(),
  });

  if (unit.carburant <= REGLES.SEUIL_CARBURANT_CRIT) {
    socketService.emitEscalationTriggered?.({
      intervention,
      alertes: [
        {
          code: "FUEL_CRITICAL",
          message: `Carburant critique : ${unit.carburant.toFixed(1)}%`,
          niveau: { label: "CRITICAL", couleur: "orange" },
          action: "Ravitailler avant retour base",
        },
      ],
      niveauMaximal: { label: "CRITICAL" },
    });
  }

  socketService.emitStatusUpdated({
    intervention,
    ancienStatut: "EN_ROUTE",
    nouveauStatut: "ON_SITE",
    utilisateur: "système",
  });
  _emitUnitUpdated(unit, { distanceParcourue, consoKm });

  return { unit, distanceParcourue, consoKm };
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. TRANSPORT VERS HÔPITAL
// ══════════════════════════════════════════════════════════════════════════════
async function marquerTransport(
  unitId,
  interventionId,
  hopitalDestination = null,
) {
  const [unit, intervention] = await Promise.all([
    Unit.findById(unitId),
    Intervention.findById(interventionId),
  ]);

  if (!unit || !intervention)
    throw new Error("Unité ou intervention introuvable");

  unit.lastStatusChangeAt = new Date();
  await unit.save();

  await Intervention.findByIdAndUpdate(interventionId, {
    statut: "TRANSPORTING",
    heureTransport: new Date(),
    ...(hopitalDestination && { hopitalDestination }),
  });

  socketService.emitStatusUpdated({
    intervention,
    ancienStatut: "ON_SITE",
    nouveauStatut: "TRANSPORTING",
    utilisateur: "système",
  });
  _emitUnitUpdated(unit, { hopitalDestination });

  return { unit, hopitalDestination };
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. FIN DE MISSION + RETOUR BASE
// ══════════════════════════════════════════════════════════════════════════════
async function terminerMissionEtRetourBase(unitId, interventionId) {
  const [unit, intervention] = await Promise.all([
    Unit.findById(unitId),
    Intervention.findById(interventionId),
  ]);

  if (!unit || !intervention)
    throw new Error("Unité ou intervention introuvable");

  const base = {
    lat: unit.basePosition?.lat || 43.7102,
    lng: unit.basePosition?.lng || 7.262,
  };
  const incident = intervention.coordonnees || { lat: base.lat, lng: base.lng };
  const hopital = intervention.hopitalDestination?.coords || null;

  const distances = distanceMissionComplete(base, incident, hopital);
  const distanceRetour = haversine(
    unit.position?.lat || base.lat,
    unit.position?.lng || base.lng,
    base.lat,
    base.lng,
  );

  const consoRetour = calculerConsommation(distanceRetour, unit.specs);
  const kmDebut = unit.missionKmDebut || unit.kilometrage;

  const resume = {
    kmTotal:
      Math.round((unit.kilometrage - kmDebut + distanceRetour) * 10) / 10,
    distanceMission: distances.total,
    distanceRetour,
    carburantConsomme:
      Math.round(
        ((unit.missionFuelDebut || 100) - unit.carburant + consoRetour) * 10,
      ) / 10,
    carburantRestant: Math.max(
      0,
      Math.round((unit.carburant - consoRetour) * 10) / 10,
    ),
    dureeMinutes: unit.missionStartedAt
      ? Math.round((Date.now() - new Date(unit.missionStartedAt)) / 60000)
      : null,
  };

  unit.statut = "disponible";
  unit.interventionEnCours = null;
  unit.missionStartedAt = null;
  unit.missionKmDebut = null;
  unit.missionFuelDebut = null;
  unit.lastStatusChangeAt = new Date();
  unit.kilometrage = Math.round((unit.kilometrage + distanceRetour) * 10) / 10;
  unit.carburant = resume.carburantRestant;
  unit.position = {
    lat: base.lat,
    lng: base.lng,
    adresse: unit.baseAdresse || "Base principale",
    updatedAt: new Date(),
  };
  await unit.save();

  await Intervention.findByIdAndUpdate(interventionId, {
    statut: "COMPLETED",
    heureTerminee: new Date(),
    dureeMinutes: resume.dureeMinutes,
  });

  socketService.emitStatusUpdated?.({
    intervention,
    ancienStatut: intervention.statut,
    nouveauStatut: "COMPLETED",
    utilisateur: "système",
  });
  socketService.emitUnitStatusChanged?.({
    unite: unit,
    ancienStatut: "en_mission",
    nouveauStatut: "disponible",
  });
  socketService.emitStatsUpdate?.();

  await audit.log({
    action: "UNITE_STATUS_CHANGED",
    origine: "SYSTÈME",
    utilisateur: { email: "système" },
    ressource: { type: "Unit", id: unit._id, reference: unit.nom },
    details: {
      avant: { statut: "en_mission" },
      apres: { statut: "disponible" },
      metadata: resume,
      message: `Mission terminée — ${resume.kmTotal} km · carburant restant ${resume.carburantRestant}%`,
    },
  });

  return { unit, resume };
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. MISE À JOUR POSITION GPS
// ══════════════════════════════════════════════════════════════════════════════
async function updatePositionFromEvent(
  unitId,
  { lat, lng, vitesse, cap, adresse },
) {
  const unit = await Unit.findById(unitId);
  if (!unit) throw new Error("Unité introuvable");

  const ancienLat = unit.position?.lat;
  const ancienLng = unit.position?.lng;

  if (ancienLat && ancienLng && unit.statut === "en_mission") {
    const distInc = haversine(ancienLat, ancienLng, lat, lng);
    if (distInc > 0.05) {
      const consoInc = calculerConsommation(distInc, unit.specs);
      unit.kilometrage = Math.round((unit.kilometrage + distInc) * 100) / 100;
      unit.carburant = Math.max(
        0,
        Math.round((unit.carburant - consoInc) * 100) / 100,
      );
    }
  }

  unit.position = {
    lat,
    lng,
    adresse: adresse || "",
    vitesse: vitesse || 0,
    cap: cap || 0,
    updatedAt: new Date(),
  };
  await unit.save();

  socketService.emitLocationUpdated?.({
    unitId: unit._id,
    nom: unit.nom,
    type: unit.type,
    statut: unit.statut,
    position: unit.position,
    carburant: unit.carburant,
    kilometrage: unit.kilometrage,
    interventionEnCours: unit.interventionEnCours,
  });

  return unit;
}

// ─── Helper socket ────────────────────────────────────────────────────────────
function _emitUnitUpdated(unit, metadata = {}) {
  if (!socketService.emitLocationUpdated) return;
  socketService.emitLocationUpdated({
    unitId: unit._id,
    nom: unit.nom,
    type: unit.type,
    statut: unit.statut,
    position: unit.position,
    carburant: unit.carburant,
    kilometrage: unit.kilometrage,
    interventionEnCours: unit.interventionEnCours,
    metadata,
  });
}

module.exports = {
  assignerUnite,
  marquerEnRoute,
  marquerSurPlace,
  marquerTransport,
  terminerMissionEtRetourBase,
  updatePositionFromEvent,
};
