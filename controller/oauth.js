const axios = require("axios");
const qs = require("qs"); // Required for form-urlencoded data
const User = require("../model/user");
const encrypt = require("../service/encrypt");
const setTokenCookie = require("../utils/setTokenCookie");
const { autoAcceptInvitations } = require("./people");

const GOOGLE_CLIENT_ID = process.env.Google_Clinet_Id;
const GOOGLE_CLIENT_SECRET = process.env.Google_Clinet_Secret;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const FRONTEND_URL_MAIN = process.env.FRONTEND_URL_MAIN;

const {
  generateAccessToken,
  generateRefreshToken,
} = require("../service/auth");

/* --------------------- REDIRECT USER TO GOOGLE --------------------- */
const handleRedirectToGoogle = (req, res) => {
  const googleAuthURL =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${GOOGLE_REDIRECT_URI}` +
    `&response_type=code` +
    `&scope=openid profile email`;

  res.redirect(googleAuthURL);
};


/* ---------------- GOOGLE LOGIN CALLBACK HANDLER ---------------- */
const handleGoogleLoginCallBack = async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ message: "Authorization code missing" });
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      qs.stringify({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token } = tokenResponse.data;

    // Fetch user info from Google
    const userResponse = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    const { email, name, picture } = userResponse.data;

    // Check if user exists, else create
    let user = await User.findOne({ email });
    let isNewUser = false;
    if (!user) {
      user = await User.create({ name, email, image: picture });
      isNewUser = true;
      // console.log(`Created new user: ${name} (${email})`);
    }

    // Auto-accept any pending invitations for this email
    let acceptedCount = 0;
    if (isNewUser) {
      // console.log(`Checking for pending invitations for new user: ${email}`);
      acceptedCount = await autoAcceptInvitations(email, user._id);
      if (acceptedCount > 0) {
        // console.log(`Auto-accepted ${acceptedCount} invitations for ${email}`);
      }
    }

    // Generate JWT tokens
    const accessToken = generateAccessToken({ id: user._id });
    const refreshToken = generateRefreshToken({ id: user._id });

    // console.log("from oauth: accessToken, refreshToken", accessToken, refreshToken);
    // Set tokens in cookies
      setTokenCookie(res, { accessToken, refreshToken });

    // Encrypt user info for frontend
    const userData = JSON.stringify({
      name: user.name,
      email: user.email,
      // image:user.image,
    });


    // // If you try to pass raw strings (like names, emails) in a URL, certain characters can break the URL or cause errors.
    // const encodedName = encodeURIComponent(user.name);
    // const encodedEmail = encodeURIComponent(user.email);

    const encrypted = encrypt(userData); 
    // console.log("encrypted data", encrypted);
    // console.log("in google login callback", userData);
    // console.log("FRONTEND_URL_MAIN: "+FRONTEND_URL_MAIN);
    
    // Add inviteAccepted parameter if this was a new user with auto-accepted invitations
    let redirectUrl = `${FRONTEND_URL_MAIN}/dashboard/?data=${encodeURIComponent(encrypted)}`;
    if (isNewUser && acceptedCount > 0) {
      redirectUrl += `&inviteAccepted=true`;
      // console.log(`Redirecting with inviteAccepted=true (${acceptedCount} invitations auto-accepted)`);
    }
    
   res.redirect(redirectUrl);

   
  } catch (error) {
    // console.error("Google Login Error:", error.message);
    return res.status(500).json({ message: "Google login failed" });
  }
};

/* --------------------- GITHUB LOGIN INIT --------------------- */
const handleGitHubLogin = (req, res) => {
  const CLIENT_ID = process.env.GITHUB_CLIENT_ID;

  // GitHub will redirect the user to this callback after login
  const redirectUri = process.env.GITHUB_REDIRECT_URI;

  // GitHub OAuth URL with client ID, redirect URI, and scope for email access
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&scope=user:email`;

  // Redirect user to GitHub for authentication
  res.redirect(githubAuthUrl);
};

/* --------------------- GITHUB CALLBACK HANDLER --------------------- */
const handleGitHubCallback = async (req, res) => {
  // Get authorization code from GitHub
  const code = req.query.code;

  if (!code) {
    return res.status(400).send("No code provided");
  }

  try {
    // Exchange code for GitHub access token
    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code,
      },
      { headers: { Accept: "application/json" } }
    );

    const accessTokenforGitHub = tokenRes.data.access_token;

    // Get basic user info from GitHub
    const userRes = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `token ${accessTokenforGitHub}` },
    });

    // Get user's email (GitHub requires separate API call for email)
    const emailRes = await axios.get("https://api.github.com/user/emails", {
      headers: { Authorization: `token ${accessTokenforGitHub}` },
    });

    // Pick primary email or fallback to first email
    const emailObj =
      emailRes.data.find((email) => email.primary) || emailRes.data[0];

    // Check if user exists in DB, create if not
    let dbUser = await User.findOne({ email: emailObj.email });
    if (!dbUser) {
      dbUser = await User.create({
        name: userRes.data.name || userRes.data.login,
        email: emailObj.email,
        // image: userRes.data.avatar_url,
      });
    }

    // console.log("user of github call from backend",dbUser);

    // Generate JWT tokens
    const accessToken = generateAccessToken({ id: dbUser._id });
    const refreshToken = generateRefreshToken({ id: dbUser._id });
  
  
    // Set tokens in cookies
    setTokenCookie(res, { accessToken, refreshToken });

      const userData = JSON.stringify({
      name: dbUser.name,
      email: dbUser.email,
      image:dbUser.image,
    });

    const encodedName = encodeURIComponent(dbUser.name);
    const encodedEmail = encodeURIComponent(dbUser.email);

 
   const encrypted = encrypt(userData); 
   res.redirect(`${FRONTEND_URL_MAIN}/?data=${encodeURIComponent(encrypted)}`);

 
  } catch (error) {
    // console.error("GitHub OAuth error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

module.exports = {
  handleRedirectToGoogle,
  handleGoogleLoginCallBack,
  handleGitHubLogin,
  handleGitHubCallback,
};
