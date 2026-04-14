/**
 * BlancBleu — Contrôleur IA
 * Adapté transport sanitaire NON urgent
 * L'analyse IA porte sur la priorisation des transports (récurrence, urgence relative)
 */
const axios = require("axios");
const { audit } = require("../services/auditService");

const AI_API_URL = process.env.AI_API_URL || "http://localhost:5001";

// ─── Scoring local (si Flask non disponible) ──────────────────────────────────
function scoringLocal(motif, mobilite = "ASSIS") {
  let score = 0;
  const scoreMotif = {
    Dialyse: 85,
    Chimiothérapie: 80,
    Radiothérapie: 75,
    Hospitalisation: 70,
    "Sortie hospitalisation": 65,
    Rééducation: 50,
    Consultation: 40,
    Analyse: 30,
    Autre: 20,
  };
  const scoreMobilite = {
    CIVIERE: 30,
    ALLONGE: 25,
    FAUTEUIL_ROULANT: 15,
    ASSIS: 5,
  };
  score += scoreMotif[motif] || 20;
  score += scoreMobilite[mobilite] || 5;
  const priorite = score >= 80 ? "URGENT" : score >= 50 ? "NORMAL" : "FAIBLE";
  return { score, priorite, source: "rules" };
}

// POST /api/ai/analyze
const analyzeIntervention = async (req, res) => {
  try {
    const { motif, mobilite, oxygene, brancardage, recurrence } = req.body;

    if (!motif)
      return res.status(400).json({ message: "motif est requis" });

    let result;
    try {
      const { data } = await axios.post(
        `${AI_API_URL}/predict`,
        { motif, mobilite, oxygene, brancardage, recurrence },
        { timeout: 5000 },
      );
      result = {
        priorite: data.priorite,
        score: data.score,
        confiance: data.confiance,
        typeTransportRecommande: data.typeTransportRecommande,
        justification: data.justification,
        modele: data.modele,
        source: "ml",
      };
    } catch (mlError) {
      console.warn("Modèle ML indisponible — fallback règles:", mlError.message);
      const fallback = scoringLocal(motif, mobilite);
      result = {
        priorite: fallback.priorite,
        score: fallback.score,
        confiance: null,
        typeTransportRecommande:
          mobilite === "ALLONGE" || mobilite === "CIVIERE"
            ? "AMBULANCE"
            : mobilite === "FAUTEUIL_ROULANT"
              ? "TPMR"
              : "VSL",
        justification: ["Analyse par règles métier (modèle ML indisponible)"],
        modele: "Règles BlancBleu v2.0",
        source: "rules",
      };
    }

    res.json(result);

    const fakeTransport = { _id: null, numero: `ANALYSE-${Date.now()}` };
    audit
      .predictionIA(fakeTransport, result.priorite, result.confiance || 0)
      .catch(() => {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/ai/analyze-and-save
const analyzeAndSave = async (req, res) => {
  try {
    const Transport = require("../models/Transport");
    const { transportId, motif, mobilite } = req.body;

    let priorite, score;
    try {
      const { data } = await axios.post(
        `${AI_API_URL}/predict`,
        { motif, mobilite },
        { timeout: 5000 },
      );
      priorite = data.priorite;
      score = data.score;
    } catch {
      const fb = scoringLocal(motif, mobilite);
      priorite = fb.priorite;
      score = fb.score;
    }

    if (transportId) {
      await Transport.findByIdAndUpdate(transportId, {
        "prescription.extractionIA": { priorite, score },
      });
    }

    res.json({ priorite, score, message: "Transport mis à jour" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/ai/options
const getOptions = async (req, res) => {
  try {
    try {
      const { data } = await axios.get(`${AI_API_URL}/features`, {
        timeout: 3000,
      });
      return res.json(data);
    } catch {}
    res.json({
      motifs: [
        "Dialyse",
        "Chimiothérapie",
        "Radiothérapie",
        "Consultation",
        "Hospitalisation",
        "Sortie hospitalisation",
        "Rééducation",
        "Analyse",
        "Autre",
      ],
      mobilites: ["ASSIS", "FAUTEUIL_ROULANT", "ALLONGE", "CIVIERE"],
      typesTransport: ["VSL", "AMBULANCE", "TPMR"],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/ai/status
const getModelStatus = async (req, res) => {
  try {
    const { data } = await axios.get(`${AI_API_URL}/health`, { timeout: 3000 });
    res.json({ ...data, available: true });
  } catch {
    res.json({
      available: false,
      fallback: "rules",
      message: "Modèle ML non démarré",
    });
  }
};

module.exports = {
  analyzeIntervention,
  analyzeAndSave,
  getOptions,
  getModelStatus,
};
