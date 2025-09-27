const mongoose = require("mongoose");
const User = require("../model/user");
const Team = require("../model/team");

mongoose.connect("mongodb://127.0.0.1:27017/BugSnap")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error(err));

async function seedTeams() {
  try {
    // Clear old teams
    await Team.deleteMany({});
    console.log("Old teams cleared ✅");

    // Fetch all users
    const allUsers = await User.find();
    if (allUsers.length === 0) {
      console.log("⚠️ No users found. Run user seeder first.");
      return;
    }

    const teams = [];
    for (let i = 0; i < 10; i++) {
      const teamSize = Math.floor(Math.random() * 4) + 2; // 2-5 members
      const shuffled = [...allUsers].sort(() => 0.5 - Math.random());
      const members = shuffled.slice(0, teamSize);

      // 1-2 admins
      const adminCount = Math.floor(Math.random() * 2) + 1;
      const admins = members.slice(0, adminCount);

      // Create member objects with roles
      const membersData = members.map(u => ({
        user: u._id,
        role: admins.includes(u) ? "admin" : "member"
      }));

      // Use first admin as createdBy
      const createdBy = admins[0]._id;

      const team = new Team({
        name: `Team ${i + 1}`,
        description: `This is ${i + 1} team for project collaboration.`,
        members: membersData,
        admins: admins.map(u => u._id),
        createdBy
      });

      teams.push(team);
    }

    await Team.insertMany(teams);
    console.log("✅ Inserted 10 teams!");
  } catch (err) {
    console.error("❌ Error seeding teams:", err);
  } finally {
    mongoose.connection.close();
  }
}

seedTeams();
