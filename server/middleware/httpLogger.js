/**
 * BlancBleu — Middleware HTTP Logger
 * Log chaque requête avec méthode, path, statut, durée
 * Remplace morgan — utilise notre logger Winston centralisé
 */

const logger = require("../utils/logger");

// Routes à ne pas logger (trop fréquentes, peu utiles)
const SKIP_PATHS = ["/api/health", "/api-docs"];

function httpLogger(req, res, next) {
  if (SKIP_PATHS.some((p) => req.path.startsWith(p))) return next();

  const start = Date.now();

  // Intercepter la fin de réponse
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.httpRequest(req, res, duration);
  });

  next();
}

module.exports = httpLogger;
