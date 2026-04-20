/**
 * BlancBleu — Service de récurrence des transports
 *
 * Génère des séries de transports récurrents en excluant automatiquement
 * les jours fériés français officiels pour l'année en cours et la suivante.
 * Chaque occurrence est un Transport indépendant référençant le transport parent.
 */
const Transport = require("../models/Transport");
const { audit } = require("./auditService");

// ── Jours fériés français (liste officielle 2025 et 2026) ─────────────────────
const JOURS_FERIES = new Set([
  // 2025
  "2025-01-01", // Jour de l'An
  "2025-04-21", // Lundi de Pâques
  "2025-05-01", // Fête du Travail
  "2025-05-08", // Victoire 1945
  "2025-05-29", // Ascension
  "2025-06-09", // Lundi de Pentecôte
  "2025-07-14", // Fête Nationale
  "2025-08-15", // Assomption
  "2025-11-01", // Toussaint
  "2025-11-11", // Armistice
  "2025-12-25", // Noël
  // 2026
  "2026-01-01", // Jour de l'An
  "2026-04-06", // Lundi de Pâques
  "2026-05-01", // Fête du Travail
  "2026-05-08", // Victoire 1945
  "2026-05-14", // Ascension
  "2026-05-25", // Lundi de Pentecôte
  "2026-07-14", // Fête Nationale
  "2026-08-15", // Assomption
  "2026-11-01", // Toussaint
  "2026-11-11", // Armistice
  "2026-12-25", // Noël
]);

// Sécurité : pas plus de 365 occurrences par série
const MAX_OCCURRENCES = 365;

/**
 * Convertit le jour JavaScript (0=Dim..6=Sam) en numérotation ISO (1=Lun..7=Dim).
 * @param {number} jsDay - Valeur retournée par Date.getDay()
 * @returns {number}
 */
function jsJourVersISO(jsDay) {
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Formate une date en chaîne 'yyyy-MM-dd' (UTC) pour comparaison avec JOURS_FERIES.
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Génère la liste des dates d'occurrence entre dateDebut et dateFin
 * pour les jours de semaine sélectionnés, en excluant les jours fériés.
 *
 * @param {Date} dateDebut  - Première date possible (inclusive)
 * @param {Date} dateFin    - Dernière date possible (inclusive)
 * @param {number[]} joursSemaine - Jours ISO sélectionnés (1=Lun..7=Dim)
 * @returns {{ dates: Date[], nbExclus: number }}
 */
function genererDates(dateDebut, dateFin, joursSemaine) {
  const dates = [];
  let nbExclus = 0;

  // Clone pour ne pas muter les paramètres
  const courant = new Date(dateDebut);
  courant.setHours(0, 0, 0, 0);
  const fin = new Date(dateFin);
  fin.setHours(23, 59, 59, 999);

  while (courant <= fin && dates.length < MAX_OCCURRENCES) {
    const jourISO = jsJourVersISO(courant.getDay());
    const dateStr = formatDate(courant);

    if (joursSemaine.includes(jourISO)) {
      if (JOURS_FERIES.has(dateStr)) {
        // Jour férié : comptabilisé mais exclu
        nbExclus++;
      } else {
        dates.push(new Date(courant));
      }
    }

    courant.setDate(courant.getDate() + 1);
  }

  return { dates, nbExclus };
}

/**
 * Crée en base de données une série complète de transports récurrents.
 *
 * Stratégie :
 *  - La première occurrence devient le "transport parent" (transportParent: null, indexSerie: 0)
 *  - Toutes les occurrences suivantes référencent ce parent (transportParent: ObjectId, indexSerie: N)
 *  - Chaque transport est journalisé individuellement dans l'AuditLog
 *
 * @param {Object} baseData      - Données communes à toutes les occurrences (sans dateTransport)
 * @param {Object} recurrence    - { joursSemaine: number[], dateFin: string|Date }
 * @param {Object} utilisateur   - Utilisateur créateur (req.user)
 * @returns {Promise<{
 *   transports: Transport[],
 *   nbOccurrences: number,
 *   nbExclus: number,
 *   transportParentId: import('mongoose').Types.ObjectId
 * }>}
 */
async function creerSerieRecurrente(baseData, recurrence, utilisateur) {
  const { joursSemaine, dateFin } = recurrence;

  // Validations métier
  if (!joursSemaine || joursSemaine.length === 0) {
    throw new Error("Veuillez sélectionner au moins un jour de la semaine");
  }
  if (!dateFin) {
    throw new Error("La date de fin de récurrence est obligatoire");
  }

  const dateDebut = new Date(baseData.dateTransport);
  const dateFinRecurrence = new Date(dateFin);

  if (isNaN(dateDebut.getTime())) {
    throw new Error("La date du premier transport est invalide");
  }
  if (isNaN(dateFinRecurrence.getTime())) {
    throw new Error("La date de fin de récurrence est invalide");
  }
  if (dateFinRecurrence <= dateDebut) {
    throw new Error(
      "La date de fin doit être postérieure à la date du premier transport",
    );
  }

  // Génération des dates d'occurrence
  const { dates, nbExclus } = genererDates(
    dateDebut,
    dateFinRecurrence,
    joursSemaine,
  );

  if (dates.length === 0) {
    throw new Error(
      "Aucune occurrence générée : tous les jours correspondants sont fériés ou hors de la plage sélectionnée",
    );
  }

  // Données récurrence communes à toutes les occurrences
  const recurrenceData = {
    active: true,
    joursSemaine,
    dateFin: dateFinRecurrence,
  };

  // Création du transport parent (première occurrence)
  const transportParent = await Transport.create({
    ...baseData,
    dateTransport: dates[0],
    createdBy: utilisateur._id,
    indexSerie: 0,
    recurrence: recurrenceData,
  });
  await audit.transportCree(transportParent, utilisateur);

  // Création des occurrences suivantes
  const transports = [transportParent];
  for (let i = 1; i < dates.length; i++) {
    const occurrence = await Transport.create({
      ...baseData,
      dateTransport: dates[i],
      createdBy: utilisateur._id,
      transportParent: transportParent._id,
      indexSerie: i,
      recurrence: recurrenceData,
    });
    await audit.transportCree(occurrence, utilisateur);
    transports.push(occurrence);
  }

  return {
    transports,
    nbOccurrences: transports.length,
    nbExclus,
    transportParentId: transportParent._id,
  };
}

module.exports = {
  genererDates,
  creerSerieRecurrente,
  JOURS_FERIES,
  MAX_OCCURRENCES,
};
