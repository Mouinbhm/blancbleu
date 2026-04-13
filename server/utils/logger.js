/**
 * BlancBleu — Logger Winston
 *
 * Format JSON en production → agrégable par Papertrail, Logtail, Datadog
 * Format colorisé en développement → lisible dans le terminal
 *
 * Usage :
 *   const logger = require("../utils/logger");
 *   logger.info("Serveur démarré", { port: 5000 });
 *   logger.error("Erreur MongoDB", { err: err.message });
 *   logger.warn("Rate limit atteint", { ip: req.ip });
 */

const winston = require("winston");

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

const isProd = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

// ─── Format développement : lisible dans le terminal ─────────────────────────
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
    return `${ts} [${level}] ${message}${metaStr}${stack ? "\n" + stack : ""}`;
  }),
);

// ─── Format production : JSON structuré ──────────────────────────────────────
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

// ─── Transports ───────────────────────────────────────────────────────────────
const transports = [];

// Console — toujours actif sauf en test
if (!isTest) {
  transports.push(
    new winston.transports.Console({
      format: isProd ? prodFormat : devFormat,
    }),
  );
}

// Fichier erreurs — production uniquement
if (isProd) {
  transports.push(
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
      tailable: true,
    }),
  );
  transports.push(
    new winston.transports.File({
      filename: "logs/combined.log",
      maxsize: 20 * 1024 * 1024, // 20 MB
      maxFiles: 5,
      tailable: true,
    }),
  );
}

// ─── Création du logger ───────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: isTest
    ? "error"
    : process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
  defaultMeta: {
    service: "blancbleu-api",
    version: process.env.npm_package_version || "1.2.0",
    env: process.env.NODE_ENV || "development",
  },
  transports,
  // Ne pas crasher l'app sur exception non catchée — juste logger
  exitOnError: false,
});

// ─── Helper : logger les requêtes HTTP ───────────────────────────────────────
logger.httpRequest = (req, res, duration) => {
  const level =
    res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

  logger[level](`${req.method} ${req.path}`, {
    status: res.statusCode,
    duration: `${duration}ms`,
    ip: req.ip,
    ua: req.get("user-agent")?.slice(0, 80),
  });
};

module.exports = logger;
