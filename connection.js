const mongoose = require("mongoose");

// Enable strictQuery mode
// Helps catch potential query issues by requiring fields to match the schema
mongoose.set("strictQuery", true);

/**
 * Connects to MongoDB using the given connection URL.
 *
 * @param {string} url - MongoDB connection string (e.g., from .env)
 * @returns {Promise} - Resolves when connected successfully, or throws on failure
 */
const connectMongoDb = async (url) => {
  return mongoose.connect(url);
};

module.exports = connectMongoDb;
