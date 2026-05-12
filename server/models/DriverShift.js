const mongoose = require("mongoose");

const checklistSchema = new mongoose.Schema(
  {
    fuel:        { type: Boolean, default: false },
    tires:       { type: Boolean, default: false },
    medicalKit:  { type: Boolean, default: false },
    stretcher:   { type: Boolean, default: false },
    cleanliness: { type: Boolean, default: false },
    documents:   { type: Boolean, default: false },
    notes:       { type: String, default: "" },
  },
  { _id: false }
);

const incidentSchema = new mongoose.Schema(
  {
    time:        { type: Date, default: Date.now },
    description: { type: String, required: true },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", default: null },
  },
  { _id: false }
);

const driverShiftSchema = new mongoose.Schema(
  {
    personnelId:         { type: mongoose.Schema.Types.ObjectId, ref: "Personnel", required: true, index: true },
    vehicleId:           { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    date:                { type: Date, required: true, default: () => new Date() },
    startTime:           { type: Date, default: Date.now },
    endTime:             { type: Date, default: null },
    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED", "ABANDONED"],
      default: "ACTIVE",
    },
    startChecklist:      { type: checklistSchema, default: () => ({}) },
    totalKm:             { type: Number, default: 0 },
    totalTransports:     { type: Number, default: 0 },
    completedTransports: { type: Number, default: 0 },
    incidents:           [incidentSchema],
  },
  { timestamps: true }
);

driverShiftSchema.index({ personnelId: 1, status: 1 });
driverShiftSchema.index({ startTime: -1 });

module.exports = mongoose.model("DriverShift", driverShiftSchema);
