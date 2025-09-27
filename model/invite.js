// models/invite.js
const mongoose = require("mongoose");

const inviteSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  used: { type: Boolean, default: false },
  usedAt: { type: Date },
  createdAt: { type: Date, default: Date.now, expires: "7d" }, // TTL index auto-expire
});

module.exports = mongoose.model("Invite", inviteSchema);
