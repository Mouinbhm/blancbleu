/**
 * BlancBleu — Middleware d'erreur centralisé
 *
 * Distingue erreur opérationnelle (isOperational: true) et erreur programmeur.
 * En production, masque les messages des erreurs 500 non opérationnelles.
 */

const logger = require("../utils/logger");

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  logger.error(`${req.method} ${req.path}`, {
    status,
    message: err.message,
    stack: err.stack,
    isOperational: err.isOperational || false,
  });

  const isProd = process.env.NODE_ENV === "production";

  // Masquer les détails en production pour les erreurs 500 non opérationnelles
  const message =
    status >= 500 && isProd && !err.isOperational
      ? "Erreur interne du serveur"
      : err.message;

  res.status(status).json({ message });
};

module.exports = errorHandler;
