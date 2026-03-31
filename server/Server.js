const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

// ─── Socket.IO ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin:
      process.env.NODE_ENV === "production" ? false : ["http://localhost:3000"],
    methods: ["GET", "POST"],
  },
});

// Rendre io accessible dans les routes
app.set("io", io);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production" ? false : "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/interventions", require("./routes/interventions"));
app.use("/api/units", require("./routes/units"));
app.use("/api/ai", require("./routes/ai"));

// ─── Route de santé ──────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "BlancBleu API is running 🚑" });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: "Route non trouvée" });
});

// ─── Error handler ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ message: "Erreur interne du serveur", error: err.message });
});

// ─── MongoDB + Lancement ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Atlas connecté");
    server.listen(PORT, () => {
      console.log(`🚀 Serveur BlancBleu lancé sur le port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Erreur connexion MongoDB:", err.message);
    process.exit(1);
  });

// ─── Socket.IO Events ────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`🔌 Client connecté: ${socket.id}`);

  socket.on("join_room", (room) => {
    socket.join(room);
    console.log(`📡 Socket ${socket.id} a rejoint la room: ${room}`);
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Client déconnecté: ${socket.id}`);
  });
});
