const express = require("express");
const {
  createComment,
  getCommentsForBug,
  getCommentById,
  updateCommentById,
  deleteCommentById,
  createReplyToComment,
  getRepliesForComment,
  updateReply,
  deleteReply,
} = require("../controller/comment");

const knowWhichRoute = (req, res, next) => {
  console.log("In knowWhichRoute middleware in router");
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  return next(); // important to pass control to the next middleware or route
};

const { checkBugTeamMatch, checkTeamMembership } = require("../middleware/teamMiddleware");

const router = express.Router();

// Create comment - team membership checked in controller, but add middleware for consistency
router.route("/create").post(createComment);

// Get comments - requires bugId, team validation handled in controller
router.route("/all").get(getCommentsForBug);

// Reply operations - add team membership check via query
router
  .route("/reply")
  .post(createReplyToComment)
  .get(knowWhichRoute, getRepliesForComment)
  .patch(updateReply)
  .delete(deleteReply);

// Comment management operations - ensure user has access
router
  .route("/manage/:commentId")
  .get(getCommentById)
  .patch(updateCommentById)
  .delete(deleteCommentById);

module.exports = router;
