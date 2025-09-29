const Bug = require("../model/bug");
const mongoose = require("mongoose");
const Team = require("../model/team");
const Comment = require("../model/comment");
const User = require("../model/user");
const logActivity = require("../utils/logActivity");

const createComment = async (req, res) => {
  const { text, bugId, teamId } = req.body;
  const user = req.user;
  const userId = user?._id || user?.id;

  if (!text || !bugId || !userId || !teamId) {
    return res
      .status(400)
      .json({ error: "Text, bugId, teamId, and user ID are required" });
  }

  try {
    const bug = await Bug.findById(bugId);
    if (!bug) {
      return res.status(404).json({ error: "Bug not found" });
    }

    const team = await Team.findById(teamId);
    const isMember = team?.members.some(
      (member) => member.user.toString() === userId.toString()
    );
    if (!team || !isMember) {
      return res
        .status(403)
        .json({ error: "User is not a member of this team" });
    }

    const newComment = await Comment.create({
      text,
      bugId,
      teamId,
      createdBy: userId,
      parentComment: null,
    });

    const user = await User.findById(userId)
      .select("name email username")
      .lean();
    const username = user?.name || user?.username || user?.email || "Unknown";

    await logActivity({
      userId,
      bugId: bug._id,
      action: "Comment Created",
      details: `$Comment is created by ${username} in ${bug.title}`,
    });

    return res.status(201).json({
      success: true,
      message: "Comment created successfully",
      comment: newComment,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      error: "Failed to create comment",
      details: error.message,
    });
  }
};

const getCommentsForBug = async (req, res) => {
  const { bugId } = req.query;
  const user = req.user;
  const userId = user?._id || user?.id;

  if (!bugId || !userId) {
    return res
      .status(400)
      .json({ error: "bugId, teamId, and user ID are required" });
  }

  try {
    const bug = await Bug.findById(bugId);
    if (!bug) {
      return res.status(404).json({ error: "Bug not found" });
    }

    // fetch only root-level comments for this bug and populate the user who created them
    const comments = await Comment.find({
      bugId: bugId,
      parentComment: null,
    })
      .populate({ path: "createdBy", select: "name" })
      .sort({ createdAt: -1 }); // optional: newest first

    // Optionally fetch reply counts for each top-level comment (non-blocking in parallel)
    const replyCounts = await Promise.all(
      comments.map((c) => Comment.countDocuments({ parentComment: c._id }))
    );

    // Normalize & attach author info to each comment object so frontend can use `author` easily
    const normalized = comments.map((c, idx) => {
      const obj = c.toObject ? c.toObject() : { ...c };
      const userDoc = c.createdBy;
      const author = userDoc
        ? {
            id: userDoc._id,
            name: userDoc.name || "Unknown",
          }
        : { id: null, name: "Unknown" };

      return {
        ...obj,
        id: obj._id || obj.id,
        _id: obj._id || obj.id,
        author,
        repliesCount: replyCounts[idx] ?? 0,
      };
    });

    return res.status(200).json({
      success: true,
      comments: normalized,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch comments",
      details: error.message,
    });
  }
};

const getCommentById = async (req, res) => {
  const { commentId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid comment ID" });
  }

  try {
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, error: "Comment not found" });
    }

    return res.status(200).json({ success: true, data: comment });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Server error",
      details: error.message,
    });
  }
};

