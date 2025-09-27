const mongoose = require("mongoose");
const fs = require("fs");

// Import User model
const User = require("../model/user");

// MongoDB connection
mongoose.connect("mongodb://127.0.0.1:27017/BugSnap", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function seedUsers() {
  try {
    // Read dummy users
    const rawData = fs.readFileSync("users.json", "utf-8");
    const usersData = JSON.parse(rawData);

    // Clear old users
    await User.deleteMany({});
    console.log("Old users cleared ✅");

    // Insert new users
    const users = await User.insertMany(usersData);
    console.log(`Inserted ${users.length} users ✅`);

    console.log("🌱 User seeding done!");
    process.exit();
  } catch (error) {
    console.error("❌ Error seeding users:", error);
    process.exit(1);
  }
}

seedUsers();
