const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
    },
    bugId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bug",
      required: true,
    },
   
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "comment",
      default: null,
    },
  },
  {
    timestamps: true, 
  }
);

const Comment = mongoose.model("Comment", commentSchema);
module.exports = Comment;