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
  // Consommation supplémentaire P1 (conduite agressive)
  FACTEUR_CONSO_P1: 1.4,
  FACTEUR_CONSO_P2: 1.2,
  FACTEUR_CONSO_P3: 1.0,
  // Alerte carburant faible
  SEUIL_CARBURANT_BAS: 20, // %
  SEUIL_CARBURANT_CRIT: 10, // %
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

  // Mettre à jour l'unité
  unit.statut = "en_mission";
  unit.interventionEnCours = interventionId;
  unit.missionStartedAt = new Date();
  unit.missionKmDebut = unit.kilometrage;
  unit.missionFuelDebut = unit.carburant;
  unit.lastStatusChangeAt = new Date();
  await unit.save();

  // Mettre à jour l'intervention
  await Intervention.findByIdAndUpdate(interventionId, {
    unitAssignee: unitId,
    statut: "ASSIGNED",
    heureAssignation: new Date(),
  });

  // Calculer ETA si coordonnées disponibles
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

  // Socket
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

  // Audit
  await audit.uniteAssignee(intervention, unit, { email: "système" });

  return { unit, intervention, eta };
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. UNITÉ EN ROUTE → intervention
// Déclenche : kmh + consommation au départ
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

  // Calculer distance base → incident pour prévoir la conso
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

  const ancienStatut = unit.statut;
  unit.lastStatusChangeAt = new Date();
  await unit.save();

  // Intervention → EN_ROUTE
  await Intervention.findByIdAndUpdate(interventionId, {
    statut: "EN_ROUTE",
    heureDepart: new Date(),
  });

  // Socket
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
// Déclenche : calcul distance réelle parcourue + conso réelle
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

  // Calculer distance réelle parcourue depuis la base
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

  // Facteur conso selon priorité
  const facteur = REGLES[`FACTEUR_CONSO_${intervention.priorite}`] || 1.0;
  const distanceEffective = distanceParcourue * facteur;
  const consoKm = calculerConsommation(distanceEffective, unit.specs);

  // Mettre à jour métriques physiques
  unit.kilometrage =
    Math.round((unit.kilometrage + distanceParcourue) * 10) / 10;
  unit.carburant = Math.max(
    0,
    Math.round((unit.carburant - consoKm) * 10) / 10,
  );

  // Mettre à jour position si fournie
  if (positionActuelle?.lat) {
    unit.position = { ...positionActuelle, updatedAt: new Date() };
  }

  unit.lastStatusChangeAt = new Date();
  await unit.save();

  // Intervention → ON_SITE
  await Intervention.findByIdAndUpdate(interventionId, {
    statut: "ON_SITE",
    heureArrivee: new Date(),
  });

  // Alertes carburant
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

  // Socket
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
// 4. TRANSPORT PATIENT → hôpital
// ══════════════════════════════════════════════════════════════════════════════
async function marquerTransport(unitId, interventionId, hopital = null) {
  const [unit, intervention] = await Promise.all([
    Unit.findById(unitId),
    Intervention.findById(interventionId),
  ]);

  if (!unit || !intervention) throw new Error("Introuvable");

  let distanceHopital = 0;
  let eta = null;

  if (hopital?.lat && unit.position?.lat) {
    distanceHopital = haversine(
      unit.position.lat,
      unit.position.lng,
      hopital.lat,
      hopital.lng,
    );
    eta = calculerETA(distanceHopital, intervention.priorite);
  }

  unit.lastStatusChangeAt = new Date();
  await unit.save();

  // Mettre à jour destination hôpital
  await Intervention.findByIdAndUpdate(interventionId, {
    statut: "TRANSPORTING",
    heureTransport: new Date(),
    ...(hopital && {
      hopitalDestination: {
        nom: hopital.nom || "CHU Nice",
        adresse: hopital.adresse || "CHU Nice",
        coords: { lat: hopital.lat, lng: hopital.lng },
      },
    }),
  });

  socketService.emitStatusUpdated({
    intervention,
    ancienStatut: "ON_SITE",
    nouveauStatut: "TRANSPORTING",
    utilisateur: "système",
  });
  _emitUnitUpdated(unit, { eta, distanceHopital });

  return { unit, eta, distanceHopital };
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. FIN DE MISSION + RETOUR À LA BASE
// Calcule distance totale, conso totale, remet l'unité disponible
// ══════════════════════════════════════════════════════════════════════════════
async function terminerMissionEtRetourBase(unitId, interventionId) {
  const [unit, intervention] = await Promise.all([
    Unit.findById(unitId),
    Intervention.findById(interventionId),
  ]);

  if (!unit || !intervention) throw new Error("Introuvable");

  // Distance retour hôpital/site → base
  let distanceRetour = 0;
  const base = {
    lat: unit.basePosition?.lat || 43.7102,
    lng: unit.basePosition?.lng || 7.262,
  };

  if (unit.position?.lat && base.lat) {
    distanceRetour = haversine(
      unit.position.lat,
      unit.position.lng,
      base.lat,
      base.lng,
    );
  }

  // Consommation retour (mode normal P3)
  const consoRetour = calculerConsommation(distanceRetour, unit.specs);

  // Totaux mission
  const kmTotal =
    unit.missionKmDebut != null
      ? unit.kilometrage + distanceRetour - unit.missionKmDebut
      : distanceRetour;
  const consoTotale =
    unit.missionFuelDebut != null
      ? unit.missionFuelDebut - (unit.carburant - consoRetour)
      : 0;

  // Mettre à jour métriques
  unit.kilometrage = Math.round((unit.kilometrage + distanceRetour) * 10) / 10;
  unit.carburant = Math.max(
    0,
    Math.round((unit.carburant - consoRetour) * 10) / 10,
  );

  // Retour base : statut + position + reset mission
  unit.statut = "disponible";
  unit.interventionEnCours = null;
  unit.missionStartedAt = null;
  unit.missionKmDebut = null;
  unit.missionFuelDebut = null;
  unit.lastStatusChangeAt = new Date();
  unit.position = {
    lat: base.lat,
    lng: base.lng,
    adresse: unit.baseAdresse,
    updatedAt: new Date(),
  };
  await unit.save();

  // Clôturer l'intervention
  const dureeMinutes = intervention.missionStartedAt
    ? Math.round((Date.now() - new Date(intervention.missionStartedAt)) / 60000)
    : null;

  await Intervention.findByIdAndUpdate(interventionId, {
    statut: "COMPLETED",
    heureTerminee: new Date(),
    dureeMinutes,
  });

  // Résumé mission pour l'audit + socket
  const resume = {
    unitNom: unit.nom,
    kmTotal: Math.round(kmTotal * 10) / 10,
    consoTotale: Math.round(consoTotale * 10) / 10,
    carburantRestant: unit.carburant,
    dureeMinutes,
  };

  socketService.emitUnitStatusChanged({
    unite: unit,
    ancienStatut: "en_mission",
    nouveauStatut: "disponible",
  });
  socketService.emitStatusUpdated({
    intervention,
    ancienStatut: "TRANSPORTING",
    nouveauStatut: "COMPLETED",
    utilisateur: "système",
  });
  _emitUnitUpdated(unit, resume);
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
// 6. MISE À JOUR POSITION GPS (depuis événement mission)
// ══════════════════════════════════════════════════════════════════════════════
async function updatePositionFromEvent(
  unitId,
  { lat, lng, vitesse, cap, adresse },
) {
  const unit = await Unit.findById(unitId);
  if (!unit) throw new Error("Unité introuvable");

  const ancienLat = unit.position?.lat;
  const ancienLng = unit.position?.lng;

  // Calculer distance incrémentale si position précédente connue
  if (ancienLat && ancienLng && unit.statut === "en_mission") {
    const distInc = haversine(ancienLat, ancienLng, lat, lng);
    if (distInc > 0.05) {
      // ignorer les micro-mouvements < 50m
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

  // Diffuser position
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

// ─── Helper émission socket unité ─────────────────────────────────────────────
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
