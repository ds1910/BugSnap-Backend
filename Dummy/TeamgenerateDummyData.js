// generateTeams.js
const fs = require("fs");
const mongoose = require("mongoose");
const User = require("../model/user"); // adjust path to your User model
const Team = require("../model/team"); // adjust path to your Team model

// ---------- MongoDB Connection ----------
mongoose.connect("mongodb://127.0.0.1:27017/BugSnap", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// ---------- Team Names & Descriptions ----------
const teamNames = [
  { name: "Frontend Ninjas", description: "Experts in crafting pixel-perfect UI and UX." },
  { name: "Backend Warriors", description: "Masters of scalable APIs and databases." },
  { name: "QA Guardians", description: "Ensuring bug-free, reliable software delivery." },
  { name: "DevOps Avengers", description: "Automating deployments and managing infrastructure." },
  { name: "Mobile Mavericks", description: "Specialists in building high-performing mobile apps." },
  { name: "AI Pioneers", description: "Exploring machine learning and AI-driven features." },
  { name: "Cyber Shield", description: "Focused on security, encryption, and compliance." },
  { name: "Data Dynamos", description: "Handling big data pipelines and analytics." },
  { name: "Cloud Commandos", description: "Managing cloud-native apps and services." },
  { name: "FullStack Force", description: "Versatile developers handling frontend to backend." },
];

// ---------- Helpers ----------
const getRandomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// ---------- Generate Teams ----------
const generateTeams = async () => {
  try {
    const users = await User.find({});
    if (users.length === 0) {
      console.log("❌ No users found. Please generate users first.");
      process.exit(1);
    }

    // Clear old teams
    await Team.deleteMany({});

    const teams = [];

    for (let i = 0; i < 10; i++) {
      const shuffled = [...users].sort(() => 0.5 - Math.random()); // shuffle users
      const adminCount = getRandomInt(2, 5);

      const admins = shuffled.slice(0, adminCount).map((u) => u._id);
      const members = shuffled.slice(adminCount, 15).map((u) => u._id); // ~10-15 per team

      const team = {
        name: teamNames[i].name,
        description: teamNames[i].description,
        createdBy: admins[0], // first admin is creator
        members: [
          ...admins.map((id) => ({ user: id, role: "admin" })),
          ...members.map((id) => ({ user: id, role: "member" })),
        ],
      };

      teams.push(team);
    }

    const inserted = await Team.insertMany(teams);

    // Optional: save JSON copy
    fs.writeFileSync("teams.json", JSON.stringify(inserted, null, 2));

    console.log(`🎉 ${inserted.length} teams generated & saved to DB + teams.json`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error generating teams:", err);
    process.exit(1);
  }
};

generateTeams();
