const mongoose = require("mongoose");
const Bug = require("../model/bug");
const Team = require("../model/team");
const logActivity = require("../utils/logActivity");
const applyQueryFeatures = require("../utils/queryUtils");
const User = require("../model/user");

/**
 * Utility: Validate team existence and check if a user is part of that team
 * - Throws error if team does not exist or user is not a member
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

/**
 * Utility: Ensure that the user is an admin in the team
 */
const checkIfAdminInTeam = (member) => {
  if (member.role !== "admin") {
    throw new Error("Only team admins can perform this action.");
  }
};

/**
 * Create a new bug
 * - Ensures unique bug title per team
 * - Allows optional assignment to a team user
 * - Logs activity on success
 */
const handleCreateBug = async (req, res) => {
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
    // Validate membership & admin rights
    const { team, member } = await getTeamAndCheckMembership(teamId, createdBy);
    // checkIfAdminInTeam(member);

    // Prevent duplicate bug titles inside the same team
    const existingBug = await Bug.findOne({ title, teamId });
    if (existingBug) {
      return res
        .status(400)
        .json({ error: "Bug with this title already exists in the team." });
    }

    // Assign user if provided and valid
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
      assignedTo = [userDoc._id];
    }
    const user = await User.findById(createdBy, "name").lean();
    const username = user?.name;

    // Create the bug record
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
    });

    // Log activity for auditing
    await logActivity({
      userId: createdBy,
      bugId: bug._id,
      action: "Bug Created",
      details: `New bug created by ${username}`,
    });

    return res.status(201).json({ message: "Bug created", bug });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
};

/**
 * Get all bugs for a team (Any member can view)
 * - Validates membership
 * - Fetches bugs for the team
 * - Attaches assignee name for readability
 */
const handleGetAllBugsForTeam = async (req, res) => {
  const teamId = req.query.teamId;
  const userId = req.user.id;

  try {
    const { team } = await getTeamAndCheckMembership(teamId, userId);
    const bugs = await Bug.find({ teamId: team._id }).lean();

    // Resolve assigned user names
    const bugsWithAssignee = await Promise.all(
      bugs.map(async (bug) => {
        if (bug.assignedTo) {
          const assignedUser = await User.findById(bug.assignedTo).lean();
          return {
            ...bug,
            assignedName: assignedUser ? assignedUser.name : null,
          };
        }
        return { ...bug, assignedName: null };
      })
    );

    return res.status(200).json(bugsWithAssignee);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

/**
 *   Get a specific bug by ID
 * - Only creator or assigned users can view
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
 * Update a bug by ID, return enriched bug info, and log activity.
 */
const handleUpdateBugById = async (req, res) => {
  const teamId = req.query.teamId;
  const userId = req.user.id;
  const bugId = req.params.id;
  const updates = req.body; // fields to update

  try {
    // 1. Validate team membership
    const { team } = await getTeamAndCheckMembership(teamId, userId);

    // 2. Ensure bug belongs to this team
    const bug = await Bug.findOne({ _id: bugId, teamId: team._id });
    if (!bug) {
      return res.status(404).json({ error: "Bug not found in this team" });
    }

    // 3. Apply updates
    Object.assign(bug, updates);
    await bug.save();

    // 4. Populate assigned users (optional enrichment)
    const assignedIds = Array.isArray(bug.assignedTo)
      ? bug.assignedTo
      : bug.assignedTo
      ? [bug.assignedTo]
      : [];

    const users = await User.find({ _id: { $in: assignedIds } })
      .select("name displayName fullName username email")
      .lean();

    const assigned = users.map((u) => ({
      id: String(u._id),
      name:
        u.name || u.displayName || u.fullName || u.username || u.email || null,
    }));

    const assignedName =
      assigned.length === 0
        ? null
        : assigned.map((a) => a.name || "").filter(Boolean).join(", ") || null;

    const bugWithAssignee = {
      ...bug.toObject(),
      assigned,
      assignedName,
    };

    // 5. Log activity
    const user = await User.findById(userId).select("name email username").lean();
    const username = user?.name || user?.username || user?.email || "Unknown";

    await logActivity({
      userId,
      bugId: bug._id,
      action: "Bug Updated",
      details: `${bug.title} was updated by ${username}`,
    });

    // 6. Return response
    return res.status(200).json(bugWithAssignee);
  } catch (err) {
    console.error("Error in updateBugById:", err);
    return res.status(400).json({ error: err.message || "Failed to update bug" });
  }
};


/**
 * Delete a bug by ID (Admin only)
 * - Only admins of the bug’s team can delete
 * - Logs deletion activity
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

    // Log activity
    const user = await User.findById(userId).select("name email username").lean();
    const username = user?.name || user?.username || user?.email || "Unknown";

    await logActivity({
      userId,
      bugId: bug._id,
      action: "Bug Deleted",
      details: `${bug.title} was deleted by ${username}`,
    });

    await Bug.findByIdAndDelete(bugId);
    return res.status(200).json({ message: "Bug deleted successfully." });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

/**
 * Assign a team user to a bug (Admin only)
 * - Validates target user is in team
 * - Prevents duplicate assignments
 * - Logs activity
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
 * Fetch all bugs assigned to the logged-in user
 * - Uses query utils to allow pagination/sorting/filtering
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
