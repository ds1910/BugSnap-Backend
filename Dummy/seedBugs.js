const mongoose = require("mongoose");
const Bug = require("../model/bug");

// ✅ Load bugs data
const bugs = require("./bugs.json"); // or "./bugs.js" if you used JS export

mongoose
  .connect("mongodb://127.0.0.1:27017/BugSnap")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

async function seedBugs() {
  try {
    // 🧹 Clear old bugs
    await Bug.deleteMany({});
    console.log("🧹 Old bugs cleared");

    // 🔹 Remove _id so Mongo auto-generates ObjectId
    const cleanedBugs = bugs.map(({ _id, ...rest }) => rest);

    // 🚀 Insert into DB
    await Bug.insertMany(cleanedBugs);
    console.log(`✅ Inserted ${cleanedBugs.length} bugs from file!`);
  } catch (err) {
    console.error("❌ Error seeding bugs:", err);
  } finally {
    mongoose.connection.close();
  }
}

seedBugs();
