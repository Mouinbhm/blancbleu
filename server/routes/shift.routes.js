const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/shiftController");

const requireDriver = [protect, authorize("driver", "ambulancier")];
const requireStaff  = [protect, authorize("driver", "ambulancier", "dispatcher", "admin", "superviseur")];

router.post("/start",    requireDriver, ctrl.startShift);
router.patch("/end",     requireDriver, ctrl.endShift);
router.get("/active",    requireDriver, ctrl.getActiveShift);
router.post("/incident", requireDriver, ctrl.addIncident);
router.get("/",          requireStaff,  ctrl.listShifts);

module.exports = router;
