/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  BlancBleu — State Machine Transport Non Urgent             ║
 * ║  9 statuts · transitions validées · horodatages auto       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * FLUX NOMINAL :
 *  REQUESTED → CONFIRMED → SCHEDULED → ASSIGNED
 *    → EN_ROUTE_TO_PICKUP → ARRIVED_AT_PICKUP
 *    → PATIENT_ON_BOARD → ARRIVED_AT_DESTINATION → COMPLETED
 *
 * STATUTS ALTERNATIFS :
 *  → CANCELLED   (depuis tout statut non terminal)
 *  → NO_SHOW     (depuis ARRIVED_AT_PICKUP uniquement)
 *  → RESCHEDULED (depuis CONFIRMED, SCHEDULED, NO_SHOW)
 */

// ══════════════════════════════════════════════════════════════════════════════
// STATUTS
// ══════════════════════════════════════════════════════════════════════════════
const STATUTS = {
  REQUESTED: "REQUESTED",
  CONFIRMED: "CONFIRMED",
  SCHEDULED: "SCHEDULED",
  ASSIGNED: "ASSIGNED",
  EN_ROUTE_TO_PICKUP: "EN_ROUTE_TO_PICKUP",
  ARRIVED_AT_PICKUP: "ARRIVED_AT_PICKUP",
  PATIENT_ON_BOARD: "PATIENT_ON_BOARD",
  ARRIVED_AT_DESTINATION: "ARRIVED_AT_DESTINATION",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  NO_SHOW: "NO_SHOW",
  RESCHEDULED: "RESCHEDULED",
};

// ══════════════════════════════════════════════════════════════════════════════
// TRANSITIONS AUTORISÉES
// ══════════════════════════════════════════════════════════════════════════════
const TRANSITIONS = {
  REQUESTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SCHEDULED", "RESCHEDULED", "CANCELLED"],
  SCHEDULED: ["ASSIGNED", "RESCHEDULED", "CANCELLED"],
  ASSIGNED: ["EN_ROUTE_TO_PICKUP", "CANCELLED"],
  EN_ROUTE_TO_PICKUP: ["ARRIVED_AT_PICKUP", "CANCELLED"],
  ARRIVED_AT_PICKUP: ["PATIENT_ON_BOARD", "NO_SHOW"],
  PATIENT_ON_BOARD: ["ARRIVED_AT_DESTINATION"],
  ARRIVED_AT_DESTINATION: ["COMPLETED"],
  COMPLETED: [], // terminal
  CANCELLED: [], // terminal
  NO_SHOW: ["RESCHEDULED"],
  RESCHEDULED: ["CONFIRMED"],
};

// ══════════════════════════════════════════════════════════════════════════════
// LABELS LISIBLES
// ══════════════════════════════════════════════════════════════════════════════
const LABELS = {
  REQUESTED: { fr: "Demande reçue", color: "slate", icon: "add_circle" },
  CONFIRMED: { fr: "Confirmé", color: "blue", icon: "check_circle" },
  SCHEDULED: { fr: "Planifié", color: "indigo", icon: "event" },
  ASSIGNED: { fr: "Véhicule assigné", color: "purple", icon: "local_taxi" },
  EN_ROUTE_TO_PICKUP: {
    fr: "En route",
    color: "orange",
    icon: "directions_car",
  },
  ARRIVED_AT_PICKUP: {
    fr: "Arrivé chez le patient",
    color: "yellow",
    icon: "location_on",
  },
  PATIENT_ON_BOARD: { fr: "Patient à bord", color: "cyan", icon: "person" },
  ARRIVED_AT_DESTINATION: {
    fr: "Arrivé à destination",
    color: "teal",
    icon: "local_hospital",
  },
  COMPLETED: { fr: "Transport terminé", color: "green", icon: "done_all" },
  CANCELLED: { fr: "Annulé", color: "red", icon: "cancel" },
  NO_SHOW: { fr: "Patient absent", color: "pink", icon: "person_off" },
  RESCHEDULED: { fr: "Reprogrammé", color: "amber", icon: "event_repeat" },
};

// ══════════════════════════════════════════════════════════════════════════════
// HORODATAGES PAR STATUT
// ══════════════════════════════════════════════════════════════════════════════
const TIMESTAMPS = {
  CONFIRMED: "heureConfirmation",
  SCHEDULED: "heurePlanification",
  ASSIGNED: "heureAssignation",
  EN_ROUTE_TO_PICKUP: "heureEnRoute",
  ARRIVED_AT_PICKUP: "heurePriseEnCharge",
  PATIENT_ON_BOARD: "heurePriseEnCharge",
  ARRIVED_AT_DESTINATION: "heureArriveeDestination",
  COMPLETED: "heureTerminee",
  CANCELLED: "heureAnnulation",
  NO_SHOW: "heureAnnulation",
  RESCHEDULED: "heureReprogrammation",
};

