// seedCommentsFromFile.js
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const Comment = require("../model/comment");
const Bug = require("../model/bug");
const Team = require("../model/team");
const User = require("../model/user");

const COMMENTS_FILE = path.join(__dirname, "comments.json");
const MONGO = "mongodb://127.0.0.1:27017/BugSnap";

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id));
}

async function readCommentsFile() {
  if (!fs.existsSync(COMMENTS_FILE)) throw new Error(`${COMMENTS_FILE} not found`);
  return JSON.parse(fs.readFileSync(COMMENTS_FILE, "utf8"));
}

async function pickRandomBug() {
  // pick a random bug from DB
  const [b] = await Bug.aggregate([{ $sample: { size: 1 } }]);
  return b || null;
}

async function pickRandomMemberOfTeam(teamId) {
  const team = await Team.findById(teamId).populate("members.user");
  if (!team || !team.members?.length) return null;
  const members = team.members.map(m => m.user).filter(Boolean);
  return members[Math.floor(Math.random() * members.length)] || null;
}

async function ensureValidRefs(comment) {
  // Returns an object with valid: { bugId, teamId, createdBy }
  let bugId = comment.bugId;
  let teamId = comment.teamId;
  let createdBy = comment.createdBy;

  // If bugId invalid or not found, pick a random DB bug and use it.
  if (!isValidObjectId(bugId) || !(await Bug.exists({ _id: bugId }))) {
    const randomBug = await pickRandomBug();
    if (!randomBug) throw new Error("No bugs in DB — seed bugs first.");
    bugId = randomBug._id;
    teamId = String(randomBug.teamId);
  } else {
    // Bug exists; ensure teamId matches bug.teamId if possible
    const dbBug = await Bug.findById(bugId).lean();
    if (dbBug && dbBug.teamId) teamId = String(dbBug.teamId);
  }

  // Validate teamId; if invalid or not found, try to read team from bug, otherwise pick team from DB
  if (!isValidObjectId(teamId) || !(await Team.exists({ _id: teamId }))) {
    // try to use the bug's teamId (if we have bugId)
    const dbBug = await Bug.findById(bugId).lean();
    if (dbBug && dbBug.teamId && (await Team.exists({ _id: dbBug.teamId }))) {
      teamId = String(dbBug.teamId);
    } else {
      // fallback: pick random team that has members
      const team = await Team.aggregate([
        { $match: { "members.0": { $exists: true } } },
        { $sample: { size: 1 } }
      ]);
      if (team && team[0]) teamId = String(team[0]._id);
    }
  }

  // Validate createdBy; if invalid or not found, pick random member of team
  if (!isValidObjectId(createdBy) || !(await User.exists({ _id: createdBy }))) {
    const member = await pickRandomMemberOfTeam(teamId);
    if (!member) {
      // fallback: pick any random user in DB
      const someUser = await User.aggregate([{ $sample: { size: 1 } }]);
      createdBy = someUser && someUser[0] ? String(someUser[0]._id) : null;
    } else {
      createdBy = String(member._id || member);
    }
  }

  return { bugId: String(bugId), teamId: String(teamId), createdBy: String(createdBy) };
}

async function seed() {
  await mongoose.connect(MONGO, {});

  console.log("✅ MongoDB connected");

  try {
    const raw = await readCommentsFile();
    console.log(`Loaded ${raw.length} comments from file`);

    // Clear existing comments first
    await Comment.deleteMany({});
    console.log("🧹 Old comments cleared");

    // split top-level vs replies
    const topLevel = raw.filter(c => !c.parentComment);
    const replies = raw.filter(c => c.parentComment);

    // mapping original comment _id (from file) -> new inserted ObjectId
    const idMap = new Map();

    let insertedCount = 0;
    let skipped = 0;

    // Insert top-level comments one by one to capture mapping
    for (const c of topLevel) {
      try {
        // Prepare valid refs (bug/team/user). This will substitute if values in file are invalid.
        const refs = await ensureValidRefs(c);

        const doc = {
          bugId: refs.bugId,
          teamId: refs.teamId,
          createdBy: refs.createdBy,
          parentComment: null,
          text: c.text || "",
        };

        // timestamps
        if (c.createdAt) doc.createdAt = new Date(c.createdAt);
        if (c.updatedAt) doc.updatedAt = new Date(c.updatedAt);

        // Create comment and record mapping from original id -> new id
        const created = await Comment.create(doc);
        if (c._id) idMap.set(String(c._id), String(created._id));
        insertedCount++;
      } catch (err) {
        skipped++;
        console.warn("Skipped top-level comment due to error:", err.message || err);
      }
    }

    // Insert replies, mapping parentComment using idMap
    for (const r of replies) {
      try {
        // parent may be missing in mapping => set to null
        const origParent = String(r.parentComment);
        const mappedParent = idMap.has(origParent) ? idMap.get(origParent) : null;

        // If the reply's bugId/teamId/createdBy are invalid, ensureValidRefs will pick valid refs (and keep data coherent)
        const refs = await ensureValidRefs(r);

        const doc = {
          bugId: refs.bugId,
          teamId: refs.teamId,
          createdBy: refs.createdBy,
          parentComment: mappedParent,
          text: r.text || "",
        };

        if (r.createdAt) doc.createdAt = new Date(r.createdAt);
        if (r.updatedAt) doc.updatedAt = new Date(r.updatedAt);

        const created = await Comment.create(doc);

        // store mapping for nested replies (if some replies reply-to replies)
        if (r._id) idMap.set(String(r._id), String(created._id));

        insertedCount++;
      } catch (err) {
        skipped++;
        console.warn("Skipped reply due to error:", err.message || err);
      }
    }

    console.log(`✅ Inserted ${insertedCount} comments (skipped ${skipped})`);
  } catch (err) {
    console.error("❌ Fatal error while seeding comments:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 MongoDB disconnected");
  }
}

seed().catch(e => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
