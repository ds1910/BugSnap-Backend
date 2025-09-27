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

const { checkBugTeamMatch } = require("../middleware/teamMiddleware");

const router = express.Router();

router.route("/create").post(createComment);

router.route("/all").get(getCommentsForBug);

router
  .route("/reply")
  .post(createReplyToComment)
  .get(knowWhichRoute, getRepliesForComment)
  .patch(updateReply)
  .delete(deleteReply);

// NOTE: fixed missing leading slash on "manage/:commentId"
router
  .route("/manage/:commentId")
  // optionally expose GET for fetching a single comment
  .get(getCommentById)
  .patch(updateCommentById)
  .delete(deleteCommentById);

module.exports = router;
