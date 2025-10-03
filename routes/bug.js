const express = require("express");
const {
  handleCreateBug,
  handleGetAllBugsForTeam,
  handleGetBugById,
  handleUpdateBugById,
  handleDeleteBugById,
  handleAssignUserToBug,
  getAllAssignedBugs,
  handleBugFileUpload,
} = require("../controller/bug");
const cache = require("../middleware/redis");

const {checkTeamMembership, checkTeamAdmin, checkBugTeamMatch } = require("../middleware/teamMiddleware");
const upload = require("../middleware/multer");
const router = express.Router();

// Create bug - requires team membership (two routes for flexibility)
router.route("/create").post(checkTeamMembership('body'), handleCreateBug);
router.route("/").post(checkTeamMembership('query'), handleCreateBug);

// Get all bugs for team - requires team membership
router.route("/all").get(checkTeamMembership('query'),cache(600), handleGetAllBugsForTeam);

// Bug management operations - requires team membership
router
  .route("/manage/:id")
  .get(checkTeamMembership('query'),cache(600), handleGetBugById)
  .patch(checkTeamMembership('query'), handleUpdateBugById)
  .delete(checkTeamMembership('query'), handleDeleteBugById);

// Alternative route that accepts bugId in request body (for frontend compatibility)
router
  .route("/manage")
  .patch(checkTeamMembership('query'), handleUpdateBugById);

// File upload for bug - requires team membership
router
  .route("/manage/:id/upload")
  .post(checkTeamMembership('query'), upload.single("file"), handleBugFileUpload);

/* ====================== EXPORT ROUTER ====================== */
module.exports = router;
