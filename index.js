// ==============================
// Core Dependencies & Libraries
// ==============================
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const swaggerJS = require("swagger-jsdoc");
const swaggerUI = require("swagger-ui-express");
require("dotenv").config(); 

// ==============================
// Models & Utility Imports
// ==============================
const User = require("./model/user");
const connectMongoDb = require("./connection");



// ==============================
// Middlewares
// ==============================
const { logReqRes, checkAuthentication, restrictTo } = require("./middleware"); // Logging, auth checks
const { checkTeamMembership,checkTeamAdmin,checkBugTeamMatch} = require("./middleware/teamMiddleware");
const isError = require("./middleware/error"); // Global error handler



// ==============================
// Routers
// ==============================
const userRouter = require("./routes/user");        // Signup, Login, Logout, Password Reset
const authRouter = require("./routes/authRouter");  // OAuth: Google, GitHub login
const teamRouter = require("./routes/team");        // Team management routes (protected
const bugRouter = require("./routes/bug");          // Bug tracking routes (protected)
const mediaRouter = require("./routes/media");
const commentRouter = require("./routes/comment");
const peopleRouter = require("./routes/people");
const { title } = require("process");


// ==============================
// App Initialization
// ==============================
const app = express();
const PORT = process.env.PORT || 3000;
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: "BugSnap BackEnd API",
      version: "1.0.0",
    },
    servers: [
      {
        url: 'http://localhost:8019',
      },
    ],
  },
  apis: ['./routes/*.js'], // scan all route files
};

// Generate Swagger spec
const swaggerSpec = swaggerJS(options);

// Mount Swagger UI
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerSpec));


// ==============================
// Middleware Setup
// ==============================

// Cookie parser for reading cookies from requests
app.use(cookieParser());

// Body parsers for JSON and URL-encoded data
app.use(express.json());                          // Parse application/json
app.use(express.urlencoded({ extended: false })); // Parse application/x-www-form-urlencoded



// CORS setup to allow frontend access (adjust origin in production)
app.use(cors({
  origin: "http://localhost:5173", // Frontend URL (change in production)
  credentials: true               // Allow cookies to be sent
}));



// ==============================
// View Engine Setup (Optional HTML Rendering)
// ==============================
app.set("view engine", "ejs");
app.set("views", path.resolve("./view")); // Set views directory



// ==============================
// Request Logging Middleware
// ==============================
app.use(logReqRes("log.txt")); // Log all requests/responses to log.txt



// ==============================
// MongoDB Connection
// ==============================
connectMongoDb("mongodb://127.0.0.1:27017/BugSnap")
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));



// ==============================
// Public and Protected Routes
// ==============================

const knowWhichRoute = (req, res, next) => {
  console.log("In knowWhichRoute middleware");
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next(); // important to pass control to the next middleware or route
};
app.use("/user", userRouter);               // Public: Signup, Login, Logout, Password Reset
app.use("/auth", authRouter);               // Public: Google/GitHub OAuth
app.use("/team",knowWhichRoute,checkAuthentication,teamRouter); // Protected: Team management routes
app.use("/bug",knowWhichRoute,checkAuthentication, bugRouter); // Protected: Bug tracking routes 
app.use("/media", checkAuthentication, mediaRouter);
app.use("/comment",checkAuthentication,knowWhichRoute,commentRouter);
app.use("/people",knowWhichRoute,checkAuthentication,knowWhichRoute,peopleRouter);



// ==============================
// Logout Route (Clears Cookies)
// ==============================
app.post("/api/logout", (req, res) => {
  
  //console.log("🔒 Logout request received");

  // Clear refreshToken cookie
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: false, // Set to true with HTTPS in production
    sameSite: "lax",
  });

  // Clear accessToken cookie
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });

  return res.status(200).json({ message: "Logged out successfully" });
});



// ==============================
// Error Handling Middleware (Always Last)
// ==============================
app.use(isError); 



// ==============================
// Start the Server
// ==============================
app.listen(PORT, () => {
  console.log(`🚀 Server started on http://localhost:${PORT}`);
});
