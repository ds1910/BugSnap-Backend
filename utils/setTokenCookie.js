/**
 * Utility function to set secure HTTP-only cookies for access and/or refresh tokens.
 * Can be reused in multiple routes (e.g., login, OAuth callback, token refresh).
 * 
 * Supports flexible usage: pass only accessToken, only refreshToken, or both.
 */

const setTokenCookie = (res, { refreshToken = null, accessToken = null }) => {
  
  // ------------------- Set Refresh Token Cookie ------------------- //
  if (refreshToken) {
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,           // Prevents JavaScript access to this cookie (mitigates XSS attacks)
      secure: false,            // Set to true in production (HTTPS required)
      sameSite: "lax",          // Prevents CSRF for most typical requests (GET, POST forms)
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });
  }

  // ------------------- Set Access Token Cookie ------------------- //
  if (accessToken) {
    res.cookie("accessToken", accessToken, {
      httpOnly: true,           // Protects cookie from being read via client-side scripts
      secure: false,            // Enable true in production to ensure HTTPS-only cookie
      sameSite: "lax",          // Allows normal navigation while protecting against CSRF
      maxAge: 15 * 60 * 1000,   // 15 minutes in milliseconds (short-lived session)
    });
  }
};

module.exports = setTokenCookie;
