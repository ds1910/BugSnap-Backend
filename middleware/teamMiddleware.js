const mongoose = require("mongoose");
const Team = require("../model/team");
const Bug = require("../model/bug");

// Simple error class for consistent error handling
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Middleware to check if user is a member of a team.
 * teamIdSource: 'params', 'body', or 'query'
 */
const checkTeamMembership = (teamIdSource = 'params') => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const teamId =
        teamIdSource === 'body'
          ? req.body.teamId
          : teamIdSource === 'query'
          ? req.query.teamId
          : req.params.teamId;

      if (!teamId || !mongoose.Types.ObjectId.isValid(teamId)) {
        return res.status(400).json({ message: "Invalid or missing team ID." });
      }

      const team = await Team.findById(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found." });
      }

      const member = team.members.find(m => m.user.toString() === userId.toString());
      if (!member) {
        return res.status(403).json({ message: "You are not a member of this team." });
      }

      req.team = team;
      req.teamMember = member;
      console.log(`User ${userId} is a member of team ${teamId} with role ${member.role}`);
      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Middleware to check if user is admin in team.
 * Requires: req.teamMember
 */
const checkTeamAdmin = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const teamId = req.query.teamId;

    if (!userId) {
      return res.status(500).json({ message: "Team member info missing. Run checkTeamMembership first." });
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Team not found." });
    }

    const member = team.members.find(m => m.user.toString() === userId.toString());
    if (!member) {
      return res.status(403).json({ message: "You are not a member of this team." });
    }

    if (member.role !== 'admin') {
      return res.status(403).json({ message: "Only team admins can perform this action." });
    }
   console.log(`User ${userId} is an admin of team ${teamId}`);
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware to check if bug exists and matches teamId (if provided).
 * bugIdSource: 'params', 'body', or 'query'
 * Requires: req.team (optional)
 */
const checkBugTeamMatch = (bugIdSource = 'params') => {
  return async (req, res, next) => {
    console.log("In checkBugTeamMatch middleware");
    try {
      const bugId =
        bugIdSource === 'body'
          ? req.body.bugId
          : bugIdSource === 'query'
          ? req.query.bugId
          : req.params.bugId;

      if (!bugId || !mongoose.Types.ObjectId.isValid(bugId)) {
        return res.status(400).json({ message: "Invalid or missing bug ID." });
      }

      const bug = await Bug.findById(bugId);
      if (!bug) {
        return res.status(404).json({ message: "Bug not found." });
      }

      // Optional: Validate against teamId if req.team exists
      if (req.team && bug.teamId.toString() !== req.team._id.toString()) {
        return res.status(400).json({ message: "Bug does not belong to the specified team." });
      }

      req.bug = bug; // Attach for controller use
      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Middleware to check if teamId is valid and attach team to req.team
 */
const checkTeam = async (req, res, next) => {
  const teamId = req.query.teamId || req.body.teamId || req.params.teamId;
  if (!teamId || !mongoose.Types.ObjectId.isValid(teamId)) {
    return res.status(400).json({ message: "Invalid or missing teamId" });
  }

  try {
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }
    req.team = team;
    next(); // <-- Allow request to proceed
  } catch (err) {
    return res.status(500).json({ message: "Error validating team", error: err.message });
  }
};

module.exports = {
  checkTeamMembership,
  checkTeamAdmin,
  checkBugTeamMatch,
  checkTeam
};
