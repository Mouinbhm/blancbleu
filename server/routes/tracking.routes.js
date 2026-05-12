const router           = require("express").Router();
const requirePersonnel = require("../middleware/requirePersonnel");
const { protect, authorize } = require("../middleware/auth");
const ctrl             = require("../controllers/trackingController");

// Driver writes — Personnel JWT
router.post("/batch", requirePersonnel, ctrl.batchInsert);

// Dispatcher reads — User JWT
const requireStaff = [protect, authorize("dispatcher", "admin", "superviseur")];
router.get("/live",              requireStaff, ctrl.getLive);
router.get("/history/:driverId", requireStaff, ctrl.getHistory);

module.exports = router;
