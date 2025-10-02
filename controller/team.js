const Bug = require("../model/bug");
const Team = require("../model/team");
const User = require("../model/user");

const VALID_ROLES = ["admin", "member"];

// Helper: check membership
const isMember = (team, userId) => {
  return team.members.some((m) => m.user.toString() === userId);
};

/// hello
// Helper: check 
const isAdmin = (team, userId) => {
  const member = team.members.find((m) => m.user.toString() === userId);
  return member && member.role === "admin";
};

// ✅ Create a new team
const createTeam = async (req, res) => {
  try {
    const createdBy = req.user?.id;
    const name = req.body.name;
    const description = req.body.description;
    //    const { name, description = "" } = req.body;
    console.log("in create team")
    console.log(req.body);

    if (!name) {
      return res.status(400).json({ error: "Team name is required." });
    }

    // Prevent duplicate team name by same user
    const existingTeam = await Team.findOne({ name, createdBy });
    if (existingTeam) {
      return res
        .status(400)
        .json({ error: "You already have a team with this name." });
    }

    const team = await Team.create({
      name,
      description,
      createdBy,
      members: [{ user: createdBy, role: "admin" }],
    });

    console.log(team);
    return res.status(201).json({ message: "Team created successfully", team });
  } catch (error) {
    console.error("Error creating team:", error);
    return res.status(500).json({ error: "Failed to create team." });
  }
};


// ✅ Get all members of a specific team (only members can view)
const getTeamMembers = async (req, res) => {

//  console.log("int getteam members")
  try {
    const { teamId } = req.body; 
    const currentUserId = req.user.id;

    // Fetch team and populate user details
    const team = await Team.findById(teamId).populate(
      "members.user",
      "name email"
    );

    if (!team) {
      return res.status(404).json({ error: "Team not found." });
    }

    // Check if current user is a member of this team
    const isMember = team.members.some(
      (m) => m.user._id.toString() === currentUserId
    );

    if (!isMember) {
      return res
        .status(403)
        .json({ error: "You must be a team member to view members." });
    }

    // Extract name, email, role, and _id for unique identification
    let members = team.members.map((m) => ({
      _id: m.user._id,  // Add unique ID for proper identification
      name: m.user.name,
      email: m.user.email || '', // Ensure email is always a string (even if empty)
      role: m.role,
    }));

    // Sort members by role (admins first, then members)
    members.sort((a, b) => a.role.localeCompare(b.role));

    //console.log(members);

    return res.status(200).json({ members });
  } catch (error) {
    console.error("Error getting team members:", error);
    return res.status(500).json({ error: "Failed to get team members." });
  }
};

// ✅ Get all teams where current user is a member
const getAllTeams = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    // Find all teams where the user is a member
    const teams = await Team.find({
      "members.user": userId
    })
    .populate("members.user", "name email")
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      teams: teams,
      count: teams.length
    });
  } catch (error) {
    console.error("Error getting all teams:", error);
    return res.status(500).json({ error: "Failed to get teams." });
  }
};

// ✅ Get teams where current user is a member
const getTeamById = async (req, res) => {
  try {
    const userId = req.user.id;

    const teams = await Team.find({ "members.user": userId });

    if (teams.length === 0) {
      return res
        .status(404)
        .json({ error: "No teams found where user is a member." });
    }

    return res.status(200).json({ teams });
  } catch (error) {
    console.error("Error getting team details:", error);
    return res.status(500).json({ error: "Failed to get team details." });
  }
};

// ✅ Add a member (admin only)
const addMemberToTeam = async (req, res) => {
//  console.log("addMemberToTeam req.body:", req.body);
  try {
    // Accept teamId from params OR body (frontend uses body)
    const teamId = req.params.teamId || req.body.teamId;
    if (!teamId) {
      return res.status(400).json({ error: "teamId is required." });
    }

    // current authenticated user (actor)
    const currentUserId = req.user && (req.user.id || req.user._id);
    if (!currentUserId) {
      return res.status(401).json({ error: "Unauthorized." });
    }

   
    const userObj = req.body.user;
   
    const userIdFromBody = req.body.userId || req.body.user_id || req.body.userid;

    if (!userObj && !userIdFromBody) {
      return res.status(400).json({ error: "user (object) or userId required in body." });
    }

    const userId = (userObj && (userObj.id || userObj._id || userObj.userId)) || userIdFromBody;
    if (!userId) {
      return res.status(400).json({ error: "Could not resolve user id from request body." });
    }

    // role may be provided in body or in user object; default to 'member'
    const role = (req.body.role || (userObj && userObj.role) || "member").toString();

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: "Invalid role specified." });
    }

    // fetch team
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: "Team not found." });
    }
    
    console.log(team);
    // only admin can add members
    if (!isAdmin(team, currentUserId)) {
      return res.status(403).json({ error: "Only admin can add members." });
    }

    console.log(" isAdmin passed");
    // check duplicate membership (normalize to string)
    const alreadyMember = team.members.some(
      (member) => member.user.toString() === userId.toString()
    );

    if (alreadyMember) {
      return res
        .status(400)
        .json({ error: "User is already a member of the team." });
    }
     
     console.log("pushing");
    // push and save
    team.members.push({ user: userId, role });
    await team.save();


    // optional: populate members.user for friendly response
    await team.populate({ path: "members.user", select: "name email" });

    console.log("all done");

    return res.status(200).json({ message: "Member added successfully", team });
  } catch (error) {
    console.error("Error adding member:", error);
    return res.status(500).json({ error: "Failed to add member." });
  }
};


