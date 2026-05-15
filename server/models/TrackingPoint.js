const mongoose = require("mongoose");

const trackingPointSchema = new mongoose.Schema(
  {
    driverId:    { type: mongoose.Schema.Types.ObjectId, ref: "Personnel", required: true },
    shiftId:     { type: mongoose.Schema.Types.ObjectId, ref: "DriverShift", required: true },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", default: null },
    lat:         { type: Number, required: true },
    lng:         { type: Number, required: true },
    speed:       { type: Number, default: 0 },
    accuracy:    { type: Number, default: null },
    timestamp:   { type: Date, required: true },
  },
  { _id: true }
);

trackingPointSchema.index({ driverId: 1, timestamp: -1 });
trackingPointSchema.index({ shiftId: 1 });
// TTL — auto-suppression après 30 jours
trackingPointSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model("TrackingPoint", trackingPointSchema);
