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

const app = express();
const server = http.createServer(app);

// ─── CORS — origines autorisées ───────────────────────────────────────────────
const ALLOWED_ORIGINS =
  process.env.NODE_ENV === "production"
    ? (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean)
    : ["http://localhost:3000"];

const corsOptions = {
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origin (Postman, mobile natif)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS bloqué pour l'origine : ${origin}`));
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

// ─── Initialiser le service Socket.IO (gestion complète des connexions) ───────
// NOTE : c'est ici et SEULEMENT ici que les événements socket sont gérés.
// Ne pas dupliquer io.on("connection") plus bas dans ce fichier.
const socketService = require("./services/socketService");
socketService.init(io);

// ─── Sécurité headers HTTP (helmet) ──────────────────────────────────────────
// Désactive contentSecurityPolicy en dev pour éviter les blocages du frontend CRA
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production",
    crossOriginEmbedderPolicy: process.env.NODE_ENV === "production",
  }),
);

// ─── Parsing ──────────────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(express.json({ limit: "10kb" })); // limite la taille du body
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(cookieParser()); // nécessaire pour les cookies refresh token

// ─── Sanitisation des inputs (AVANT les routes) ───────────────────────────────
app.use(noSqlSanitize);
app.use(xssSanitize);

// ─── Rate limiting global (AVANT les routes) ─────────────────────────────────
app.use(globalLimiter);

// ─── Middleware d'audit (AVANT les routes) ───────────────────────────────────
const auditMiddleware = require("./middleware/auditMiddleware");
app.use(auditMiddleware);

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
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "BlancBleu API is running",
    env: process.env.NODE_ENV || "development",
    uptime: Math.round(process.uptime()),
  });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: "Route non trouvée" }));

// ─── Gestionnaire d'erreurs global ────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Ne pas exposer les détails d'erreur en production
  const isProd = process.env.NODE_ENV === "production";
  console.error(`[ERROR] ${req.method} ${req.path} —`, err.message);
  res.status(err.status || 500).json({
    message: isProd ? "Erreur interne du serveur" : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });
});

// ─── Démarrage ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connecté");
    server.listen(PORT, () => {
      console.log(
        `🚀 Serveur BlancBleu démarré sur le port ${PORT} [${process.env.NODE_ENV || "development"}]`,
      );

      const { demarrerSurveillance } = require("./services/escaladeService");
      demarrerSurveillance(2);

      const { demarrerScan } = require("./services/missionCompletion");
      demarrerScan(5);
    });
  })
  .catch((err) => {
    console.error("❌ Erreur connexion MongoDB:", err.message);
    process.exit(1);
  });

// ─── Simulation GPS (développement uniquement) ────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  const sim = require("./services/simulationService");
  setTimeout(() => sim.demarrer(), 5000);
}
