/**
 * BlancBleu — Service de tarification CPAM 2024
 *
 * Implémente le barème des transports sanitaires remboursables
 * applicable depuis le 1er octobre 2024.
 *
 * Sources officielles :
 *   - Arrêté du 23 septembre 2024, JORF n°0228 du 1er octobre 2024
 *   - Nomenclature Générale des Actes Professionnels (NGAP) — Titre IV Transport
 *   - Circulaire CNAMTS du 4 novembre 2024
 *
 * Trois véhicules pris en charge :
 *   VSL       — Véhicule Sanitaire Léger (patient assis, autonome)
 *   TPMR      — Transport PMR (fauteuil roulant, non allongé)
 *   AMBULANCE — Patient allongé ou sous perfusion
 */

const { calculerRouteOSRM } = require("../utils/geoUtils");

// ── Barème tarifaire CPAM 2024 ────────────────────────────────────────────────
// Tous les montants sont en euros (€).
const BAREME = {
  VSL: {
    forfait: 12.61, // Forfait prise en charge patient (€)
    prixKm: 0.62, // Tarif kilométrique aller (€/km)
  },
  TPMR: {
    forfait: 25.0,
    prixKm: 0.95,
  },
  AMBULANCE: {
    forfait: 46.31,
    prixKm: 0.91,
    // Suppléments s'ajoutant au tarif de base :
    supplementNuit: 19.19, // Prise en charge entre 20h et 8h
    supplementDimancheOuFerie: 19.19, // Prise en charge dimanche ou jour férié
  },
};

// Taux de prise en charge Assurance Maladie Obligatoire par défaut (ALD : 100%)
const TAUX_CPAM_DEFAUT = 65; // 65% en régime normal, 100% en ALD

// Jours fériés français 2025–2026 (pour le calcul du supplément ambulance)
const JOURS_FERIES = new Set([
  // 2025
  "2025-01-01",
  "2025-04-21",
  "2025-05-01",
  "2025-05-08",
  "2025-05-29",
  "2025-06-09",
  "2025-07-14",
  "2025-08-15",
  "2025-11-01",
  "2025-11-11",
  "2025-12-25",
  // 2026
  "2026-01-01",
  "2026-04-06",
  "2026-05-01",
  "2026-05-08",
  "2026-05-14",
  "2026-05-25",
  "2026-07-14",
  "2026-08-15",
  "2026-11-01",
  "2026-11-11",
  "2026-12-25",
]);

// ── Fonctions utilitaires ─────────────────────────────────────────────────────

/**
 * Arrondit un montant à 2 décimales (standard comptable — arrondi bancaire).
 * @param {number} montant
 * @returns {number}
 */
function arrondir(montant) {
  return Math.round(montant * 100) / 100;
}

/**
 * Détermine si une date/heure correspond à une prise en charge de nuit.
 * La nuit CPAM est définie entre 20h00 et 07h59 (inclus).
 * @param {Date} date
 * @returns {boolean}
 */
function estNuit(date) {
  const h = date.getHours();
  return h >= 20 || h < 8;
}

/**
 * Détermine si une date est un dimanche ou un jour férié français.
 * @param {Date} date
 * @returns {boolean}
 */
function estDimancheOuFerie(date) {
  if (date.getDay() === 0) return true;
  // Comparer en format ISO local (pas UTC) pour éviter les décalages
  const dateStr = date.toISOString().slice(0, 10);
  return JOURS_FERIES.has(dateStr);
}

/**
 * Fusionne une date et une heure "HH:MM" en un objet Date cohérent.
 * Utilisé pour déterminer les suppléments nuit/dimanche.
 * @param {Date|string} dateTransport
 * @param {string} [heureRDV] - Format "HH:MM"
 * @returns {Date}
 */