const updateCommentById = async (req, res) => {
  const { commentId } = req.params;
  const updatedData = req.body;
  const userId = req.user && (req.user._id || req.user.id);

  if (!updatedData || Object.keys(updatedData).length === 0) {
    return res
      .status(400)
      .json({ success: false, error: "Request body is empty." });
  }

  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid comment ID" });
  }

  // Only allow text to be updated
  const allowedFields = ["text"];
  const filteredData = {};
  for (const field of allowedFields) {
    if (updatedData[field] !== undefined) {
      filteredData[field] = updatedData[field];
    }
  }

  if ("text" in filteredData) {
    const trimmedText = String(filteredData.text || "").trim();
    if (trimmedText.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Comment text cannot be empty." });
    }
    if (trimmedText.length > 500) {
      return res.status(400).json({
        success: false,
        error: "Comment text is too long (max 500 characters).",
      });
    }
    filteredData.text = trimmedText;
  }

  if (Object.keys(filteredData).length === 0) {
    return res
      .status(400)
      .json({ success: false, error: "No valid fields to update." });
  }

  try {
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, error: "Comment not found" });
    }

    // Authorization check
    if (!userId || comment.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to update this comment.",
      });
    }

    // Update comment text
    comment.text = filteredData.text;
    await comment.save();

    // Populate createdBy for client convenience
    const updatedComment = await Comment.findById(commentId).populate(
      "createdBy",
      "name email"
    );

    // Get bug info from request body if sent
    const bug = updatedData.bug || null;
    const user = await User.findById(userId)
      .select("name email username")
      .lean();
    const username = user?.name || user?.username || user?.email || "Unknown";

    // Log activity if bug exists
    if (bug && bug.title && bug._id) {
      await logActivity({
        userId,
        bugId: bug._id,
        action: "Comment Updated",
        details: `Comment is updated by ${username} in ${bug.title}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Comment updated successfully",
      data: updatedComment,
    });
  } catch (error) {
    console.error("Error updating comment:", error);
    return res.status(500).json({
      success: false,
      error: "Server error",
      details: error.message,
    });
  }
};

// DELETE /comment/:commentId
const deleteCommentById = async (req, res) => {
  console.log("in deleteCommentById");
  const { commentId } = req.params;
  const user = req.user;
  const userId = user && (user.id || user._id);

  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid comment ID" });
  }
  if (!userId) {
    return res
      .status(401)
      .json({ success: false, error: "Authentication required" });
  }

  try {
    const existing = await Comment.findById(commentId).lean();
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Comment not found" });
    }

    const commentAuthorId = String(existing.createdBy);
    const strUserId = String(userId);

    // If user is the creator -> allow delete
    if (commentAuthorId === strUserId) {
      const deletedComment = await Comment.findOneAndDelete({
        _id: commentId,
        createdBy: userId,
      }).lean();

      // Cascade delete replies (single level only)
      await Comment.deleteMany({ parentComment: commentId });

      return res.status(200).json({
        success: true,
        message: "Comment and its replies deleted successfully",
        data: deletedComment,
      });
    }
  } catch (error) {
    console.error("Error deleting comment:", error);
    return res.status(500).json({
      success: false,
      error: "Server error",
      details: error.message,
    });
  }
};

const createReplyToComment = async (req, res) => {
  try {
    const { parentId, text, bugId } = req.body;
    const userId = req.user?.id;

    if (!text || !bugId || !userId || !parentId) {
      return res.status(400).json({
        error: "Text, bugId, parentId, and user ID are required",
      });
    }

    const parent = await Comment.findById(parentId);
    if (!parent) {
      return res.status(404).json({ error: "Parent comment not found" });
    }

    if (parent.parentComment) {
      return res.status(400).json({ error: "Cannot reply to a reply." });
    }

    const reply = await Comment.create({
      text,
      bugId,
      createdBy: userId,
      parentComment: parentId,
    });

    const parentComment = await Comment.findById(parentId).lean();
    const bug = await Bug.findById(bugId);
    const user = await User.findById(userId)
      .select("name email username")
      .lean();
    const username = user?.name || user?.username || user?.email || "Unknown";

    // Only log if parentComment and bug exist
    if (parentComment && bug && bug.title && bug._id) {
      await logActivity({
        userId,
        bugId: bug._id, // use the actual bug document ID
        action: "Reply Created",
        details: `${username} replied to "${parentComment.text}" in "${bug.title}"`,
      });
    }

    return res.status(201).json({
      message: "Reply added successfully",
      reply,
    });
  } catch (error) {
    console.error("Error creating reply:", error);
    return res.status(500).json({
      error: "Failed to add reply",
      details: error.message,
    });
  }
};

const getRepliesForComment = async (req, res) => {
  try {
    // Accept parentId from query OR params (client uses query)
    const parentId = req.query.parentId || req.params.id;
    const bugId = req.query.bugId || null;

    if (!parentId) {
      return res
        .status(400)
        .json({ success: false, error: "parentId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid parentId" });
    }

    // Ensure parent comment exists
    const parent = await Comment.findById(parentId);
    if (!parent) {
      return res
        .status(404)
        .json({ success: false, error: "Parent comment not found" });
    }

    // Ensure we are fetching replies to a root-level comment
    if (parent.parentComment) {
      return res.status(400).json({
        success: false,
        error: "Replies to replies are not supported.",
      });
    }

    // Optional: validate bugId if provided
    if (bugId && !mongoose.Types.ObjectId.isValid(bugId)) {
      return res.status(400).json({ success: false, error: "Invalid bugId" });
    }
    if (bugId) {
      const bugExists = await Bug.exists({ _id: bugId });
      if (!bugExists) {
        return res.status(404).json({ success: false, error: "Bug not found" });
      }
    }

    // Build filter: always match parentComment; include bugId if provided
    const filter = { parentComment: parentId };
    if (bugId) filter.bugId = bugId;

    // Fetch replies and populate author info
    const replies = await Comment.find(filter)
      .populate({ path: "createdBy", select: "name email role" })
      .sort({ createdAt: 1 }); // oldest-first; change as needed

    // Normalize replies so frontend can easily read author and id fields
    const normalized = replies.map((r) => {
      const obj = r.toObject ? r.toObject() : { ...r };
      const userDoc = r.createdBy;
      const author = userDoc
        ? {
            id: userDoc._id,
            name: userDoc.name || "Unknown",
            email: userDoc.email || null,
            role: userDoc.role || null,
          }
        : { id: null, name: "Unknown", email: null, role: null };

      return {
        ...obj,
        id: obj._id,
        _id: obj._id,
        author,
      };
    });

    return res.status(200).json({
      success: true,
      reply: normalized,
      replies: normalized,
    });
  } catch (error) {
    console.error("Failed to fetch replies:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch replies",
      details: error.message,
    });
  }
};

// PATCH /comment/reply
const updateReply = async (req, res) => {
  try {
    const { parentId, replyId, text } = req.body;
    const userId = req.user && (req.user._id || req.user.id);

    // Basic validations
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: "Authentication required" });
    }
    if (!parentId || !mongoose.Types.ObjectId.isValid(parentId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid parentId" });
    }
    if (!replyId || !mongoose.Types.ObjectId.isValid(replyId)) {
      return res.status(400).json({ success: false, error: "Invalid replyId" });
    }
    if (typeof text !== "string" || text.trim().length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Text is required" });
    }

    try {
      // We store replies as separate Comment documents with parentComment = parentId.
      // So update the reply document itself, ensuring it belongs to the user and to the parent.
      const filter = {
        _id: replyId,
        parentComment: parentId,
        createdBy: userId,
      };

      const update = {
        $set: {
          text: text.trim(),
          updatedAt: new Date(),
        },
      };

      const options = { new: true }; // return updated document

      const updatedReply = await Comment.findOneAndUpdate(
        filter,
        update,
        options
      )
        .populate("createdBy", "name email role")
        .lean();

      if (!updatedReply) {
        // Distinguish reasons: reply missing vs forbidden
        const existingReply = await Comment.findById(replyId).lean();
        if (!existingReply) {
          return res
            .status(404)
            .json({ success: false, error: "Reply not found" });
        }

        // reply exists — check if parent matches
        if (String(existingReply.parentComment) !== String(parentId)) {
          return res.status(400).json({
            success: false,
            error: "Reply does not belong to the provided parentId",
          });
        }

        // reply exists and parent matches but user didn't own it
        return res.status(403).json({
          success: false,
          error: "You are not authorized to update this reply.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Reply updated successfully",
        data: updatedReply,
      });
    } catch (err) {
      console.error("Error updating reply:", err);
      return res.status(500).json({
        success: false,
        error: "Server error",
        details: err.message,
      });
    }
  } catch (error) {
    return res.status(400).json({
      success: true,
      message: "Reply updated no done",
      data: updatedReply,
    });
  }
};

const deleteReply = async (req, res) => {
  console.log(req.body);
  try {
    // Auth
    const user = req.user;
    if (!user || !(user.id || user._id)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = String(user.id || user._id).trim();

    const { replyId } = req.body || {};
    if (!replyId) {
      return res.status(400).json({ error: "Missing required field: replyId" });
    }
    const replyIdStr = String(replyId).trim();

    if (!mongoose.Types.ObjectId.isValid(replyIdStr)) {
      return res.status(400).json({ error: "Invalid replyId" });
    }

    console.log("replystr: " + replyIdStr);
    const replyDoc = await Comment.findById(replyIdStr).lean();

    console.log(replyDoc);
    if (!replyDoc) {
      return res.status(404).json({ error: "Reply not found" });
    }

    // Basic permission: creator can always delete
    const replyAuthorId = String(replyDoc.createdBy).trim();
    if (replyAuthorId === userId) {
      // delete and return
      const deleted = await Comment.findByIdAndDelete(replyIdStr).lean();
      if (!deleted) {
        return res.status(200).json({
          success: true,
          message: "Reply already removed or nothing to do",
          replyId: replyIdStr,
        });
      }
      return res.status(200).json({
        success: true,
        message: "Reply deleted",
        replyId: replyIdStr,
      });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
};

module.exports = {
  createComment,
  getCommentsForBug,
  getCommentById,
  updateCommentById,
  deleteCommentById,
  createReplyToComment,
  getRepliesForComment,
  updateReply,
  deleteReply,
};
