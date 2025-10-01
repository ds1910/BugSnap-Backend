const express = require("express");
const USER = require("../model/user"); // Optional if not used here
const {
  handleUserSignup,
  handleUserLogin,
  handleLogout,
  handelForgotPassword,
  handleResetPassword,
  getCurrentUser,
} = require("../controller/user");
const { checkAuthentication } = require("../middleware");

const router = express.Router();

/* ====================== USER AUTH ROUTES ====================== */

/**
 * @swagger
 * /user/signup:
 *   post:
 *     summary: User signup
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User signed up successfully
 *       400:
 *         description: Invalid input
 * 
 *   get:
 *     summary: Serve signup page (HTML)
 *     tags: [User]
 *     responses:
 *       200:
 *         description: Signup page served
 */
router.route("/signup")
  .post(handleUserSignup);

/**
 * @swagger
 * /user/login:
 *   post:
 *     summary: User login
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User logged in successfully
 *       401:
 *         description: Invalid credentials
 * 
 *   get:
 *     summary: Serve login page (HTML)
 *     tags: [User]
 *     responses:
 *       200:
 *         description: Login page served
 */
router.route("/login")
  .post(handleUserLogin);

/**
 * @swagger
 * /user/logout:
 *   post:
 *     summary: User logout
 *     tags: [User]
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: User not authenticated
 */
router.post("/logout", handleLogout);

/* ====================== PASSWORD RESET ROUTES ====================== */

/**
 * @swagger
 * /user/forgotPassword:
 *   post:
 *     summary: Initiate password reset
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       404:
 *         description: Email not found
 */
router.route("/forgotPassword")
  .post(handelForgotPassword);

/**
 * @swagger
 * /user/resetPassword:
 *   post:
 *     summary: Complete password reset
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 * 
 *   get:
 *     summary: Serve reset password page (HTML)
 *     tags: [User]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Reset token for password change
 *     responses:
 *       200:
 *         description: Reset password page served
 *       400:
 *         description: Invalid token
 */
router.route("/resetPassword")
  .post(handleResetPassword);

/**
 * @swagger
 * /user/me:
 *   get:
 *     summary: Get current user info and fresh tokens
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User info and tokens retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.route("/me")
  .get(checkAuthentication, getCurrentUser);

/* ====================== EXPORT ROUTER ====================== */
module.exports = router;