// ✅ Remove a member (admin only)
// Remove member from team (admin only)
const removeMemberFromTeam = async (req, res) => {
  try {
    const { teamId, userMail } = req.body;
    if (!teamId || !userMail) {
      return res.status(400).json({ error: "teamId and userMail are required." });
    }

    const currentUserId = req.user.id; // assume string

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: "Team not found." });
    }

    // check admin rights
    if (!isAdmin(team, currentUserId)) {
      return res.status(403).json({ error: "Only admin can remove members." });
    }

    // find user by email
    const user = await User.findOne({ email: userMail });
    if (!user) {
      return res.status(404).json({ error: "User with that email not found." });
    }

    // Prevent admin removing themselves
    if (currentUserId.toString() === user._id.toString()) {
      return res.status(400).json({ error: "Admins cannot remove themselves." });
    }

    // find member in team
    const memberIndex = team.members.findIndex(
      (member) => member.user.toString() === user._id.toString()
    );

    if (memberIndex === -1) {
      return res.status(404).json({ error: "Member not found in the team." });
    }

    // remove and save
    team.members.splice(memberIndex, 1);
    await team.save();

    return res.status(200).json({ message: "Member removed successfully", team });
  } catch (error) {
    console.error("Error removing member:", error);
    return res.status(500).json({ error: "Failed to remove member." });
  }
};

// Update member role (admin only)
const updateMemberRole = async (req, res) => {
  try {
    const { teamId, userMail, role } = req.body;
    console.log(req.body);
    if (!teamId || !userMail || !role) {
      return res.status(400).json({ error: "teamId, userMail and role are required." });
    }

    const currentUserId = req.user.id; // assume string

    // normalize role for validation (case-insensitive)
    const roleNormalized = role.toString().toLowerCase();
    const validRolesLower = VALID_ROLES.map((r) => r.toString().toLowerCase());
    if (!validRolesLower.includes(roleNormalized)) {
      return res.status(400).json({ error: "Valid role is required." });
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: "Team not found." });
    }

    if (!isAdmin(team, currentUserId)) {
      return res.status(403).json({ error: "Only admin can update roles." });
    }

    const user = await User.findOne({ email: userMail });
    if (!user) {
      return res.status(404).json({ error: "User with that email not found." });
    }

    // Prevent admin changing their own role
    if (currentUserId.toString() === user._id.toString()) {
      return res.status(400).json({ error: "Admins cannot change their own role." });
    }

    const member = team.members.find(
      (m) => m.user.toString() === user._id.toString()
    );

    if (!member) {
      return res.status(404).json({ error: "Member not found in the team." });
    }

    // assign normalized role (you may prefer to store with capitalization)
    member.role = roleNormalized;
    await team.save();

    return res.status(200).json({ message: "Member role updated", team });
  } catch (error) {
    console.error("Error updating member role:", error);
    return res.status(500).json({ error: "Failed to update member role." });
  }
};

const updateTeam = async (req, res) => {
  try {
    const currentUserId = req.user.id; // ✅ user should already be attached by auth middleware
    const { name, description, teamId } = req.body;

    // ✅ find team
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: "Team not found." });
    }

    // ✅ check admin
    if (!isAdmin(team, currentUserId)) {
      return res.status(403).json({ error: "Only admin can update team." });
    }

    // ✅ update fields if provided
    if (name) team.name = name;
    if (description) team.description = description;

    await team.save();
    console.log("Team updated:", team);

    return res.status(200).json({ message: "Team updated successfully", team });
  } catch (error) {
    console.error("Error updating team:", error);
    return res.status(500).json({ error: "Failed to update team." });
  }
};

const deleteTeam = async (req, res) => {
  try {
    const currentUserId = req.user.id; // ✅ user should already be attached by auth middleware
    const { teamId } = req.body;

    if (!teamId) {
      return res.status(400).json({ error: "Team ID is required." });
    }

    // ✅ find team
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: "Team not found." });
    }

    // ✅ check admin
    if (!isAdmin(team, currentUserId)) {
      return res.status(403).json({ error: "Only admin can delete team." });
    }

    // ✅ delete team
    await Team.findByIdAndDelete(teamId);

    // ✅ optionally clean references (users, bugs, etc.)
    console.log("Team deleted:", teamId);

    return res.status(200).json({ message: "Team deleted successfully." });
  } catch (error) {
    console.error("Error deleting team:", error);
    return res.status(500).json({ error: "Failed to delete team." });
  }
};

module.exports = {
  createTeam,
  getAllTeams,
  getTeamMembers,
  getTeamById,
  addMemberToTeam,
  removeMemberFromTeam,
  updateMemberRole,
  updateTeam,
  deleteTeam,
};
