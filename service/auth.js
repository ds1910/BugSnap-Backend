const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

// =====================================================
// =============== Token Generation ====================
// =====================================================

/**
 * Generates a short-lived access token
 * - Used for authorizing API requests
 * - Expires in 30 minutes
 */
const generateAccessToken = (user) => {
  return jwt.sign(user, ACCESS_TOKEN_SECRET, { expiresIn: "30m" });
};

/**
 * Generates a long-lived refresh token
 * - Used to issue new access tokens when they expire
 * - Expires in 7 days
 */
const generateRefreshToken = (user) => {
  return jwt.sign(user, REFRESH_TOKEN_SECRET, { expiresIn: "7d" });
};

// =====================================================
// =================== Token Verification ==============
// =====================================================

/**
 * Verifies access token using the access token secret
 * - Throws error if token is invalid or expired
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, ACCESS_TOKEN_SECRET);
};

/**
 * Verifies refresh token using the refresh token secret
 * - Used to reissue new access tokens
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_TOKEN_SECRET);
};

// =====================================================
// =================== Export Functions ================
// =====================================================

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
