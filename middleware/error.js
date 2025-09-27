// - Error-handling middleware in Express:
// - Defined with 4 parameters: (err, req, res, next)
// - It is called **only when** an error occurs (e.g., thrown or passed via next(err))
// - Skips all remaining normal middlewares/handlers and jumps here
// - Always defined **after** all routes
// - Used for sending custom error responses or logging

const multer = require("multer");

const isError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Handle Multer-specific errors (e.g., file size limits)
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large. Max 5MB allowed." });
    }
    return res.status(400).json({ error: err.message });
  } else if (err) {
    // Handle other generic errors
    return res.status(400).json({ error: err.message });
  }

  // If no error, continue to the next middleware
  next();
};

module.exports = isError;
