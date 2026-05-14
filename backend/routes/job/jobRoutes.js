const express = require("express");
const router = express.Router();

router.post("/", require("../../controllers/job/jobController").createJob);
router.get("/", require("../../controllers/job/jobController").getJobs);

module.exports = router;