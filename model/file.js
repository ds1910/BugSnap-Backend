const mongoose = require("mongoose");

// =====================================================
// ================ File Schema (Model) ================
// =====================================================

/**
 * Schema to store uploaded file metadata
 * - fileId: The unique Cloudinary public ID or filename
 * - ownerId: References the user who uploaded the file
 * - timestamps: Automatically includes createdAt and updatedAt
 */
const fileSchema = new mongoose.Schema(
  {
    fileId: {
      type: String,
      required: true, // Stores Cloudinary's public_id or local filename
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",     // References the 'user' collection
      required: true,  // Ensures every file has an associated user
    },

    bugId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bug",      // References the 'bug' collection
      required: true,  // Associates file with a specific bug
    },

    originalName: {
      type: String,
      required: true,  // Store the original filename
    },

    mimetype: {
      type: String,
      required: true,  // Store the file MIME type
    },

    size: {
      type: Number,
      required: true,  // Store file size in bytes
    },

    cloudinaryUrl: {
      type: String,
      required: false, // Store the Cloudinary URL
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

// Create and export the model
const File = mongoose.model("File", fileSchema);

module.exports = File;