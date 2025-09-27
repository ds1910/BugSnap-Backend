const express = require("express");
const {
  handleRedirectToGoogle,
  handleGoogleLoginCallBack,
  handleGitHubLogin,
  handleGitHubCallback,
} = require("../controller/oauth");

const router = express.Router();

/* ====================== GOOGLE OAUTH ROUTES ====================== */

/**
 * @swagger
 * /auth/google:
 *   get:
 *     summary: Initiates Google OAuth login
 *     tags: [OAuth]
 *     description: Redirects user to Google login with client_id, redirect_uri, scopes, and response_type.
 *     responses:
 *       302:
 *         description: Redirect to Google login page
 */
router.get("/google", handleRedirectToGoogle);

/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     tags: [OAuth]
 *     description: Handles Google's redirect after login. Exchanges code for access_token, fetches user info, and sets auth cookies.
 *     responses:
 *       200:
 *         description: Successfully authenticated with Google
 *       400:
 *         description: Authentication failed
 */
router.get("/google/callback", handleGoogleLoginCallBack);

/* ====================== GITHUB OAUTH ROUTES ====================== */

/**
 * @swagger
 * /auth/github:
 *   get:
 *     summary: Initiates GitHub OAuth login
 *     tags: [OAuth]
 *     description: Redirects user to GitHub login with client_id, redirect_uri, and scopes.
 *     responses:
 *       302:
 *         description: Redirect to GitHub login page
 */
router.get("/github", handleGitHubLogin);

/**
 * @swagger
 * /auth/github/callback:
 *   get:
 *     summary: GitHub OAuth callback
 *     tags: [OAuth]
 *     description: Handles GitHub's redirect after login. Exchanges code for access_token, fetches user info, and sets auth cookies.
 *     responses:
 *       200:
 *         description: Successfully authenticated with GitHub
 *       400:
 *         description: Authentication failed
 */
router.get("/github/callback", handleGitHubCallback);

/* ====================== EXPORT ROUTER ====================== */
module.exports = router;
