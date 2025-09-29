require("dotenv").config();
const nodemailer = require("nodemailer");

// Create a transporter object using SMTP transport
// The transporter is what we'll use to send emails
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com", // Gmail SMTP server
  port: 587,              // Port 587 is used for TLS (secure) connections
  secure: false,          // false because we are using TLS, not SSL
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS, 
  },
});

module.exports = { transporter };
