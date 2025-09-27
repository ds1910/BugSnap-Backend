const express = require("express");
const {
  handleCreateBug,
  handleGetAllBugsForTeam,
  handleGetBugById,
  handleUpdateBugById,
  handleDeleteBugById,
  handleAssignUserToBug,
  getAllAssignedBugs,
} = require("../controller/bug");

const {checkTeamMembership, checkTeamAdmin, checkBugTeamMatch } = require("../middleware/teamMiddleware");
const router = express.Router()
;
router.route("/create").post(handleCreateBug);

router.route("/all").get(handleGetAllBugsForTeam);
router
  .route("/manage")
  .get(handleGetBugById)
  .patch(handleUpdateBugById)
  .delete(handleDeleteBugById);

/* ====================== EXPORT ROUTER ====================== */
module.exports = router;
