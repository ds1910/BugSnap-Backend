const multer = require("multer");
const path = require("path");

// ==========================================================
// =============== Multer Configuration =====================
// ==========================================================

/**
 * File filter to allow common file types for bug attachments
 * - Accepts images, documents, and common file formats
 * - Rejects potentially dangerous file types
 */
const fileFilter = (req, file, cb) => {
  // Allow images
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  }
  // Allow documents
  else if (file.mimetype === "application/pdf" ||
           file.mimetype === "application/msword" ||
           file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
           file.mimetype === "application/vnd.ms-excel" ||
           file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
           file.mimetype === "text/plain" ||
           file.mimetype === "text/csv") {
    cb(null, true);
  }
  // Allow archives
  else if (file.mimetype === "application/zip" ||
           file.mimetype === "application/x-rar-compressed" ||
           file.mimetype === "application/x-7z-compressed") {
    cb(null, true);
  }
  else {
    cb(new Error("File type not allowed. Please upload images, documents, or archives."), false);
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
