const mongoose = require('mongoose');

const resetTokenSchema = new mongoose.Schema({
  email: String,
  resetToken : String,
  resetTokenExpiry : Date
});

const restToken = mongoose.model("resetToken", resetTokenSchema);
module.exports = restToken;
