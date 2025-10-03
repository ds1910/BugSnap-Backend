const USER = require("../model/user");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const restToken = require("../model/resetToken");
const setTokenCookie = require("../utils/setTokenCookie");
const encrypt = require("../service/encrypt");
const FRONTEND_URL_MAIN = process.env.FRONTEND_URL_MAIN;
const BACKEND_URL_MAIN = process.env.BACKEND_URL_MAIN;
const {transporter} = require("./nodemailerConfig");;
const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require("../service/auth");

// ==========================================
// ========== Handle User Signup ============
// ==========================================

/**
 * Registers a new user
 * - Validates input
 * - Creates user in DB
 * - Redirects to login (HTML) or returns success (API)
 */

const sendmailForSignup = async ({ to, name, loginURL }) => {
  try {

    const mailOptions = {
      from: `BugSnap <${process.env.EMAIL_USER}>`,
      to,
      subject: "🎉 Welcome to BugSnap!",
      html: `
<html>
  <body style="margin:0; padding:0; background:#f6faff; font-family: 'Segoe UI', Helvetica, Arial, sans-serif;">
    <div style="
      max-width: 640px; 
      margin: 40px auto; 
      padding: 40px 28px; 
      background: linear-gradient(145deg, #ffffff, #f2f9ff); 
      border-radius: 20px; 
      box-shadow: 0 10px 40px rgba(0, 123, 255, 0.12); 
      color: #333; 
      line-height: 1.7;
    ">

      <!-- HEADER / LOGO -->
      <div style="text-align:center; margin-bottom: 28px;">
        <img src="https://i.ibb.co/7tVh5Yc/bugsnap-logo.png" alt="BugSnap Logo" style="max-width:120px; border-radius:12px;">
      </div>

      <!-- TITLE -->
      <h1 style="color: #0056b3; font-size: 30px; text-align: center; margin-bottom: 16px;">
        🎉 Welcome, ${name}!
      </h1>

      <!-- SEPARATOR -->
      <hr style="border: none; border-top: 1px solid #cce6ff; margin: 24px 0;">

      <!-- MAIN INTRO -->
      <p style="color: #333; font-size: 18px; text-align: center; line-height: 1.8; margin: 0 0 20px;">
        We’re thrilled to have you at <strong>BugSnap</strong> 💙  
        Your journey with us starts today — where bug tracking becomes simple, smart, and stress-free.
      </p>

      <!-- BODY MESSAGE -->
      <p style="color: #555; font-size: 16px; text-align: center; margin: 0 0 24px;">
        BugSnap helps you capture, report, and resolve bugs faster.  
        Whether you're a developer, tester, or part of a team, we make it effortless to stay on top of issues.
      </p>

      <!-- CALL TO ACTION -->
      <div style="text-align: center; margin: 28px 0;">
        <a href="${loginURL}" style="
          display: inline-block; 
          padding: 14px 28px; 
          font-size: 16px; 
          font-weight: bold; 
          color: #fff; 
          background: linear-gradient(90deg, #007bff, #0056b3); 
          border-radius: 12px; 
          text-decoration: none; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
          transition: all 0.3s ease;
        ">
          🚀 Get Started with BugSnap
        </a>
      </div>

      <!-- QUOTE / VISION -->
      <blockquote style="font-style: italic; color: #666; text-align: center; font-size: 15px; margin: 20px 0 32px;">
        "Our mission is to help teams squash bugs faster and build amazing products together."  
        — The BugSnap Team
      </blockquote>

      <!-- WHY THIS EMAIL -->
      <div style="
        background: #f9fcff; 
        border: 1px solid #e0efff; 
        border-radius: 12px; 
        padding: 18px; 
        margin-bottom: 28px;
        font-size: 14px;
        color: #444;
      ">
        <strong>📩 Why am I receiving this email?</strong><br>
        You signed up on <strong>BugSnap</strong> to explore our bug tracking platform.  
        This is your official welcome email and guide to get started.
      </div>

      <!-- SUPPORT -->
      <p style="color: #888; font-size: 14px; text-align: center; margin: 0 0 24px;">
        Need help? Just reply to this email — we’re always here for you. 💬  
        Or visit our <a href="https://bugsnap.io/support" style="color:#007bff; text-decoration:none;">Help Center</a>.
      </p>

      <!-- SIGNATURE -->
      <p style="color: #444; font-size: 15px; text-align: center; margin-top: 20px;">
        — With love,<br>
        <strong>The BugSnap Team 💙</strong>
      </p>

      <!-- FOOTER -->
      <hr style="border: none; border-top: 1px solid #e0e6f1; margin: 30px 0;">
      <p style="font-size: 12px; color: #999; text-align: center; line-height: 1.5;">
        You are receiving this email because you created an account on <strong>BugSnap</strong>.<br>
        If this wasn’t you, you can safely ignore this message.  
        <br><br>
        © ${new Date().getFullYear()} BugSnap. All rights reserved.
      </p>

    </div>
  </body>
</html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    // console.log("✅ Email sent:", info.messageId);
  } catch (error) {
    // console.error("❌ Error sending email:", error);
    throw new Error("Email failed to send");
  }
};

const handleUserSignup = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const user = await USER.create({ name: name, email: email, password: password });

    const loginURL = `${process.env.FRONTEND_URL_MAIN}login`;
    // console.log("email: "+email+" name: "+name+" signupURL: "+loginURL);
    await sendmailForSignup({ to: email, name, loginURL });

     // Generate JWT tokens
  const accessToken = generateAccessToken({ id: user._id });
  const refreshToken = generateRefreshToken({ id: user._id });

  // Set tokens in cookies
  setTokenCookie(res, { accessToken, refreshToken });
  // const encodedName = encodeURIComponent(name);
  // const encodedEmail = encodeURIComponent(user.email);

  const userData = JSON.stringify({ name: name, email: email }); 
 // const encrypted = encrypt(userData);
  // console.log("User data to encrypt:", userData);
   // Instead of res.redirect
  return res.status(200).json({
    message: "SignUp successful",
    userData
  });
  } catch (error) {
    // console.error("Signup error:", error);
    return res
      .status(500)
      .json({ error: "Something went wrong during signup" });
  }
};

// ==========================================
// =========== Handle User Login ============
// ==========================================

/**
 * Logs in a user
 * - Validates credentials
 * - Generates JWT access & refresh tokens
 * - Stores tokens in secure HTTP-only cookies
 * - Supports both API and HTML form login
 */
const handleUserLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await USER.findOne({ email });

    if (!user) {
      return res.status(401).json({ error: "Invalid email" });
    }

    if (!user.password) {
      return res.status(400).json({ error: "This account has no password. Please login via OAuth." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const accessToken = generateAccessToken({ id: user._id });
    const refreshToken = generateRefreshToken({ id: user._id });

    setTokenCookie(res, { accessToken, refreshToken });

    const userData = JSON.stringify({ name: user.name, email: user.email });
    const encrypted = encrypt(userData);

    return res.status(200).json({
      message: "Login successful",
      encrypted
    });
  } catch (err) {
    // console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};


// ==========================================================
// =============== Send Reset Link Email ====================
// ==========================================================
const sendEmail = async ({ to, resetLink }) => {
  try {

    const mailOptions = {
      from: `Localhost ${process.env.PORT} <${process.env.EMAIL_USER}>`,
      to,
      subject: "Reset Your Password",
      html: `
        <div style="max-width: 600px; margin: auto; padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9; border-radius: 10px; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center;">
            <h2 style="color: #2d3748;">🔐 Password Reset Request</h2>
          </div>
          <p style="color: #4a5568; font-size: 16px;">
            We received a request to reset your password. If this was you, click the button below to proceed.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="padding: 12px 24px; background-color: #3182ce; color: white; text-decoration: none; border-radius: 6px; font-size: 16px;">
              Reset Password
            </a>
          </div>
          <p style="color: #718096; font-size: 14px;">
            This link is valid for <strong>15 minutes</strong>. If you didn’t request this, please ignore this email.
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;" />
          <p style="text-align: center; font-size: 12px; color: #a0aec0;">
            © ${new Date().getFullYear()} Localhost ${
        process.env.PORT
      }. All rights reserved.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    // console.log("Email sent:", info.messageId);
  } catch (error) {
    // console.error("Error sending email:", error);
    throw new Error("Email failed to send");
  }
};

// ===========================================================
// =============== Handle Forgot Password ====================
// ===========================================================
const handelForgotPassword = async (req, res) => {
  const { email } = req.body;

   
  // Check if email exists in DB
  const user = await USER.findOne({ email });

  // console.log("User found for password reset:", user);
  if (!user) {
    if (req.is("application/json")) {
      return res.status(401).json({ error: "Invalid email" });
    } else {
      return res.render("login", { error: "Invalid email" });
    }
  }

  // Generate token & hashed token
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  // Save token to DB
  await restToken.create({
    email,
    resetToken: tokenHash,
    resetTokenExpiry: new Date(Date.now() + 15 * 60 * 1000), // 15 mins expiry
  });

  const resetLink = `${FRONTEND_URL_MAIN}/resetPassword?token=${token}`;

  await sendEmail({ to: email, resetLink });

  // console.log("Reset email sent");
  return res.status(200).json({ message: "Reset email sent" });
};

// ===========================================================
// =============== Handle Reset Password =====================
// ===========================================================

const handleResetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Basic validation
    if (!token) {
      return res.status(400).json({ message: "Missing token" });
    }
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // Hash incoming token for safe DB comparison
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find matching, non-expired token entry
    const tokenEntry = await restToken.findOne({
      resetToken: hashedToken,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!tokenEntry) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Find the user by the email stored on the token doc
    const user = await USER.findOne({ email: tokenEntry.email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Hash the new password and save it
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    user.password = hashedPassword;
    await user.save();

    // Invalidate all reset tokens for this email (single-use)
    await restToken.deleteMany({ email: tokenEntry.email });

    // Return JSON success response (no redirects)
    return res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    // console.error("handleResetPassword error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


// ==========================================
// ================ Logout ==================
// ==========================================

/**
 * Clears authentication cookies to logout user
 */
const handleLogout = (req, res) => {
  res.clearCookie("refreshToken");
  res.clearCookie("accessToken");
  res.status(200).json({ message: "Logged out" });
};


/**
 * Get current user info and tokens
 * - Used for OAuth users to get tokens for localStorage
 */
const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await USER.findById(userId).select('-password -__v');
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Generate fresh tokens
    const accessToken = generateAccessToken({ id: user._id });
    const refreshToken = generateRefreshToken({ id: user._id });

    // Also update cookies with fresh tokens
    setTokenCookie(res, { accessToken, refreshToken });

    return res.status(200).json({
      message: "User info retrieved successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        image: user.image
      }
    });
  } catch (err) {
    // console.error("Get current user error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};


// ==========================================
// ============ Module Exports ==============
// ==========================================
module.exports = {
  handleUserSignup,
  handleUserLogin,
  handleLogout,
  handelForgotPassword,
  handleResetPassword,
  getCurrentUser,
};
