const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { Server } = require("socket.io");
require("dotenv").config();

const logger = require("./utils/logger");
const httpLogger = require("./middleware/httpLogger");
const { healthHandler } = require("./utils/healthCheck");
const { noSqlSanitize, xssSanitize } = require("./middleware/sanitize");
const { globalLimiter } = require("./middleware/rateLimiter");
const { setupSwagger } = require("./middleware/swagger");

const app = express();
const server = http.createServer(app);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS =
  process.env.NODE_ENV === "production"
    ? (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean)
    : ["http://localhost:3000"];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) callback(null, true);
    else callback(new Error(`CORS bloqué pour : ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
};

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});
app.set("io", io);

const socketService = require("./services/socketService");
socketService.init(io);

// ─── Sécurité ─────────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production",
    crossOriginEmbedderPolicy: process.env.NODE_ENV === "production",
  }),
);
app.use(cors(corsOptions));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(cookieParser());
app.use(noSqlSanitize);
app.use(xssSanitize);
app.use(globalLimiter);

// ─── HTTP Logger ──────────────────────────────────────────────────────────────
app.use(httpLogger);

// ─── Audit ────────────────────────────────────────────────────────────────────
const auditMiddleware = require("./middleware/auditMiddleware");
app.use(auditMiddleware);

// ─── Swagger (dev uniquement) ─────────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  setupSwagger(app);
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/interventions", require("./routes/interventions"));
app.use("/api/interventions", require("./routes/missionCompletion"));
app.use("/api/units", require("./routes/units"));
app.use("/api/ai", require("./routes/ai"));
app.use("/api/geo", require("./routes/geo"));
app.use("/api/workflow", require("./routes/workflow"));
app.use("/api/escalade", require("./routes/escalade"));
app.use("/api/audit", require("./routes/audit"));
app.use("/api/personnel", require("./routes/personnel"));
app.use("/api/equipements", require("./routes/equipements"));
app.use("/api/maintenances", require("./routes/maintenances"));
app.use("/api/factures", require("./routes/factures"));
app.use("/api/analytics", require("./routes/analytics")); // NOUVEAU Phase 3

// ─── Health check enrichi ─────────────────────────────────────────────────────
app.get("/api/health", healthHandler);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: "Route non trouvée" }));

// ─── Gestionnaire d'erreurs global ────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const isProd = process.env.NODE_ENV === "production";
  logger.error(`${req.method} ${req.path}`, {
    err: err.message,
    stack: err.stack,
  });
  res.status(err.status || 500).json({
    message: isProd ? "Erreur interne" : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });
});

// ─── Export pour Supertest ────────────────────────────────────────────────────
module.exports = app;

// ─── Démarrage ────────────────────────────────────────────────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      logger.info("MongoDB connecté");
      server.listen(PORT, () => {
        logger.info(`BlancBleu démarré`, {
          port: PORT,
          env: process.env.NODE_ENV || "development",
        });
        if (process.env.NODE_ENV !== "production") {
          logger.info(`Swagger UI : http://localhost:${PORT}/api-docs`);
        }

        const { demarrerSurveillance } = require("./services/escaladeService");
        demarrerSurveillance(2);

        const { demarrerScan } = require("./services/missionCompletion");
        demarrerScan(5);
      });
    })
    .catch((err) => {
      logger.error("MongoDB connexion échouée", { err: err.message });
      process.exit(1);
    });

  if (process.env.NODE_ENV !== "production") {
    const sim = require("./services/simulationService");
    setTimeout(() => sim.demarrer(), 5000);
  }
}
