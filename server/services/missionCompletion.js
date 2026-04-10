/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  BlancBleu — Détection Semi-Automatique Fin de Mission      ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  3 niveaux : Suggestion → Confirmation → Auto-clôture       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * RÈGLES MÉTIER :
 *
 * NIVEAU 1 — SUGGESTION (signaux partiels)
 *   • Statut TRANSPORTING depuis > 30 min
 *   • Position unité < 200m de la destination
 *   • Temps total mission > seuil selon priorité
 *
 * NIVEAU 2 — CONFIRMATION REQUISE (signaux forts)
 *   • Destination atteinte (position < 100m)
 *   • Rapport mission rempli
 *   • Statut TRANSPORTING depuis > 45 min
 *
 * NIVEAU 3 — AUTO-CLÔTURE (signaux très forts)
 *   • Destination atteinte + rapport rempli
 *   • Temps > 2× seuil maximal
 *   • P3 : auto après 60 min depuis ON_SITE
 */

const Intervention = require("../models/Intervention");
const Unit = require("../models/Unit");
const socketService = require("./socketService");
const { audit } = require("./auditService");
const { haversine } = require("../utils/geoUtils");

// ── Seuils métier (minutes) ───────────────────────────────────────────────────
const SEUILS = {
  TRANSPORT_SUGGESTION: { P1: 20, P2: 30, P3: 40 },
  TRANSPORT_CONFIRMATION: { P1: 35, P2: 45, P3: 60 },
  AUTO_CLOTURE: { P1: 60, P2: 90, P3: 120 },
  DISTANCE_SUGGESTION_M: 200, // mètres
  DISTANCE_CONFIRMATION_M: 100, // mètres
  DISTANCE_AUTO_M: 50, // mètres — très proche = arrivée certaine
};

// ── Signaux détectés ──────────────────────────────────────────────────────────
function detecterSignaux(intervention, unite) {
  const signaux = [];
  const maintenant = Date.now();

  // 1. Statut intervention
  if (intervention.statut === "TRANSPORTING") {
    const depuisTransport = intervention.heureTransport
      ? Math.floor((maintenant - new Date(intervention.heureTransport)) / 60000)
      : null;

    const seuil1 = SEUILS.TRANSPORT_SUGGESTION[intervention.priorite] || 30;
    const seuil2 = SEUILS.TRANSPORT_CONFIRMATION[intervention.priorite] || 45;
    const seuilA = SEUILS.AUTO_CLOTURE[intervention.priorite] || 90;

    if (depuisTransport !== null) {
      if (depuisTransport >= seuilA) {
        signaux.push({
          code: "TRANSPORT_TIMEOUT_AUTO",
          poids: 40,
          description: `Transport depuis ${depuisTransport} min (seuil auto: ${seuilA} min)`,
        });
      } else if (depuisTransport >= seuil2) {
        signaux.push({
          code: "TRANSPORT_TIMEOUT_CONFIRM",
          poids: 25,
          description: `Transport depuis ${depuisTransport} min (seuil confirmation: ${seuil2} min)`,
        });
      } else if (depuisTransport >= seuil1) {
        signaux.push({
          code: "TRANSPORT_TIMEOUT_SUGGEST",
          poids: 15,
          description: `Transport depuis ${depuisTransport} min (seuil suggestion: ${seuil1} min)`,
        });
      }
    }
  }

  // 2. Rapport de mission rempli
  if (intervention.missionReportCompleted) {
    signaux.push({
      code: "REPORT_COMPLETED",
      poids: 30,
      description: "Rapport de mission complété",
    });
  }

  // 3. Destination atteinte (flag manuel ou géo)
  if (intervention.destinationReachedAt) {
    signaux.push({
      code: "DESTINATION_REACHED_FLAG",
      poids: 35,
      description: "Destination marquée comme atteinte",
    });
  }

  // 4. Position GPS proche de la destination
  if (unite?.position?.lat && intervention.hopitalDestination?.coords?.lat) {
    const distM =
      haversine(
        unite.position.lat,
        unite.position.lng,
        intervention.hopitalDestination.coords.lat,
        intervention.hopitalDestination.coords.lng,
      ) * 1000; // km → m

    if (distM <= SEUILS.DISTANCE_AUTO_M) {
      signaux.push({
        code: "POSITION_AT_DESTINATION",
        poids: 40,
        description: `Unité à ${Math.round(distM)}m de la destination (seuil auto: ${SEUILS.DISTANCE_AUTO_M}m)`,
      });
    } else if (distM <= SEUILS.DISTANCE_CONFIRMATION_M) {
      signaux.push({
        code: "POSITION_NEAR_DESTINATION",
        poids: 30,
        description: `Unité à ${Math.round(distM)}m de la destination`,
      });
    } else if (distM <= SEUILS.DISTANCE_SUGGESTION_M) {
      signaux.push({
        code: "POSITION_APPROACHING",
        poids: 15,
        description: `Unité à ${Math.round(distM)}m de la destination`,
      });
    }
  }

  // 5. Durée totale mission excessive
  const debutMission =
    intervention.missionStartedAt ||
    intervention.heureCreation ||
    intervention.createdAt;
  if (debutMission) {
    const dureeTotale = Math.floor(
      (maintenant - new Date(debutMission)) / 60000,
    );
    const seuilAuto = SEUILS.AUTO_CLOTURE[intervention.priorite] || 90;
    if (dureeTotale > seuilAuto * 2) {
      signaux.push({
        code: "MISSION_OVERTIME",
        poids: 20,
        description: `Mission en cours depuis ${dureeTotale} min (2× seuil max)`,
      });
    }
  }

  return signaux;
}

