const DriverShift = require("../models/DriverShift");

// POST /api/v1/shifts/start
const startShift = async (req, res) => {
  try {
    const { vehicleId, checklist } = req.body;
    if (!vehicleId) return res.status(400).json({ message: "vehicleId requis" });

    const existing = await DriverShift.findOne({ driverId: req.user._id, status: "ACTIVE" });
    if (existing) {
      return res.status(409).json({ message: "Un shift est déjà actif", shiftId: existing._id });
    }

    const shift = await DriverShift.create({
      driverId:       req.user._id,
      vehicleId,
      startChecklist: checklist || {},
    });

    // Notifier les dispatchers
    const io = req.app.get("io");
    if (io) {
      io.to("role:dispatcher").to("role:admin").emit("driver:shift_started", {
        driverId:  req.user._id,
        driverNom: `${req.user.prenom} ${req.user.nom}`,
        vehicleId,
        shiftId:   shift._id,
        startTime: shift.startTime,
      });
    }

    return res.status(201).json({ message: "Shift démarré", shift });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// PATCH /api/v1/shifts/end
const endShift = async (req, res) => {
  try {
    const { totalKm = 0, notes = "" } = req.body;

    const shift = await DriverShift.findOne({ driverId: req.user._id, status: "ACTIVE" });
    if (!shift) return res.status(404).json({ message: "Aucun shift actif" });

    shift.status  = "COMPLETED";
    shift.endTime = new Date();
    shift.totalKm = totalKm;
    if (notes) shift.incidents.push({ time: new Date(), description: `Note fin de shift : ${notes}` });
    await shift.save();

    const io = req.app.get("io");
    if (io) {
      io.to("role:dispatcher").to("role:admin").emit("driver:shift_ended", {
        driverId: req.user._id,
        shiftId:  shift._id,
        totalKm,
        endTime:  shift.endTime,
      });
    }

    return res.json({ message: "Shift terminé", shift });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/v1/shifts/active
const getActiveShift = async (req, res) => {
  try {
    const shift = await DriverShift.findOne({ driverId: req.user._id, status: "ACTIVE" })
      .populate("vehicleId", "immatriculation type statut");
    return res.json({ shift: shift || null });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// POST /api/v1/shifts/incident
const addIncident = async (req, res) => {
  try {
    const { description } = req.body;
    if (!description) return res.status(400).json({ message: "description requise" });

    const shift = await DriverShift.findOne({ driverId: req.user._id, status: "ACTIVE" });
    if (!shift) return res.status(404).json({ message: "Aucun shift actif" });

    shift.incidents.push({ time: new Date(), description });
    await shift.save();

    return res.json({ message: "Incident enregistré" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/v1/shifts?date=YYYY-MM-DD  (dispatcher view)
const listShifts = async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().split("T")[0];
    const from = new Date(dateStr);
    const to   = new Date(dateStr);
    to.setDate(to.getDate() + 1);

    const shifts = await DriverShift.find({ startTime: { $gte: from, $lt: to } })
      .populate("driverId",  "nom prenom")
      .populate("vehicleId", "immatriculation type")
      .sort({ startTime: 1 });

    return res.json({ date: dateStr, shifts });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { startShift, endShift, getActiveShift, addIncident, listShifts };
