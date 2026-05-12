const Transport  = require("../models/Transport");
const Personnel  = require("../models/Personnel");
const multer     = require("multer");
const path       = require("path");
const fs         = require("fs");

// ── Résoudre le Personnel lié à l'utilisateur connecté ───────────────────────
async function _getPersonnel(userId) {
  return Personnel.findOne({ userId });
}

// ════════════════════════════════════════════════════════════════════════════
// GET /api/v1/driver/tournee?date=YYYY-MM-DD
// ════════════════════════════════════════════════════════════════════════════
const getTournee = async (req, res) => {
  try {
    const personnel = await _getPersonnel(req.user._id);
    if (!personnel) {
      return res.status(404).json({ message: "Aucun profil personnel lié à ce compte" });
    }

    const dateStr = req.query.date || new Date().toISOString().split("T")[0];
    const dateDebut = new Date(dateStr);
    const dateFin   = new Date(dateStr);
    dateFin.setDate(dateFin.getDate() + 1);

    const transports = await Transport.find({
      chauffeur:     personnel._id,
      dateTransport: { $gte: dateDebut, $lt: dateFin },
      deletedAt:     null,
    })
      .select([
        "numero", "statut", "typeTransport", "motif",
        "dateTransport", "heureRDV", "heureDepart",
        "patient", "adresseDepart", "adresseDestination",
        "notes", "statusHistory",
        "driverSignedAt", "pmtPhotoUrl",
        "actualPickupTime", "actualDropoffTime", "estimatedArrival",
        "prescription",
      ].join(" "))
      .populate("vehicule", "immatriculation type")
      .sort({ heureRDV: 1 });

    return res.json({ date: dateStr, transports });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/v1/driver/transports/:id/status
// Body: { status, note, timestamp }
// ════════════════════════════════════════════════════════════════════════════
const VALID_TRANSITIONS = {
  ASSIGNED:             ["EN_ROUTE_TO_PICKUP"],
  EN_ROUTE_TO_PICKUP:   ["ARRIVED_AT_PICKUP"],
  ARRIVED_AT_PICKUP:    ["PATIENT_ON_BOARD", "NO_SHOW"],
  PATIENT_ON_BOARD:     ["ARRIVED_AT_DESTINATION"],
  ARRIVED_AT_DESTINATION: ["COMPLETED"],
};

const updateStatus = async (req, res) => {
  try {
    const { status, note = "", timestamp } = req.body;
    if (!status) return res.status(400).json({ message: "status requis" });

    const personnel = await _getPersonnel(req.user._id);
    if (!personnel) return res.status(404).json({ message: "Profil chauffeur introuvable" });

    const transport = await Transport.findOne({
      _id:      req.params.id,
      chauffeur: personnel._id,
    });
    if (!transport) return res.status(404).json({ message: "Transport introuvable" });

    const allowed = VALID_TRANSITIONS[transport.statut] || [];
    if (!allowed.includes(status)) {
      return res.status(422).json({
        message: `Transition invalide : ${transport.statut} → ${status}`,
        allowed,
      });
    }

    const ts = timestamp ? new Date(timestamp) : new Date();

    // Horodatages spécifiques
    const update = { statut: status };
    if (status === "EN_ROUTE_TO_PICKUP")      update.heureEnRoute = ts;
    if (status === "ARRIVED_AT_PICKUP")       update.heurePriseEnCharge = ts;
    if (status === "PATIENT_ON_BOARD")        update.actualPickupTime = ts;
    if (status === "ARRIVED_AT_DESTINATION")  update.heureArriveeDestination = ts;
    if (status === "COMPLETED")               update.heureTerminee = ts;

    update.$push = {
      statusHistory: { status, timestamp: ts, driverId: req.user._id, note },
    };

    const updated = await Transport.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

    // WebSocket → dispatchers
    const io = req.app.get("io");
    if (io) {
      io.to("role:dispatcher").to("role:admin").to("role:superviseur").emit("transport:status_updated", {
        transportId: transport._id,
        numero:      transport.numero,
        status,
        driverId:    req.user._id,
        timestamp:   ts,
      });
    }

    return res.json({ message: "Statut mis à jour", statut: updated.statut });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// POST /api/v1/driver/transports/:id/signature
// Body: { patientSignatureBase64, driverSignatureBase64 }
// ════════════════════════════════════════════════════════════════════════════
const saveSignature = async (req, res) => {
  try {
    const { patientSignatureBase64, driverSignatureBase64 } = req.body;
    if (!patientSignatureBase64 && !driverSignatureBase64) {
      return res.status(400).json({ message: "Au moins une signature requise" });
    }

    const personnel = await _getPersonnel(req.user._id);
    const transport = await Transport.findOne({ _id: req.params.id, chauffeur: personnel?._id });
    if (!transport) return res.status(404).json({ message: "Transport introuvable" });

    const upd = { driverSignedAt: new Date() };
    if (patientSignatureBase64) upd.patientSignatureBase64 = patientSignatureBase64;
    if (driverSignatureBase64)  upd.driverSignatureBase64  = driverSignatureBase64;

    await Transport.findByIdAndUpdate(req.params.id, upd);
    return res.json({ message: "Signatures enregistrées" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// POST /api/v1/driver/transports/:id/pmt-photo   (multipart)
// ════════════════════════════════════════════════════════════════════════════
const uploadDir = path.join(__dirname, "../uploads/pmt");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) =>
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const uploadPmtPhoto = [
  upload.single("photo"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Fichier photo requis (champ 'photo')" });

      const personnel = await _getPersonnel(req.user._id);
      const transport = await Transport.findOne({ _id: req.params.id, chauffeur: personnel?._id });
      if (!transport) return res.status(404).json({ message: "Transport introuvable" });

      const url = `/uploads/pmt/${req.file.filename}`;
      await Transport.findByIdAndUpdate(req.params.id, { pmtPhotoUrl: url });
      return res.json({ message: "Photo PMT enregistrée", url });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },
];

module.exports = { getTournee, updateStatus, saveSignature, uploadPmtPhoto };