function parseDateHeure(dateTransport, heureRDV) {
  const d = new Date(dateTransport);
  if (heureRDV && /^\d{2}:\d{2}$/.test(heureRDV)) {
    const [h, m] = heureRDV.split(":").map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
}

// ── Calcul principal : version asynchrone (avec OSRM) ────────────────────────

/**
 * Calcule le tarif CPAM 2024 complet pour un transport.
 *
 * Utilise OSRM pour obtenir la distance réelle par la route ;
 * bascule sur Haversine × 1.35 si OSRM est indisponible.
 *
 * @param {Object} transport - Document Transport ou objet compatible
 * @param {string}  transport.typeTransport        - 'VSL' | 'TPMR' | 'AMBULANCE'
 * @param {Object}  transport.adresseDepart        - { coordonnees: { lat, lng } }
 * @param {Object}  transport.adresseDestination   - { coordonnees: { lat, lng } }
 * @param {boolean} [transport.allerRetour=false]  - Doubler la distance si true
 * @param {string}  [transport.heureRDV]           - "HH:MM" pour supplément nuit
 * @param {Date}    [transport.dateTransport]       - Pour supplément dimanche/férié
 * @param {number}  [transport.tauxPriseEnCharge]  - Taux SS en % (défaut 65)
 *
 * @returns {Promise<{
 *   distanceKm: number,
 *   distanceFacturee: number,
 *   montantTotal: number,
 *   montantCPAM: number,
 *   montantPatient: number,
 *   tauxPriseEnCharge: number,
 *   supplements: number,
 *   sourceDistance: 'osrm'|'osrm_cache'|'haversine'|'non_disponible',
 *   bareme: { forfait: number, prixKm: number },
 *   details: string[]
 * }>}
 */
async function calculerTarif(transport) {
  const {
    typeTransport,
    adresseDepart,
    adresseDestination,
    allerRetour = false,
    heureRDV,
    dateTransport,
    tauxPriseEnCharge = TAUX_CPAM_DEFAUT,
  } = transport;

  const bareme = BAREME[typeTransport];
  if (!bareme) {
    throw new Error(
      `Type de transport non reconnu : "${typeTransport}". Valeurs acceptées : VSL, TPMR, AMBULANCE`,
    );
  }

  // ── Distance réelle via OSRM ──────────────────────────────────────────────
  const coordDepart = adresseDepart?.coordonnees;
  const coordDest = adresseDestination?.coordonnees;
  let distanceKm = 0;
  let sourceDistance = "non_disponible";

  if (
    coordDepart?.lat &&
    coordDepart?.lng &&
    coordDest?.lat &&
    coordDest?.lng
  ) {
    const route = await calculerRouteOSRM(
      coordDepart.lat,
      coordDepart.lng,
      coordDest.lat,
      coordDest.lng,
    );
    distanceKm = route.distanceKm;
    sourceDistance = route.source;
  }

  // Aller-retour : la CPAM facture le trajet complet (aller + retour)
  const distanceFacturee = allerRetour
    ? arrondir(distanceKm * 2)
    : distanceKm;

  // ── Montant de base ───────────────────────────────────────────────────────
  const montantBase = arrondir(bareme.forfait + bareme.prixKm * distanceFacturee);
  const details = [
    `Forfait ${typeTransport} : ${bareme.forfait.toFixed(2)} €`,
    `Distance${allerRetour ? " aller-retour" : ""} : ${distanceFacturee.toFixed(2)} km × ${bareme.prixKm.toFixed(2)} €/km = ${arrondir(bareme.prixKm * distanceFacturee).toFixed(2)} €`,
  ];

  // ── Suppléments ambulance (nuit et/ou dimanche/férié) ─────────────────────
  // Ces suppléments ne s'appliquent qu'aux ambulances (VSL et TPMR : tarif unique)
  let supplements = 0;
  if (typeTransport === "AMBULANCE" && dateTransport) {
    const dateHeure = parseDateHeure(dateTransport, heureRDV);

    if (estNuit(dateHeure)) {
      supplements += bareme.supplementNuit;
      details.push(
        `Supplément nuit (20h–8h) : ${bareme.supplementNuit.toFixed(2)} €`,
      );
    }
    if (estDimancheOuFerie(dateHeure)) {
      supplements += bareme.supplementDimancheOuFerie;
      details.push(
        `Supplément dimanche/jour férié : ${bareme.supplementDimancheOuFerie.toFixed(2)} €`,
      );
    }
  }

  // ── Répartition CPAM / patient ─────────────────────────────────────────────
  const montantTotal = arrondir(montantBase + supplements);
  const taux = tauxPriseEnCharge / 100;
  const montantCPAM = arrondir(montantTotal * taux);
  const montantPatient = arrondir(montantTotal - montantCPAM);

  details.push(`Taux SS (${tauxPriseEnCharge}%) → CPAM : ${montantCPAM.toFixed(2)} € / Patient : ${montantPatient.toFixed(2)} €`);

  return {
    distanceKm,
    distanceFacturee,
    montantTotal,
    montantCPAM,
    montantPatient,
    tauxPriseEnCharge,
    supplements: arrondir(supplements),
    sourceDistance,
    bareme: { forfait: bareme.forfait, prixKm: bareme.prixKm },
    details,
  };
}

// ── Calcul synchrone : version légère pour l'estimation rapide ───────────────

/**
 * Calcule le tarif CPAM de façon synchrone à partir d'une distance fournie.
 * Utilisée pour l'endpoint d'estimation et les tests unitaires.
 *
 * @param {string} typeTransport      - 'VSL' | 'TPMR' | 'AMBULANCE'
 * @param {number} distanceKm         - Distance aller (km)
 * @param {Object} [options]
 * @param {boolean} [options.allerRetour=false]
 * @param {number}  [options.tauxPriseEnCharge=65]
 * @param {boolean} [options.nuit=false]       - Supplément nuit ambulance
 * @param {boolean} [options.dimanche=false]   - Supplément dimanche ambulance
 *
 * @returns {{
 *   distanceKm: number,
 *   distanceFacturee: number,
 *   montantTotal: number,
 *   montantCPAM: number,
 *   montantPatient: number,
 *   tauxPriseEnCharge: number,
 *   supplements: number,
 *   bareme: { forfait: number, prixKm: number }
 * }}
 */
function calculerTarifSync(typeTransport, distanceKm, options = {}) {
  const {
    allerRetour = false,
    tauxPriseEnCharge = TAUX_CPAM_DEFAUT,
    nuit = false,
    dimanche = false,
  } = options;

  const bareme = BAREME[typeTransport];
  if (!bareme) {
    throw new Error(
      `Type de transport non reconnu : "${typeTransport}". Valeurs acceptées : VSL, TPMR, AMBULANCE`,
    );
  }

  const distanceFacturee = arrondir(allerRetour ? distanceKm * 2 : distanceKm);
  const montantBase = arrondir(
    bareme.forfait + bareme.prixKm * distanceFacturee,
  );

  let supplements = 0;
  if (typeTransport === "AMBULANCE") {
    if (nuit) supplements += bareme.supplementNuit;
    if (dimanche) supplements += bareme.supplementDimancheOuFerie;
    supplements = arrondir(supplements);
  }

  const montantTotal = arrondir(montantBase + supplements);
  const taux = tauxPriseEnCharge / 100;
  const montantCPAM = arrondir(montantTotal * taux);
  const montantPatient = arrondir(montantTotal - montantCPAM);

  return {
    distanceKm,
    distanceFacturee,
    montantTotal,
    montantCPAM,
    montantPatient,
    tauxPriseEnCharge,
    supplements,
    bareme: { forfait: bareme.forfait, prixKm: bareme.prixKm },
  };
}

module.exports = {
  calculerTarif,
  calculerTarifSync,
  arrondir,
  estNuit,
  estDimancheOuFerie,
  parseDateHeure,
  BAREME,
  TAUX_CPAM_DEFAUT,
};
