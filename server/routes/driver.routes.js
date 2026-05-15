const router           = require("express").Router();
const requirePersonnel = require("../middleware/requirePersonnel");
const ctrl             = require("../controllers/driverController");

// ── Tournée & véhicules ───────────────────────────────────────────────────────
router.get("/vehicles",  requirePersonnel, ctrl.getAvailableVehicles);
router.get("/tournee",   requirePersonnel, ctrl.getTournee);

// ── Transitions nommées (lifecycle complet) ───────────────────────────────────
// ASSIGNED → DRIVER_ACCEPTED
router.patch("/transports/:id/accept",              requirePersonnel, ctrl.acceptMission);
// ASSIGNED → DRIVER_REJECTED
router.patch("/transports/:id/reject",              requirePersonnel, ctrl.rejectMission);
// DRIVER_ACCEPTED → EN_ROUTE_TO_PICKUP
router.patch("/transports/:id/start",               requirePersonnel, ctrl.startRoute);
// EN_ROUTE_TO_PICKUP → ARRIVED_AT_PICKUP
router.patch("/transports/:id/arrived-pickup",      requirePersonnel, ctrl.arrivedPickup);
// ARRIVED_AT_PICKUP → PATIENT_ON_BOARD
router.patch("/transports/:id/patient-on-board",    requirePersonnel, ctrl.patientOnBoard);
// PATIENT_ON_BOARD → ARRIVED_AT_DESTINATION
router.patch("/transports/:id/arrived-destination", requirePersonnel, ctrl.arrivedDestination);
// ARRIVED_AT_DESTINATION → WAITING_AT_DESTINATION (optionnel, dialyse/chimio)
router.patch("/transports/:id/waiting",             requirePersonnel, ctrl.startWaiting);
// WAITING_AT_DESTINATION → RETURN_TO_BASE
router.patch("/transports/:id/return-to-base",      requirePersonnel, ctrl.returnToBase);
// → COMPLETED
router.patch("/transports/:id/complete",            requirePersonnel, ctrl.completeMission);
// ARRIVED_AT_PICKUP → NO_SHOW
router.patch("/transports/:id/no-show",             requirePersonnel, ctrl.noShow);
// → FAILED (tout statut non terminal)
router.patch("/transports/:id/fail",                requirePersonnel, ctrl.failMission);

// ── Rétrocompat générique (Flutter legacy) ────────────────────────────────────
router.patch("/transports/:id/status",              requirePersonnel, ctrl.updateStatus);

// ── Signature & documents ─────────────────────────────────────────────────────
router.post("/transports/:id/signature",  requirePersonnel, ctrl.saveSignature);
router.post("/transports/:id/pmt-photo",  requirePersonnel, ...ctrl.uploadPmtPhoto);

// ── SOS ───────────────────────────────────────────────────────────────────────
router.post("/sos", requirePersonnel, ctrl.sosSend);

module.exports = router;
