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
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

// Create and export the model
const File = mongoose.model("File", fileSchema);

module.exports = File;