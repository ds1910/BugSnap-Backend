const mongoose = require("mongoose");
const Bug = require("../model/bug");
const Team = require("../model/team");
const logActivity = require("../utils/logActivity");
const applyQueryFeatures = require("../utils/queryUtils");
const User = require("../model/user");
/**
 * Utility: Validate team and membership
 */
const getTeamAndCheckMembership = async (teamId, userId) => {
  if (!teamId || !mongoose.Types.ObjectId.isValid(teamId)) {
    throw new Error("Invalid or missing teamId");
  }

  const team = await Team.findById(teamId);
  if (!team) throw new Error("Team not found");

  const member = team.members.find(
    (m) => m.user.toString() === userId.toString()
  );
  if (!member) throw new Error("You are not a member of this team");

  return { team, member };
};

const checkIfAdminInTeam = (member) => {
  if (member.role !== "admin") {
    throw new Error("Only team admins can perform this action.");
  }
};

/**
 * Create a new bug (Admin only)
 */
const handleCreateBug = async (req, res) => {
  //  console.log("Create Bug Request:", req.body);

  const {
    title,
    tags = [],
    status = "open",
    teamId,
    priority = "medium",
    startDate,
    dueDate,
    assignee, // expected as {id, name, email, role}
  } = req.body;

  const createdBy = req.user?.id || req.body?.createdBy;

  if (!title || !teamId) {
    return res.status(400).json({ error: "Title and teamId are required." });
  }

  try {
    // ✅ Check membership + admin
    const { team, member } = await getTeamAndCheckMembership(teamId, createdBy);
    checkIfAdminInTeam(member);

    // ✅ Ensure unique bug title in team
    const existingBug = await Bug.findOne({ title, teamId });
    if (existingBug) {
      return res
        .status(400)
        .json({ error: "Bug with this title already exists in the team." });
    }

    // ✅ Handle assignee
    let assignedTo = [];
    if (assignee && assignee.name) {
      const userDoc = await User.findOne({
        $or: [{ name: assignee.name }, { email: assignee.email }],
      }).lean();

      if (!userDoc) {
        return res
          .status(404)
          .json({ error: `Assignee '${assignee.name}' not found.` });
      }

      assignedTo = [userDoc._id]; // push into array
    }

    // ✅ Create bug
    const bug = await Bug.create({
      title,
      tags,
      status,
      teamId,
      priority,
      createdBy,
      startDate,
      dueDate,
      assignedTo,
      history: [
        {
          action: "created",
          detail: "Bug created by user",
          performedBy: createdBy,
        },
      ],
    });

    //    console.log("Created Bug:", bug);

    // ✅ Log activity
    await logActivity({
      userId: createdBy,
      bugId: bug._id,
      action: "Bug Created",
      details: "New bug created by admin of team",
    });

    return res.status(201).json({ message: "Bug created", bug });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
};

/**
 * Fetch all bugs for a specific team (Any member)
 */
const handleGetAllBugsForTeam = async (req, res) => {
  const teamId = req.query.teamId;
  const userId = req.user.id;
 
   console.log(req.body);
    
  try {
    // Check team & membership
    const { team } = await getTeamAndCheckMembership(teamId, userId);

    // Find all bugs for that team
    const bugs = await Bug.find({ teamId: team._id }).lean();
    console.log(bugs);

    // Attach assigned user name for each bug
    const bugsWithAssignee = await Promise.all(
      bugs.map(async (bug) => {
        if (bug.assignedTo) {
          const assignedUser = await User.findById(bug.assignedTo).lean();
          return {
            ...bug,
            assignedName: assignedUser ? assignedUser.name : null,
          };
        }
        return {
          ...bug,
          assignedName: null,
        };
      })
    );

    //   console.log(bugsWithAssignee);
    return res.status(200).json(bugsWithAssignee);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};
/**
 * Fetch specific bug by ID (Creator or assigned user only)
 */
const handleGetBugById = async (req, res) => {
  const bugId = req.query.bugId || req.params.bugId;
  const userId = req.user.id;

  try {
    if (!bugId || !mongoose.Types.ObjectId.isValid(bugId)) {
      return res.status(400).json({ error: "Invalid or missing bugId." });
    }

    const bug = await Bug.findById(bugId);
    if (!bug) return res.status(404).json({ error: "Bug not found." });

    const isCreator = bug.createdBy.toString() === userId;
    const isAssigned = bug.assignedTo.some((id) => id.toString() === userId);

    if (!isCreator && !isAssigned) {
      return res
        .status(403)
        .json({ error: "You are not authorized to view this bug." });
    }

    return res.status(200).json({ bug });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

/**
 * Update bug by ID (Creator or assigned user only)
 */



const handleUpdateBugById = async (req, res) => {
  const teamId = req.query.teamId;
  const userId = req.user.id;

  try {
    // Ensure team exists and user is a member (your helper should throw if not allowed)
    const { team } = await getTeamAndCheckMembership(teamId, userId);

    // Find all bugs for that team (lean for performance)
    const bugs = await Bug.find({ teamId: team._id }).lean();

    // Normalize and collect all assigned IDs across bugs to batch-query users
    const collectAssignedIds = new Set();
    const normalizeToIdArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val.map(String).filter(Boolean);
      return [String(val)];
    };

    for (const b of bugs) {
      const ids = normalizeToIdArray(b.assignedTo);
      for (const id of ids) {
        if (mongoose.Types.ObjectId.isValid(id)) collectAssignedIds.add(id);
      }
    }

    // Batch fetch users (only if there are ids)
    const userMap = new Map();
    if (collectAssignedIds.size > 0) {
      const users = await User.find({ _id: { $in: Array.from(collectAssignedIds) } })
        .select("name displayName fullName username email")
        .lean();
      users.forEach((u) => {
        const name = u.name || u.displayName || u.fullName || u.username || u.email || null;
        userMap.set(String(u._id), { id: String(u._id), name });
      });
    }

    // Build a quick lookup map for team.members if they include names locally
    const teamMemberMap = new Map();
    if (team?.members && Array.isArray(team.members)) {
      for (const m of team.members) {
        const uid = m?.user ? String(m.user) : null;
        if (!uid) continue;
        const name = m.name || m.displayName || m.fullName || m.username || m.email || null;
        teamMemberMap.set(uid, { id: uid, name });
      }
    }

    // Helper to build assigned array preserving order
    const buildAssignedForBug = (assignedToRaw) => {
      const ids = normalizeToIdArray(assignedToRaw);
      const assignedArr = ids.map((id) => {
        if (!mongoose.Types.ObjectId.isValid(id)) return { id: String(id), name: null };
        // prefer team member info, then userMap, then null
        if (teamMemberMap.has(String(id))) return teamMemberMap.get(String(id));
        if (userMap.has(String(id))) return userMap.get(String(id));
        return { id: String(id), name: null };
      });
      return assignedArr;
    };

    // Build response list
    const bugsWithAssignee = bugs.map((b) => {
      const assigned = buildAssignedForBug(b.assignedTo || []);
      const assignedName = assigned.length === 0 ? null : assigned.map((a) => a.name || "").filter(Boolean).join(", ") || null;
      return {
        ...b,
        assigned, // [{ id, name }, ...]
        assignedName, // "Alice, Bob" or null
      };
    });

    return res.status(200).json(bugsWithAssignee);
  } catch (err) {
    console.error("Error in handleGetAllBugsForTeam:", err);
    return res.status(400).json({ error: err.message || "Failed to fetch bugs" });
  }
};

/**
 * Delete bug by ID (Admin only)
 */
const handleDeleteBugById = async (req, res) => {
  const bugId = req.query.bugId || req.params.bugId;
  const userId = req.user.id;

  try {
    if (!bugId || !mongoose.Types.ObjectId.isValid(bugId)) {
      return res.status(400).json({ error: "Invalid or missing bugId." });
    }

    const bug = await Bug.findById(bugId);
    if (!bug) return res.status(404).json({ error: "Bug not found." });

    const { team, member } = await getTeamAndCheckMembership(
      bug.teamId,
      userId
    );
    checkIfAdminInTeam(member);

    await logActivity({
      userId,
      bugId: bug._id,
      action: "Bug Deleted",
      details: "Bug deleted by admin of team",
    });

    await Bug.findByIdAndDelete(bugId);
    return res.status(200).json({ message: "Bug deleted successfully." });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

/**
 * Assign a user to bug (Admin only)
 */
const handleAssignUserToBug = async (req, res) => {
  const { bugId } = req.params;
  const { userId: userToAssign } = req.body;
  const currentUserId = req.user.id;

  try {
    const bug = await Bug.findById(bugId);
    if (!bug) return res.status(404).json({ error: "Bug not found." });

    const { team, member } = await getTeamAndCheckMembership(
      bug.teamId,
      currentUserId
    );
    checkIfAdminInTeam(member);

    const targetMember = team.members.find(
      (m) => m.user.toString() === userToAssign
    );
    if (!targetMember) {
      return res
        .status(400)
        .json({ error: "User to assign is not in the team." });
    }

    if (bug.assignedTo.includes(userToAssign)) {
      return res
        .status(400)
        .json({ error: "User already assigned to this bug." });
    }

    bug.assignedTo.push(userToAssign);
    await bug.save();

    await logActivity({
      userId: currentUserId,
      bugId: bug._id,
      action: "Bug Assigned",
      details: `Bug assigned to ${targetMember.name} by ${req.user.name}`,
    });

    return res
      .status(200)
      .json({ message: "User assigned successfully.", bug });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

/**
 * Fetch all bugs assigned to logged-in user
 */
const getAllAssignedBugs = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await applyQueryFeatures(Bug, req.query, {
      assignedTo: userId,
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

module.exports = {
  handleCreateBug,
  handleGetAllBugsForTeam,
  handleGetBugById,
  handleUpdateBugById,
  handleDeleteBugById,
  handleAssignUserToBug,
  getAllAssignedBugs,
};
