// utils/teamUtils.js

const Team = require("../model/team");
const Bug = require("../model/bug");

/**
 * Get team and check if user is a member.
 * @returns { team, member } if valid
 */
const getTeamAndCheckMembership = async (teamId, userId) => {
  const team = await Team.findById(teamId);
  if (!team) {
    throw { status: 404, message: "Team not found." };
  }

  const member = team.members.find(m => m.user.toString() === userId);
  if (!member) {
    throw { status: 403, message: "You are not a member of this team." };
  }

  return { team, member };
};

/**
 * Check if member has admin role.
 */
const checkIfAdminInTeam = (member) => {
  if (member.role !== 'admin') {
    throw { status: 403, message: "Only admin can perform this action." };
  }
};

/**
 * Check if bug exists and matches teamId (if provided).
 * @returns { bug }
 */
const checkBugTeamMatch = async (bugId, teamId = null) => {
  const bug = await Bug.findById(bugId);
  if (!bug) {
    throw { status: 404, message: "Bug not found." };
  }

  if (teamId && bug.teamId.toString() !== teamId) {
    throw { status: 400, message: "Bug does not belong to the specified team." };
  }

  return bug;
};

module.exports = {
  getTeamAndCheckMembership,
  checkIfAdminInTeam,
  checkBugTeamMatch
};