// ── Calcul du niveau de décision ──────────────────────────────────────────────
function calculerNiveau(signaux) {
  const total = signaux.reduce((s, sig) => s + sig.poids, 0);
  const codes = signaux.map((s) => s.code);

  // Niveau 3 — AUTO (poids ≥ 60 ou combinaison certaine)
  if (
    total >= 60 ||
    (codes.includes("POSITION_AT_DESTINATION") &&
      codes.includes("REPORT_COMPLETED")) ||
    (codes.includes("MISSION_OVERTIME") &&
      codes.includes("DESTINATION_REACHED_FLAG"))
  ) {
    return {
      niveau: 3,
      label: "AUTO",
      description: "Clôture automatique possible",
    };
  }

  // Niveau 2 — CONFIRMATION REQUISE (poids ≥ 35)
  if (
    total >= 35 ||
    codes.includes("DESTINATION_REACHED_FLAG") ||
    codes.includes("REPORT_COMPLETED") ||
    codes.includes("TRANSPORT_TIMEOUT_CONFIRM")
  ) {
    return {
      niveau: 2,
      label: "CONFIRMATION",
      description: "Confirmation humaine requise",
    };
  }

  // Niveau 1 — SUGGESTION (poids ≥ 15)
  if (total >= 15) {
    return {
      niveau: 1,
      label: "SUGGESTION",
      description: "Fin probable — surveiller",
    };
  }

  return { niveau: 0, label: "NONE", description: "Aucun signal détecté" };
}

