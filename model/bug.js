const mongoose = require("mongoose");

const BugSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
    },

    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },

    tags: {
      type: [String],
      default: [],
    },

    status: {
      type: String,
      enum: ["open", "in progress", "resolved", "closed"],
      default: "open",
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },

    startDate: {
      type: Date, // Stores full date + time
    },

    dueDate: {
      type: Date,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    assignedTo: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },

    history: [
      {
        action: {
          type: String,
          enum: [
            "status_change",
            "priority_change",
            "tag_added",
            "tag_removed",
            "assigned",
            "unassigned",
            "created",
            "comment_added",
            "attachment_uploaded",
            "start_date_set",
            "due_date_set",
          ],
          required: true,
        },
        detail: {
          type: String,
          required: true,
        },
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        performedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

/* 
===============================================
🔹 What is an Index in MongoDB?

An index is like a shortcut for searching. 
It helps MongoDB quickly find the documents you need 
without scanning every single one.

Example: Instead of checking every page in a book,
you use the index at the back to jump directly to the right page.
===============================================
*/

/* 
===============================================
🔸 Single-Field Indexes

These indexes help when you're filtering bugs by a 
single field like startDate or dueDate.

Useful when you do queries like:
Bug.find({ startDate: { $gte: ..., $lte: ... } })

They make these range queries faster.
===============================================
*/

// Index only on startDate 
// Sort Bugs by Newest Start Date:
BugSchema.index({ startDate: -1 });

// Index only on dueDate
BugSchema.index({ dueDate: -1 });

// Index on createdAt, useful for sorting or filtering bugs by creation time
BugSchema.index({ createdAt: -1 });

/* 
===============================================
🔸 Compound Index: teamId + startDate

This index is useful when you **always filter bugs by both teamId and a date range**.

Example query:
Bug.find({ teamId: 'xyz123', startDate: { $gte: ..., $lte: ... } })

Why is this better than separate indexes?
- With compound index, MongoDB can **use both fields together** to find matching bugs faster.
- Without it, MongoDB might still scan many documents to match both conditions.

In simple words:
👉 It speeds up queries **for bugs in a team** AND **within a date range**.
===============================================
*/

// Compound index on teamId and startDate
BugSchema.index({ teamId: 1, startDate: -1 });

/* 
===============================================
⚡ Performance Benefit:

With indexes:
- MongoDB uses a sorted internal structure (like a B-tree)
- Searches become O(log n) instead of O(n) 
- Much faster for large collections (thousands/millions of bugs)

Note:
- Indexes slightly slow down insert/update operations (tiny cost).
- Indexes take some disk space.
- Big gain in read/query speed.

Indexes are essential for any app with filtering, sorting, and pagination**.
===============================================
*/

const Bug = mongoose.model("Bug", BugSchema);
module.exports = Bug;
