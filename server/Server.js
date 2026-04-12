const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { Server } = require("socket.io");
require("dotenv").config();

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
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS bloqué pour : ${origin}`));
    }
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

// ─── Sécurité headers ─────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production",
    crossOriginEmbedderPolicy: process.env.NODE_ENV === "production",
  }),
);

// ─── Parsing ──────────────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(cookieParser());

// ─── Sanitisation ────────────────────────────────────────────────────────────
app.use(noSqlSanitize);
app.use(xssSanitize);

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use(globalLimiter);

// ─── Audit ────────────────────────────────────────────────────────────────────
const auditMiddleware = require("./middleware/auditMiddleware");
app.use(auditMiddleware);

// ─── Swagger (dev uniquement) ────────────────────────────────────────────────
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

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "OK",
    env: process.env.NODE_ENV || "development",
    uptime: Math.round(process.uptime()),
    mongo: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: "Route non trouvée" }));

// ─── Gestionnaire d'erreurs global ────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const isProd = process.env.NODE_ENV === "production";
  console.error(`[ERROR] ${req.method} ${req.path} —`, err.message);
  res.status(err.status || 500).json({
    message: isProd ? "Erreur interne" : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });
});

// ─── Export pour Supertest ────────────────────────────────────────────────────
// IMPORTANT : exporter app AVANT mongoose.connect
// Supertest monte l'app directement sans démarrer de serveur HTTP
// ce qui évite les conflits de port (EADDRINUSE) entre les suites de tests
module.exports = app;

// ─── Démarrage serveur HTTP ───────────────────────────────────────────────────
// require.main === module est vrai uniquement quand on fait : node Server.js
// Quand Jest importe ce fichier via require(), cette condition est fausse
// → le serveur n'écoute jamais sur un port pendant les tests
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log("✅ MongoDB connecté");
      server.listen(PORT, () => {
        console.log(
          `🚀 BlancBleu démarré — port ${PORT} [${process.env.NODE_ENV || "development"}]`,
        );
        if (process.env.NODE_ENV !== "production") {
          console.log(`📄 Swagger UI : http://localhost:${PORT}/api-docs`);
        }
        const { demarrerSurveillance } = require("./services/escaladeService");
        demarrerSurveillance(2);
        const { demarrerScan } = require("./services/missionCompletion");
        demarrerScan(5);
      });
    })
    .catch((err) => {
      console.error("❌ MongoDB connexion échouée :", err.message);
      process.exit(1);
    });

  if (process.env.NODE_ENV !== "production") {
    const sim = require("./services/simulationService");
    setTimeout(() => sim.demarrer(), 5000);
  }
}
