const multer = require("multer");
const path = require("path");

// ==========================================================
// =============== Multer Configuration =====================
// ==========================================================

/**
 * File filter to allow only image uploads
 * - Accepts files with MIME type(Multipurpose Internet Mail Extensions type, is a standard way to identify the format of a file) starting with "image/"
 * - Rejects others with an error
 */
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

// Define custom disk storage configuration for multer
const storage = multer.diskStorage({
  /**
   * Destination folder for storing uploaded files
   * - "./upload" is relative to the root of the project
   */
  destination: function (req, file, cb) {
    cb(null, "./upload");
  },

  /**
   * Generate unique filenames to prevent collisions
   * - Combines timestamp + random number + original file extension
   */
  filename: function (req, file, cb) {
    const uniqueFilename =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);
    cb(null, uniqueFilename);
  },
});

// Create and export the multer instance with config

// multer is a middleware for Node.js that helps you handle file uploads (like images, PDFs, etc.) from HTML forms.
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
  },
});

module.exports = upload;