// ══════════════════════════════════════════════════════════════════════════════
// FONCTION 1 — Évaluer une intervention
// ══════════════════════════════════════════════════════════════════════════════
async function evaluateMissionCompletion(interventionId) {
  const intervention =
    await Intervention.findById(interventionId).populate("unitAssignee");

  if (!intervention) throw { status: 404, message: "Intervention introuvable" };

  const statutsActifs = ["ASSIGNED", "EN_ROUTE", "ON_SITE", "TRANSPORTING"];
  if (!statutsActifs.includes(intervention.statut)) {
    return {
      eligible: false,
      raison: `Statut ${intervention.statut} non éligible`,
    };
  }

  const unite = intervention.unitAssignee;
  const signaux = detecterSignaux(intervention, unite);
  const decision = calculerNiveau(signaux);

  return {
    eligible: decision.niveau > 0,
    interventionId,
    statut: intervention.statut,
    priorite: intervention.priorite,
    signaux,
    decision,
    scoreTotal: signaux.reduce((s, sig) => s + sig.poids, 0),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// FONCTION 2 — Suggérer la fin
// ══════════════════════════════════════════════════════════════════════════════
async function suggestMissionCompletion(interventionId) {
  const evaluation = await evaluateMissionCompletion(interventionId);

  if (!evaluation.eligible || evaluation.decision.niveau < 1) {
    return { suggere: false, raison: "Critères insuffisants", evaluation };
  }

  // Marquer comme candidat à la clôture
  await Intervention.findByIdAndUpdate(interventionId, {
    completionCandidate: true,
    completionSuggestedAt: new Date(),
    completionDecisionNiveau: evaluation.decision.niveau,
  });

  // Émettre événement socket
  socketService.emitMissionEvent?.("mission_completion_suggested", {
    interventionId,
    decision: evaluation.decision,
    signaux: evaluation.signaux,
    message: `Fin probable détectée — ${evaluation.decision.description}`,
  });

  await audit.log({
    action: "STATUT_CHANGED",
    origine: "SYSTÈME",
    utilisateur: { email: "système" },
    ressource: { type: "Intervention", id: interventionId },
    details: {
      message: `Fin de mission suggérée — niveau ${evaluation.decision.niveau}`,
      metadata: { signaux: evaluation.signaux, decision: evaluation.decision },
    },
  });

  return { suggere: true, evaluation };
}

// ══════════════════════════════════════════════════════════════════════════════
// FONCTION 3 — Confirmer manuellement
// ══════════════════════════════════════════════════════════════════════════════
async function confirmMissionCompletion(interventionId, actor) {
  const intervention =
    await Intervention.findById(interventionId).populate("unitAssignee");

  if (!intervention) throw { status: 404, message: "Intervention introuvable" };

  return _cloturerMission(intervention, "manual", actor?.email || "dispatcher");
}

// ══════════════════════════════════════════════════════════════════════════════
// FONCTION 4 — Auto-clôture si éligible
// ══════════════════════════════════════════════════════════════════════════════
async function autoCompleteMissionIfEligible(interventionId) {
  const evaluation = await evaluateMissionCompletion(interventionId);

  if (evaluation.decision.niveau < 3) {
    return {
      auto: false,
      raison: `Niveau ${evaluation.decision.niveau} insuffisant pour auto-clôture`,
    };
  }

  const intervention =
    await Intervention.findById(interventionId).populate("unitAssignee");

  const result = await _cloturerMission(intervention, "auto", "système");
  return { auto: true, result, evaluation };
}

// ══════════════════════════════════════════════════════════════════════════════
// FONCTION 5 — Marquer destination atteinte
// ══════════════════════════════════════════════════════════════════════════════
async function markDestinationReached(interventionId, coordinates) {
  const intervention = await Intervention.findById(interventionId);
  if (!intervention) throw { status: 404, message: "Introuvable" };

  await Intervention.findByIdAndUpdate(interventionId, {
    destinationReachedAt: new Date(),
    ...(coordinates && {
      "hopitalDestination.coords": {
        lat: coordinates.lat,
        lng: coordinates.lng,
      },
    }),
  });

  // Déclencher évaluation automatique
  const evaluation = await evaluateMissionCompletion(interventionId);

  if (evaluation.decision.niveau >= 3) {
    return autoCompleteMissionIfEligible(interventionId);
  }
  if (evaluation.decision.niveau >= 1) {
    return suggestMissionCompletion(interventionId);
  }

  return { marque: true, evaluation };
}

// ══════════════════════════════════════════════════════════════════════════════
// INTERNE — Clôturer réellement la mission
// ══════════════════════════════════════════════════════════════════════════════
async function _cloturerMission(intervention, mode, acteur) {
  const now = new Date();
  const unite = intervention.unitAssignee;

  // Calculer durée totale
  const debut =
    intervention.missionStartedAt ||
    intervention.heureCreation ||
    intervention.createdAt;
  const dureeMinutes = debut
    ? Math.round((now - new Date(debut)) / 60000)
    : null;

  // Distance retour base
  let distanceRetour = 0;
  if (unite?.position?.lat && unite?.basePosition?.lat) {
    const { haversine: h } = require("../utils/geoUtils");
    distanceRetour = h(
      unite.position.lat,
      unite.position.lng,
      unite.basePosition.lat,
      unite.basePosition.lng,
    );
  }

  // 1. Mettre à jour l'intervention
  await Intervention.findByIdAndUpdate(intervention._id, {
    statut: "COMPLETED",
    heureTerminee: now,
    completedAt: now,
    completionMode: mode,
    completionConfirmedBy: acteur,
    completionCandidate: false,
    dureeMinutes,
  });

  // 2. Mettre à jour l'unité
  if (unite?._id) {
    // Consommation retour base
    const { calculerConsommation } = require("../utils/geoUtils");
    const consoRetour = calculerConsommation(distanceRetour, unite.specs);

    await Unit.findByIdAndUpdate(unite._id, {
      statut: "disponible",
      interventionEnCours: null,
      missionStartedAt: null,
      missionKmDebut: null,
      missionFuelDebut: null,
      lastStatusChangeAt: now,
      position: {
        lat: unite.basePosition?.lat || 43.7102,
        lng: unite.basePosition?.lng || 7.262,
        adresse: unite.baseAdresse || "Base principale",
        updatedAt: now,
      },
      $inc: {
        kilometrage: distanceRetour,
        carburant: -consoRetour,
      },
    });
  }

  // 3. Socket.IO
  socketService.emitStatusUpdated?.({
    intervention: {
      _id: intervention._id,
      numero: intervention.numero,
      priorite: intervention.priorite,
    },
    ancienStatut: intervention.statut,
    nouveauStatut: "COMPLETED",
    utilisateur: acteur,
  });

  socketService.emitMissionEvent?.("mission_completed", {
    interventionId: intervention._id,
    numero: intervention.numero,
    mode,
    acteur,
    dureeMinutes,
    timestamp: now,
  });

  if (unite?._id) {
    socketService.emitUnitStatusChanged?.({
      unite: { _id: unite._id, nom: unite.nom, type: unite.type },
      ancienStatut: "en_mission",
      nouveauStatut: "disponible",
    });
  }

  socketService.emitStatsUpdate?.();

  // 4. Audit
  await audit.log({
    action: "STATUT_CHANGED",
    origine: mode === "auto" ? "SYSTÈME" : "HUMAIN",
    utilisateur: { email: acteur },
    ressource: {
      type: "Intervention",
      id: intervention._id,
      reference: intervention.numero,
    },
    details: {
      avant: { statut: intervention.statut },
      apres: { statut: "COMPLETED", mode, dureeMinutes },
      message: `Mission clôturée (${mode}) par ${acteur} · ${dureeMinutes} min`,
    },
  });

  return {
    success: true,
    mode,
    acteur,
    dureeMinutes,
    distanceRetour: Math.round(distanceRetour * 10) / 10,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SURVEILLANCE AUTOMATIQUE — scan toutes les 5 min
// ══════════════════════════════════════════════════════════════════════════════
async function scannerMissionsActives() {
  try {
    const actives = await Intervention.find({
      statut: { $in: ["TRANSPORTING", "ON_SITE"] },
    })
      .populate("unitAssignee")
      .select(
        "_id statut priorite heureTransport heureArrivee missionStartedAt unitAssignee hopitalDestination missionReportCompleted destinationReachedAt heureCreation createdAt completionCandidate",
      );

    let suggestions = 0,
      autos = 0;

    for (const intervention of actives) {
      try {
        const evaluation = await evaluateMissionCompletion(intervention._id);

        if (
          evaluation.decision.niveau >= 3 &&
          !intervention.completionCandidate
        ) {
          await autoCompleteMissionIfEligible(intervention._id);
          autos++;
        } else if (
          evaluation.decision.niveau >= 1 &&
          !intervention.completionCandidate
        ) {
          await suggestMissionCompletion(intervention._id);
          suggestions++;
        }
      } catch (e) {
        console.warn(`Scan mission ${intervention._id}:`, e.message);
      }
    }

    if (suggestions + autos > 0) {
      console.log(
        `🔍 Scan missions : ${suggestions} suggestion(s), ${autos} auto-clôture(s)`,
      );
    }

    return { scannees: actives.length, suggestions, autos };
  } catch (err) {
    console.error("Erreur scan missions:", err.message);
  }
}

function demarrerScan(intervalleMin = 5) {
  console.log(
    `🔍 Scan fin de mission démarré (toutes les ${intervalleMin} min)`,
  );
  setInterval(scannerMissionsActives, intervalleMin * 60 * 1000);
  setTimeout(scannerMissionsActives, 10000);
}

module.exports = {
  evaluateMissionCompletion,
  suggestMissionCompletion,
  confirmMissionCompletion,
  autoCompleteMissionIfEligible,
  markDestinationReached,
  scannerMissionsActives,
  demarrerScan,
  SEUILS,
};
