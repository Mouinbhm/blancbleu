const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/driverController");

const requireDriver = [protect, authorize("driver", "ambulancier")];

router.get("/tournee", requireDriver, ctrl.getTournee);
router.patch("/transports/:id/status",    requireDriver, ctrl.updateStatus);
router.post("/transports/:id/signature",  requireDriver, ctrl.saveSignature);
router.post("/transports/:id/pmt-photo",  requireDriver, ...ctrl.uploadPmtPhoto);

module.exports = router;
