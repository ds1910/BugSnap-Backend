const fs = require("fs");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require("../service/auth");
const User = require("../model/user");
const setTokenCookie = require("../utils/setTokenCookie");



// ======================================================
// ============= Auth Middleware (JWT) ==================
// ======================================================

/**
 * Checks for access token in cookies and attaches decoded user to req.user
 * - If access token is missing or expired, tries to verify refresh token
 * - If valid, issues a new access token and continues
 * - If refresh token is invalid or absent, responds with appropriate error
 * 
 * NOTE:
 * - Best for backend-rendered or protected API routes
 * - Prefer frontend-based token renewal for SPA apps
 */
const checkAuthentication = async (req, res, next) => {
  // Check for token in cookies first, then in Authorization header
  let accessToken = req.cookies?.accessToken;
  let refreshToken = req.cookies?.refreshToken;
  
  // If no token in cookies, check Authorization header
  if (!accessToken) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    }
  }
  
  //  console.log("in middleware: Cookies:", req.cookies);
  // console.log("in middlware Access Token:", accessToken);
  // console.log("in middleware: Refresh Token:", refreshToken);
  if (!accessToken) {
    if (!refreshToken) {
      return res.status(401).json({ message: "Access and Refresh Token Missing" });
    }

    try {
      const user = verifyRefreshToken(refreshToken);
      const newAccessToken = generateAccessToken({ id: user.id });

      // Set tokens in cookies
      setTokenCookie(res, { accessToken });
 
      req.user = user;
      return next();
    } catch (err) {
      return res.status(403).json({ message: "Invalid refresh token. Please login again." });
    }
  }

  try {
    const decode = verifyAccessToken(accessToken);
    req.user = decode;
    // console.log("user:", decode);
    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      if (!refreshToken) {
        return res.status(403).json({ message: "Access expired and no refresh token found" });
      }

      try {
        const user = verifyRefreshToken(refreshToken);
        const newAccessToken = generateAccessToken({ id: user.id });

        // set cookie
        setTokenCookie(res, { accessToken: newAccessToken });

        req.user = user;
        // console.log("user:", user);
        // console.log("Access token expired but refreshed");
        return next();
      } catch (refreshErr) {
        return res.status(403).json({ message: "Refresh token invalid or expired. Please login again." });
      }
    }

    return res.status(401).json({ message: "Invalid Access Token" });
  }
};

// ======================================================
// ======== Authorization: Restrict by Role =============
// ======================================================

/**
 * Restricts access to users with specified roles
 * - Checks req.user.role against allowed roles array
 * - Used after checkAuthentication middleware
 */
const restrictTo = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) return res.redirect("/login");
    if (!roles.includes(req.user.role)) return res.end("Unauthorized");

    next();
  };
};

// ======================================================
// =============== Export Middlewares ===================
// ======================================================

module.exports = {
  checkAuthentication,
  restrictTo,
};
