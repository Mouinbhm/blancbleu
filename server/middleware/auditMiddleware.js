/**
 * BlancBleu — Middleware d'Audit Express
 * Intercepte automatiquement les routes critiques
 */
const { log } = require("../services/auditService");

// Routes à auditer automatiquement
const ROUTES_AUDITEES = [
  { pattern: /POST \/api\/interventions$/, action: "INTERVENTION_CREATED" },
  { pattern: /PATCH \/api\/interventions\/.+/, action: "INTERVENTION_UPDATED" },
  {
    pattern: /DELETE \/api\/interventions\/.+/,
    action: "INTERVENTION_DELETED",
  },
  {
    pattern: /PATCH \/api\/workflow\/.+\/transition/,
    action: "STATUT_CHANGED",
  },
  {
    pattern: /POST \/api\/interventions\/.+\/assign/,
    action: "UNITE_ASSIGNED",
  },
  { pattern: /POST \/api\/ai\/analyze/, action: "IA_PREDICTION" },
  { pattern: /PATCH \/api\/units\/.+/, action: "UNITE_STATUS_CHANGED" },
  { pattern: /POST \/api\/auth\/login/, action: "LOGIN" },
  { pattern: /PATCH \/api\/factures\/.+\/statut/, action: "FACTURE_UPDATED" },
];

function trouverAction(methode, path) {
  const cle = `${methode} ${path}`;
  const match = ROUTES_AUDITEES.find((r) => r.pattern.test(cle));
  return match?.action || null;
}

/**
 * Middleware principal — capture req/res et enregistre l'audit
 */
function auditMiddleware(req, res, next) {
  const action = trouverAction(req.method, req.path);
  if (!action) return next(); // Route non auditée

  const debut = Date.now();
  const corpsBrut = { ...req.body };

  // Intercepter la réponse
  const jsonOriginal = res.json.bind(res);
  res.json = function (data) {
    const dureeMs = Date.now() - debut;
    const succes = res.statusCode < 400;

    // Log asynchrone — ne bloque jamais la réponse
    setImmediate(() => {
      log({
        action,
        origine: detecterOrigine(req),
        utilisateur: {
          id: req.user?._id,
          email: req.user?.email || "anonyme",
          role: req.user?.role || "inconnu",
          ip: req.ip || req.headers["x-forwarded-for"] || "",
        },
        ressource: {
          type: detecterTypeRessource(req.path),
          id: req.params?.id || data?.intervention?._id || data?._id || null,
          reference: data?.intervention?.numero || data?.numero || "",
        },
        details: {
          avant: req.method === "PATCH" ? corpsBrut : null,
          apres: succes ? data?.intervention || data : null,
          metadata: { params: req.params, query: req.query },
          message: succes
            ? `${req.method} ${req.path} — ${res.statusCode}`
            : data?.message || "Erreur",
        },
        succes,
        erreur: succes ? "" : data?.message || "",
        route: req.path,
        methode: req.method,
        dureeMs,
      });
    });

    return jsonOriginal(data);
  };

  next();
}

function detecterOrigine(req) {
  if (req.headers["x-source"] === "ia") return "IA";
  if (req.headers["x-source"] === "system") return "SYSTÈME";
  if (req.headers["x-api-key"]) return "API";
  return "HUMAIN";
}

function detecterTypeRessource(path) {
  if (path.includes("/interventions")) return "Intervention";
  if (path.includes("/units")) return "Unit";
  if (path.includes("/ai")) return "IA";
  if (path.includes("/factures")) return "Facture";
  if (path.includes("/auth")) return "Auth";
  if (path.includes("/workflow")) return "Workflow";
  return "Autre";
}

module.exports = auditMiddleware;
