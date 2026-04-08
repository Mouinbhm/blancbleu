const axios = require("axios");
const { audit } = require("../services/auditService");

const AI_API_URL = process.env.AI_API_URL || "http://localhost:5001";

// ─── Scoring fallback (si Flask non disponible) ───────────────────────────────
function scoringLocal(
  typeIncident,
  etatPatient,
  symptomes = [],
  nbVictimes = 1,
) {
  let score = 0;
  const scoreType = {
    "Arrêt cardiaque": 40,
    AVC: 38,
    "Détresse respiratoire": 35,
    "Douleur thoracique": 30,
    "Traumatisme grave": 33,
    "Accident de la route": 28,
    Intoxication: 25,
    Accouchement: 30,
    Malaise: 15,
    Brûlure: 20,
    Chute: 12,
    Autre: 10,
  };
  const scoreEtat = {
    critique: 30,
    inconscient: 25,
    inconnu: 10,
    conscient: 8,
    stable: 5,
  };
  score += scoreType[typeIncident] || 10;
  score += scoreEtat[etatPatient] || 8;
  if (nbVictimes > 1) score += Math.min((nbVictimes - 1) * 5, 25);
  const priorite = score >= 80 ? "P1" : score >= 55 ? "P2" : "P3";
  return { score, priorite, source: "rules" };
}

// POST /api/ai/analyze
const analyzeIntervention = async (req, res) => {
  try {
    const {
      typeIncident,
      etatPatient,
      symptomes,
      nbVictimes,
      age,
      adresse,
      arrivalMode,
      injury,
      mental,
      pain,
      nrsPain,
      patientsPerHour,
    } = req.body;

    if (!typeIncident || !etatPatient)
      return res
        .status(400)
        .json({ message: "typeIncident et etatPatient sont requis" });

    let result;
    try {
      const { data } = await axios.post(
        `${AI_API_URL}/predict`,
        {
          typeIncident,
          etatPatient,
          nbVictimes: nbVictimes || 1,
          age: age || 40,
          symptomes: symptomes || [],
          adresse: adresse || "",
          arrivalMode: arrivalMode || "walk",
          injury: injury || false,
          mental: mental || 1,
          pain: pain || 0,
          nrsPain: nrsPain || 0,
          patientsPerHour: patientsPerHour || 5,
        },
        { timeout: 5000 },
      );

      result = {
        priorite: data.priorite,
        score: data.score,
        confiance: data.confiance,
        probabilites: data.probabilites,
        uniteRecommandee: data.uniteRecommandee,
        justification: data.justification,
        modele: data.modele,
        source: "ml",
      };
    } catch (mlError) {
      console.warn(
        "Modèle ML indisponible — fallback règles:",
        mlError.message,
      );
      const fallback = scoringLocal(
        typeIncident,
        etatPatient,
        symptomes,
        nbVictimes,
      );
      result = {
        priorite: fallback.priorite,
        score: fallback.score,
        confiance: null,
        probabilites: {},
        uniteRecommandee:
          fallback.priorite === "P1"
            ? "SMUR"
            : fallback.priorite === "P2"
              ? "VSAV"
              : "VSL",
        justification: [
          "Analyse par règles médicales (modèle ML indisponible)",
        ],
        modele: "Règles BlancBleu v1.0",
        source: "rules",
      };
    }

    res.json(result);

    // ── Audit traçabilité IA ──────────────────────────────────────────────
    const fakeIntervention = { _id: null, numero: `ANALYSE-${Date.now()}` };
    audit
      .predictionIA(fakeIntervention, result.priorite, result.confiance || 0)
      .catch(() => {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/ai/analyze-and-save
const analyzeAndSave = async (req, res) => {
  try {
    const Intervention = require("../models/Intervention");
    const {
      interventionId,
      typeIncident,
      etatPatient,
      symptomes,
      nbVictimes,
      age,
    } = req.body;

    let priorite, score;
    try {
      const { data } = await axios.post(
        `${AI_API_URL}/predict`,
        {
          typeIncident,
          etatPatient,
          nbVictimes: nbVictimes || 1,
          age: age || 40,
          symptomes: symptomes || [],
        },
        { timeout: 5000 },
      );
      priorite = data.priorite;
      score = data.score;
    } catch {
      const fb = scoringLocal(typeIncident, etatPatient, symptomes, nbVictimes);
      priorite = fb.priorite;
      score = fb.score;
    }

    if (interventionId)
      await Intervention.findByIdAndUpdate(interventionId, {
        priorite,
        scoreIA: score,
      });

    res.json({ priorite, score, message: "Intervention mise à jour" });
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
      typeIncidents: [
        "Arrêt cardiaque",
        "AVC",
        "Détresse respiratoire",
        "Douleur thoracique",
        "Traumatisme grave",
        "Accident de la route",
        "Intoxication",
        "Accouchement",
        "Malaise",
        "Brûlure",
        "Chute",
        "Autre",
      ],
      etatsPatient: [
        "critique",
        "inconscient",
        "conscient",
        "stable",
        "inconnu",
      ],
      symptomes: [
        "arrêt cardiaque",
        "perte de connaissance",
        "détresse respiratoire",
        "hémorragie",
        "paralysie",
        "convulsions",
        "douleurs thoraciques",
        "fracture",
        "brûlures",
        "hypotension",
        "cyanose",
        "confusion",
      ],
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
