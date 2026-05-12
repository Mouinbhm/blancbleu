const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/trackingController");

const requireDriver = [protect, authorize("driver", "ambulancier")];
const requireStaff  = [protect, authorize("driver", "ambulancier", "dispatcher", "admin", "superviseur")];

router.post("/batch",            requireDriver, ctrl.batchInsert);
router.get("/live",              requireStaff,  ctrl.getLive);
router.get("/history/:driverId", requireStaff,  ctrl.getHistory);

module.exports = router;
