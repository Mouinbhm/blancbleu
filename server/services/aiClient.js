/**
 * BlancBleu — Client HTTP vers le microservice IA Python
 *
 * Centralise tous les appels HTTP vers ai-service (FastAPI, port 5002).
 * Gère les timeouts, les erreurs réseau, et les réponses d'erreur.
 *
 * Endpoints disponibles :
 *   POST /pmt/extract         → Extraction PMT par OCR
 *   POST /dispatch/recommend  → Recommandation véhicule + chauffeur
 *   POST /routing/optimize    → Optimisation de tournée (VRP)
 *   GET  /health              → Statut du service IA
 */

const axios = require("axios");
const logger = require("../utils/logger");

const AI_BASE_URL = process.env.AI_API_URL || "http://localhost:5002";
const DEFAULT_TIMEOUT = 10000; // 10s — OCR peut être lent

const client = axios.create({
  baseURL: AI_BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: { "Content-Type": "application/json" },
});

// ─── Intercepteur de logs ────────────────────────────────────────────────────
client.interceptors.request.use((config) => {
  logger.debug(`[AI Client] → ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

client.interceptors.response.use(
  (response) => {
    logger.debug(`[AI Client] ← ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    const url = error.config?.url || "unknown";
    const status = error.response?.status;
    const msg = error.response?.data?.detail || error.message;
    logger.warn(`[AI Client] Erreur ${status || "réseau"} sur ${url} : ${msg}`);
    return Promise.reject(error);
  }
);

// ════════════════════════════════════════════════════════════════════════════
// MODULE 1 — Extraction PMT
// ════════════════════════════════════════════════════════════════════════════

/**
 * Extrait les données d'une Prescription Médicale de Transport (PDF ou image).
 *
 * @param {Buffer|string} fichier - Buffer du fichier ou chemin absolu
 * @param {string} mimeType       - 'application/pdf' | 'image/jpeg' | 'image/png'
 * @returns {Promise<PMTExtractionResult>}
 *
 * @example
 * const result = await aiClient.extrairePMT(fileBuffer, 'application/pdf');
 * // result.extraction.patient.nom, result.confiance, result.validationRequise
 */
async function extrairePMT(fichier, mimeType = "application/pdf") {
  try {
    const FormData = require("form-data");
    const form = new FormData();

    if (Buffer.isBuffer(fichier)) {
      form.append("fichier", fichier, {
        filename: "pmt.pdf",
        contentType: mimeType,
      });
    } else {
      const fs = require("fs");
      form.append("fichier", fs.createReadStream(fichier));
    }

    const { data } = await client.post("/pmt/extract", form, {
      headers: form.getHeaders(),
      timeout: 30000, // OCR peut prendre jusqu'à 30s
    });

    return data;
  } catch (err) {
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      throw new Error("Service IA indisponible (PMT extraction)");
    }
    throw new Error(err.response?.data?.detail || err.message);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// MODULE 2 — Dispatch (recommandation véhicule/chauffeur)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Recommande le meilleur véhicule et chauffeur pour un transport donné.
 *
 * @param {Object} transport - Données du transport (motif, mobilité, adresses, heure)
 * @param {Array}  vehicules - Liste des véhicules disponibles avec position GPS
 * @param {Array}  chauffeurs - Liste des chauffeurs disponibles
 * @returns {Promise<DispatchRecommendation>}
 *
 * @example
 * const rec = await aiClient.recommanderDispatch(transport, vehicules, chauffeurs);
 * // rec.recommandation.vehiculeId, rec.recommandation.score, rec.alternatives
 */
async function recommanderDispatch(transport, vehicules, chauffeurs) {
  try {
    const { data } = await client.post("/dispatch/recommend", {
      transport: {
        _id: transport._id,
        motif: transport.motif,
        mobilite: transport.patient?.mobilite,
        adresseDepart: transport.adresseDepart,
        adresseDestination: transport.adresseDestination,
        dateTransport: transport.dateTransport,
        heureDepart: transport.heureDepart,
        oxygene: transport.patient?.oxygene || false,
        brancardage: transport.patient?.brancardage || false,
      },
      vehicules: vehicules.map((v) => ({
        _id: v._id,
        immatriculation: v.immatriculation,
        type: v.type,
        statut: v.statut,
        position: v.position,
        capacites: {
          fauteuil: v.fauteuil,
          oxygene: v.oxygene,
          brancard: v.brancard,
        },
        ponctualite: v.ponctualite,
      })),
      chauffeurs: chauffeurs.map((c) => ({
        _id: c._id,
        nom: c.nom,
        prenom: c.prenom,
        statut: c.statut,
        certifications: c.certifications,
        ponctualite: c.ponctualite,
      })),
    });

    return data;
  } catch (err) {
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      throw new Error("Service IA indisponible (dispatch)");
    }
    throw new Error(err.response?.data?.detail || err.message);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// MODULE 3 — Optimisation de tournée (VRP)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Optimise une tournée quotidienne de transports pour plusieurs véhicules.
 *
 * @param {Object} payload
 * @param {string} payload.date        - Date de la tournée (YYYY-MM-DD)
 * @param {Array}  payload.transports  - Transports à planifier
 * @param {Array}  payload.vehicules   - Véhicules disponibles
 * @param {{ lat, lng }} payload.depot - Position de la base (garage)
 * @returns {Promise<RouteOptimizationResult>}
 */
async function optimiserTournee({ date, transports, vehicules, depot }) {
  try {
    const { data } = await client.post(
      "/routing/optimize",
      { date, transports, vehicules, depot },
      { timeout: 60000 } // OR-Tools peut prendre jusqu'à 60s pour des tournées complexes
    );

    return data;
  } catch (err) {
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      throw new Error("Service IA indisponible (optimisation tournée)");
    }
    throw new Error(err.response?.data?.detail || err.message);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SANTÉ DU SERVICE
// ════════════════════════════════════════════════════════════════════════════

/**
 * Vérifie si le microservice IA est disponible.
 * @returns {Promise<{ available: boolean, version: string, modules: Object }>}
 */
async function verifierSante() {
  try {
    const { data } = await client.get("/health", { timeout: 3000 });
    return { available: true, ...data };
  } catch {
    return {
      available: false,
      version: null,
      modules: { pmt: false, dispatch: false, routing: false },
      message: "Service IA non démarré ou inaccessible",
    };
  }
}

module.exports = {
  extrairePMT,
  recommanderDispatch,
  optimiserTournee,
  verifierSante,
};