// ══════════════════════════════════════════════════════════════════════════════
// VALIDATEURS PAR TRANSITION
// ══════════════════════════════════════════════════════════════════════════════
const VALIDATEURS = {
  // Confirmation : vérifier date, heure, adresses
  REQUESTED_CONFIRMED: (transport) => {
    const errors = [];
    if (!transport.dateTransport) errors.push("Date de transport manquante");
    if (!transport.heureRDV) errors.push("Heure de RDV manquante");
    if (!transport.adresseDepart?.rue)
      errors.push("Adresse de départ manquante");
    if (!transport.adresseDestination?.rue)
      errors.push("Adresse de destination manquante");
    return errors;
  },

  // Planification : prescription validée si dialyse/chimio
  CONFIRMED_SCHEDULED: (transport) => {
    const errors = [];
    const motifsAvecPMT = ["Dialyse", "Chimiothérapie", "Radiothérapie"];
    if (
      motifsAvecPMT.includes(transport.motif) &&
      !transport.prescription?.validee
    ) {
      errors.push(
        "Prescription médicale de transport (PMT) requise pour ce motif",
      );
    }
    return errors;
  },

  // Assignation : véhicule et chauffeur requis
  SCHEDULED_ASSIGNED: (transport) => {
    const errors = [];
    if (!transport.vehicule) errors.push("Véhicule non assigné");
    if (!transport.chauffeur) errors.push("Chauffeur non assigné");
    return errors;
  },

  // Complétion : heure d'arrivée requise
  ARRIVED_AT_DESTINATION_COMPLETED: (transport) => {
    const errors = [];
    if (!transport.heureArriveeDestination)
      errors.push("Heure d'arrivée à destination non renseignée");
    return errors;
  },

  // Reprogrammation : raison obligatoire
  "*_RESCHEDULED": (transport) => {
    const errors = [];
    if (!transport.raisonReprogrammation && !transport._raisonTemp) {
      errors.push("Raison de la reprogrammation obligatoire");
    }
    return errors;
  },

  // Annulation : toujours autorisée (sauf états terminaux)
  "*_CANCELLED": () => [],

  // NO_SHOW : toujours autorisé depuis ARRIVED_AT_PICKUP
  "*_NO_SHOW": () => [],
};

// ══════════════════════════════════════════════════════════════════════════════
// CLASSE PRINCIPALE
// ══════════════════════════════════════════════════════════════════════════════
class TransportStateMachine {
  static peutTransitionner(statutActuel, nouveauStatut) {
    const transitions = TRANSITIONS[statutActuel] || [];
    return transitions.includes(nouveauStatut);
  }

  static validerTransition(transport, nouveauStatut) {
    const cle = `${transport.statut}_${nouveauStatut}`;
    const validateur = VALIDATEURS[cle] || VALIDATEURS[`*_${nouveauStatut}`];
    if (!validateur) return [];
    return validateur(transport);
  }

  static effectuerTransition(transport, nouveauStatut, metadata = {}) {
    const {
      utilisateur,
      notes,
      raisonAnnulation,
      raisonNoShow,
      raisonReprogrammation,
      nouvelleDate,
    } = metadata;

    // 1. Vérifier autorisation
    if (!this.peutTransitionner(transport.statut, nouveauStatut)) {
      throw new Error(
        `Transition invalide : ${transport.statut} → ${nouveauStatut}. ` +
          `Autorisées : ${(TRANSITIONS[transport.statut] || []).join(", ")}`,
      );
    }

    // 2. Injecter raison pour validation
    if (raisonReprogrammation) transport._raisonTemp = raisonReprogrammation;

    // 3. Valider conditions métier
    const erreurs = this.validerTransition(transport, nouveauStatut);
    if (erreurs.length > 0) {
      throw new Error(`Conditions non remplies : ${erreurs.join(" · ")}`);
    }

    // 4. Préparer la mise à jour
    const champTimestamp = TIMESTAMPS[nouveauStatut];
    const update = {
      statut: nouveauStatut,
      ...(champTimestamp ? { [champTimestamp]: new Date() } : {}),
    };

    // 5. Champs spécifiques selon transition
    switch (nouveauStatut) {
      case "COMPLETED":
        if (transport.heureEnRoute) {
          update.dureeReelleMinutes = Math.round(
            (Date.now() - new Date(transport.heureEnRoute)) / 60000,
          );
        }
        break;
      case "CANCELLED":
        update.raisonAnnulation =
          raisonAnnulation || notes || "Annulé par l'opérateur";
        break;
      case "NO_SHOW":
        update.raisonNoShow =
          raisonNoShow || notes || "Patient absent à l'heure prévue";
        break;
      case "RESCHEDULED":
        update.raisonReprogrammation = raisonReprogrammation || notes || "";
        if (nouvelleDate) update.nouvelleDate = nouvelleDate;
        break;
    }

    // 6. Entrée journal
    const entreeJournal = {
      de: transport.statut,
      vers: nouveauStatut,
      timestamp: new Date(),
      utilisateur: utilisateur || "système",
      notes: notes || "",
    };

    return { update, entreeJournal };
  }

  static transitionsPossibles(statut) {
    return (TRANSITIONS[statut] || []).map((s) => ({
      statut: s,
      label: LABELS[s]?.fr,
      icon: LABELS[s]?.icon,
      color: LABELS[s]?.color,
    }));
  }

  static progression(statut) {
    const ordre = [
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
    const idx = ordre.indexOf(statut);
    if (idx === -1 || ["CANCELLED", "NO_SHOW", "RESCHEDULED"].includes(statut))
      return null;
    return Math.round((idx / (ordre.length - 1)) * 100);
  }

  static estTerminal(statut) {
    return ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(statut);
  }
}

module.exports = {
  TransportStateMachine,
  STATUTS,
  TRANSITIONS,
  LABELS,
  TIMESTAMPS,
};
