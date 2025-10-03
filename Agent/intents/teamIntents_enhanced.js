const Team = require('../../model/team');
const User = require('../../model/user');
const Bug = require('../../model/bug');
const mongoose = require('mongoose');

/**
 * Enhanced Team-related intent handlers for AI Agent
 * Provides detailed, user-friendly responses with comprehensive team management
 */
class TeamIntents {

  /**
   * Get all teams for a user with detailed formatting
   */
  static async getAllTeams(userId) {
    try {
      // Find teams where the user is a member
      const teams = await Team.find({
        'members.user': userId
      })
        .populate('members.user', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

      if (teams.length === 0) {
        return {
          success: true,
          message: '🏢 You are not a member of any teams yet. Create a team to start collaborating!',
          text: '🏢 You are not a member of any teams yet. Create a team to start collaborating!',
          data: {
            teams: [],
            count: 0
          },
          suggestions: [
            'Create a new team',
            'Ask to join an existing team',
            'Learn about team features'
          ]
        };
      }

      let message = `🏢 Found ${teams.length} team${teams.length === 1 ? '' : 's'} where you are a member:\n\n`;

      // Get team statistics
      const teamsWithStats = await Promise.all(teams.map(async (team) => {
        const totalBugs = await Bug.countDocuments({ teamId: team._id, deleted: false });
        const openBugs = await Bug.countDocuments({ teamId: team._id, status: 'open', deleted: false });
        const adminCount = team.members.filter(m => m.role === 'admin').length;
        
        return {
          ...team.toObject(),
          stats: { totalBugs, openBugs, adminCount }
        };
      }));

      teamsWithStats.forEach((team, index) => {
        const memberCount = team.members.length;
        const userRole = team.members.find(m => m.user._id.toString() === userId.toString())?.role || 'member';
        
        message += `${index + 1}. **${team.name}** ${userRole === 'admin' ? '👑' : ''}\n`;
        if (team.description) {
          message += `   📝 ${team.description}\n`;
        }
        message += `   👥 Members: ${memberCount} (${team.stats.adminCount} admin${team.stats.adminCount === 1 ? '' : 's'})\n`;
        message += `   🐛 Bugs: ${team.stats.totalBugs} total, ${team.stats.openBugs} open\n`;
        message += `   👨‍💻 Created by: ${team.createdBy.name}\n`;
        message += `   📅 Created: ${new Date(team.createdAt).toLocaleDateString()}\n\n`;
      });

      return {
        success: true,
        message: message,
        text: message,
        data: {
          teams: teamsWithStats.map(team => ({
            id: team._id,
            name: team.name,
            description: team.description || 'No description',
            memberCount: team.members.length,
            adminCount: team.stats.adminCount,
            totalBugs: team.stats.totalBugs,
            openBugs: team.stats.openBugs,
            createdBy: team.createdBy.name,
            createdAt: team.createdAt,
            userRole: team.members.find(m => m.user._id.toString() === userId.toString())?.role || 'member',
            members: team.members.map(m => ({
              name: m.user.name,
              email: m.user.email,
              role: m.role
            }))
          })),
          count: teams.length
        },
        suggestions: [
          'Create a new team',
          'Show team members',
          'View team bugs',
          'Team management options'
        ]
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ Error fetching teams. Please try again.',
        text: '❌ Error fetching teams. Please try again.',
        error: error.message,
        suggestions: [
          'Try: "Show my teams"',
          'Try: "Create a team"',
          'Contact support if the issue persists'
        ]
      };
    }
  }

  /**
   * Create a new team with validation
   */
  static async createTeam(teamData, userId) {
    try {
      // Validate required fields
      if (!teamData.name) {
        return {
          success: false,
          message: '📝 To create a team, I need at least a team name. What should I call this team?',
          text: '📝 To create a team, I need at least a team name. What should I call this team?',
          action: 'input_required',
          field: 'name',
          suggestions: [
            'Try: "Create team: Development Team"',
            'Try: "Create team: QA Testing Squad"',
            'Provide just the name and I\'ll ask for other details'
          ]
        };
      }

      // Check for duplicate team name
      const existingTeam = await Team.findOne({ 
        name: { $regex: new RegExp(`^${teamData.name}$`, 'i') }
      });
      
      if (existingTeam) {
        return {
          success: false,
          message: `⚠️ A team with the name "${teamData.name}" already exists. Please choose a different name.`,
          text: `⚠️ A team with the name "${teamData.name}" already exists. Please choose a different name.`,
          suggestions: [
            `"${teamData.name} - ${new Date().getFullYear()}"`,
            `"${teamData.name} - Dev"`,
            'Choose a more specific name'
          ]
        };
      }

      // Create the team
      const team = new Team({
        name: teamData.name,
        description: teamData.description || '',
        createdBy: userId,
        members: [{
          user: userId,
          role: 'admin',
          joinedAt: new Date()
        }]
      });

      const savedTeam = await team.save();
      await savedTeam.populate([
        { path: 'createdBy', select: 'name email' },
        { path: 'members.user', select: 'name email' }
      ]);

      const message = `✅ **Team Created Successfully!**\n\n` +
        `🏢 **Name:** ${savedTeam.name}\n` +
        `👨‍💻 **Created by:** ${savedTeam.createdBy.name}\n` +
        `👑 **Your role:** Admin\n` +
        (savedTeam.description ? `📝 **Description:** ${savedTeam.description}\n` : '') +
        `🆔 **Team ID:** ${savedTeam._id}\n\n` +
        `🎉 You can now start adding members and creating bugs for this team!`;

      return {
        success: true,
        message: message,
        text: message,
        data: {
          team: {
            id: savedTeam._id,
            name: savedTeam.name,
            description: savedTeam.description,
            createdBy: savedTeam.createdBy.name,
            memberCount: 1,
            userRole: 'admin'
          }
        },
        suggestions: [
          'Invite members to team',
          'Create a bug for this team',
          'Show team details',
          'View all teams'
        ]
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ Failed to create team. Please try again.',
        text: '❌ Failed to create team. Please try again.',
        error: error.message,
        suggestions: [
          'Try with just a team name first',
          'Check if team name is unique',
          'Contact support if the issue persists'
        ]
      };
    }
  }

  /**
   * Get detailed information about a specific team
   */
  static async getTeamDetails(userId, teamId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(teamId)) {
        return {
          success: false,
          message: '❌ Invalid team ID format. Please provide a valid team ID.',
          text: '❌ Invalid team ID format. Please provide a valid team ID.',
          suggestions: [
            'Try: "Show all teams" to see available teams',
            'Copy the exact team ID from the team list'
          ]
        };
      }

      const team = await Team.findById(teamId)
        .populate('createdBy', 'name email')
        .populate('members.user', 'name email');

      if (!team) {
        return {
          success: false,
          message: '🔍 Team not found. It may have been deleted or you don\'t have access to it.',
          text: '🔍 Team not found. It may have been deleted or you don\'t have access to it.',
          suggestions: [
            'Check the team ID',
            'Show all teams',
            'Search for teams by name'
          ]
        };
      }

      // Check if user is a team member
      const userMember = team.members.find(m => m.user._id.toString() === userId.toString());
      if (!userMember) {
        return {
          success: false,
          message: '🚫 You don\'t have access to this team. You must be a member to view team details.',
          text: '🚫 You don\'t have access to this team. You must be a member to view team details.',
          suggestions: [
            'Ask to join the team',
            'Show your teams',
            'Contact team admin'
          ]
        };
      }

      // Get team statistics
      const [totalBugs, openBugs, resolvedBugs, highPriorityBugs] = await Promise.all([
        Bug.countDocuments({ teamId: team._id, deleted: false }),
        Bug.countDocuments({ teamId: team._id, status: 'open', deleted: false }),
        Bug.countDocuments({ teamId: team._id, status: 'resolved', deleted: false }),
        Bug.countDocuments({ teamId: team._id, priority: 'high', deleted: false })
      ]);

      const adminCount = team.members.filter(m => m.role === 'admin').length;
      const memberCount = team.members.length;

      let message = `🏢 **Team Details**\n\n`;
      message += `📝 **Name:** ${team.name}\n`;
      if (team.description) {
        message += `📋 **Description:** ${team.description}\n`;
      }
      message += `👨‍💻 **Created by:** ${team.createdBy.name}\n`;
      message += `👑 **Your role:** ${userMember.role}\n`;
      message += `📅 **Created:** ${new Date(team.createdAt).toLocaleDateString()}\n\n`;

      message += `👥 **Members (${memberCount}):**\n`;
      team.members.forEach(member => {
        const roleEmoji = member.role === 'admin' ? '👑' : '👤';
        message += `${roleEmoji} ${member.user.name} (${member.role})\n`;
      });

      message += `\n🐛 **Bug Statistics:**\n`;
      message += `📊 Total bugs: ${totalBugs}\n`;
      message += `🆕 Open bugs: ${openBugs}\n`;
      message += `✅ Resolved bugs: ${resolvedBugs}\n`;
      message += `🔴 High priority bugs: ${highPriorityBugs}\n`;

      return {
        success: true,
        message: message,
        text: message,
        data: {
          team: {
            id: team._id,
            name: team.name,
            description: team.description,
            createdBy: team.createdBy.name,
            userRole: userMember.role,
            memberCount: memberCount,
            adminCount: adminCount,
            createdAt: team.createdAt,
            members: team.members.map(m => ({
              name: m.user.name,
              email: m.user.email,
              role: m.role,
              joinedAt: m.joinedAt
            })),
            stats: {
              totalBugs,
              openBugs,
              resolvedBugs,
              highPriorityBugs
            }
          }
        },
        suggestions: [
          'Show team bugs',
          'Add member to team',
          'Create bug for team',
          'Update team details',
          'Show all teams'
        ]
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ Error fetching team details.',
        text: '❌ Error fetching team details.',
        error: error.message,
        suggestions: [
          'Try again with the team ID',
          'Show all teams instead'
        ]
      };
    }
  }

  /**
   * Add a member to a team
   */
  static async addMemberToTeam(teamId, userEmail, role, performedBy) {
    try {
      if (!mongoose.Types.ObjectId.isValid(teamId)) {
        return {
          success: false,
          message: '❌ Invalid team ID format.',
          text: '❌ Invalid team ID format.',
          suggestions: ['Check the team ID and try again']
        };
      }

      const team = await Team.findById(teamId);
      if (!team) {
        return {
          success: false,
          message: '🔍 Team not found.',
          text: '🔍 Team not found.',
          suggestions: ['Check the team ID', 'Show all teams']
        };
      }

      // Check if performer is team admin
      const performerMember = team.members.find(m => m.user.toString() === performedBy.toString());
      if (!performerMember || performerMember.role !== 'admin') {
        return {
          success: false,
          message: '🚫 You must be a team admin to add members.',
          text: '🚫 You must be a team admin to add members.',
          suggestions: ['Contact team admin', 'Show your teams']
        };
      }

      // Find user by email
      const user = await User.findOne({ email: userEmail }).select('name email');
      if (!user) {
        return {
          success: false,
          message: `👤 No user found with email: ${userEmail}`,
          text: `👤 No user found with email: ${userEmail}`,
          suggestions: [
            'Check the email address',
            'Ask user to register first',
            'Try with a different email'
          ]
        };
      }

      // Check if user is already a member
      const existingMember = team.members.find(m => m.user.toString() === user._id.toString());
      if (existingMember) {
        return {
          success: false,
          message: `⚠️ ${user.name} is already a member of this team (role: ${existingMember.role})`,
          text: `⚠️ ${user.name} is already a member of this team (role: ${existingMember.role})`,
          suggestions: [
            'Update member role instead',
            'Show team members',
            'Add a different user'
          ]
        };
      }

      // Add member to team
      team.members.push({
        user: user._id,
        role: role || 'member',
        joinedAt: new Date()
      });

      await team.save();

      const message = `✅ **Member Added Successfully!**\n\n` +
        `👤 **User:** ${user.name}\n` +
        `📧 **Email:** ${user.email}\n` +
        `👑 **Role:** ${role || 'member'}\n` +
        `🏢 **Team:** ${team.name}\n` +
        `📅 **Joined:** ${new Date().toLocaleDateString()}`;

      return {
        success: true,
        message: message,
        text: message,
        data: {
          team: {
            id: team._id,
            name: team.name,
            memberCount: team.members.length
          },
          newMember: {
            name: user.name,
            email: user.email,
            role: role || 'member'
          }
        },
        suggestions: [
          'Show team details',
          'Add another member',
          'Show team members',
          'Create bug for team'
        ]
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ Error adding member to team.',
        text: '❌ Error adding member to team.',
        error: error.message,
        suggestions: ['Try again', 'Check email and team ID']
      };
    }
  }

  /**
   * Search teams by name
   */
  static async searchTeams(userId, searchTerm) {
    try {
      const teams = await Team.find({
        'members.user': userId,
        name: { $regex: searchTerm, $options: 'i' }
      })
        .populate('members.user', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

      if (teams.length === 0) {
        return {
          success: true,
          message: `🔍 No teams found matching "${searchTerm}". You might want to:`,
          text: `🔍 No teams found matching "${searchTerm}". You might want to:`,
          data: { teams: [], count: 0, searchTerm },
          suggestions: [
            'Show all your teams',
            'Create a new team',
            'Try a different search term'
          ]
        };
      }

      let message = `🔍 Found ${teams.length} team${teams.length === 1 ? '' : 's'} matching "${searchTerm}":\n\n`;

      teams.forEach((team, index) => {
        const memberCount = team.members.length;
        const userRole = team.members.find(m => m.user._id.toString() === userId.toString())?.role || 'member';
        
        message += `${index + 1}. **${team.name}** ${userRole === 'admin' ? '👑' : ''}\n`;
        if (team.description) {
          message += `   📝 ${team.description}\n`;
        }
        message += `   👥 Members: ${memberCount}\n`;
        message += `   👨‍💻 Created by: ${team.createdBy.name}\n\n`;
      });

      return {
        success: true,
        message: message,
        text: message,
        data: {
          teams: teams.map(team => ({
            id: team._id,
            name: team.name,
            description: team.description || 'No description',
            memberCount: team.members.length,
            createdBy: team.createdBy.name,
            userRole: team.members.find(m => m.user._id.toString() === userId.toString())?.role || 'member'
          })),
          count: teams.length,
          searchTerm: searchTerm
        },
        suggestions: [
          'Show team details',
          'Show all teams',
          'Create a new team',
          'Refine search'
        ]
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ Search failed. Please try again.',
        text: '❌ Search failed. Please try again.',
        error: error.message,
        suggestions: [
          'Try: "Show all teams"',
          'Try a simpler search term',
          'Contact support'
        ]
      };
    }
  }

  /**
   * Get team statistics
   */
  static async getTeamStats(userId) {
    try {
      const teams = await Team.find({
        'members.user': userId
      });

      if (teams.length === 0) {
        return {
          success: true,
          message: '📊 No team statistics available. You need to be part of a team first.',
          text: '📊 No team statistics available. You need to be part of a team first.',
          data: { stats: {}, total: 0 },
          suggestions: ['Create a new team', 'Join an existing team']
        };
      }

      const teamIds = teams.map(t => t._id);

      const [totalMembers, totalBugs, adminTeams] = await Promise.all([
        Team.aggregate([
          { $match: { _id: { $in: teamIds } } },
          { $unwind: '$members' },
          { $group: { _id: null, total: { $sum: 1 } } }
        ]),
        Bug.countDocuments({ teamId: { $in: teamIds }, deleted: false }),
        Team.countDocuments({ 
          _id: { $in: teamIds },
          'members': { 
            $elemMatch: { 
              user: userId, 
              role: 'admin' 
            } 
          }
        })
      ]);

      const memberCount = totalMembers[0]?.total || 0;

      let message = `📊 **Your Team Statistics:**\n\n`;
      message += `🏢 **Total teams:** ${teams.length}\n`;
      message += `👑 **Teams where you're admin:** ${adminTeams}\n`;
      message += `👥 **Total unique members:** ${memberCount}\n`;
      message += `🐛 **Total bugs across teams:** ${totalBugs}\n`;

      // Individual team breakdown
      if (teams.length > 0) {
        message += `\n**Team Breakdown:**\n`;
        for (const team of teams) {
          const teamBugs = await Bug.countDocuments({ teamId: team._id, deleted: false });
          const userRole = team.members.find(m => m.user.toString() === userId.toString())?.role || 'member';
          message += `• ${team.name}: ${team.members.length} members, ${teamBugs} bugs ${userRole === 'admin' ? '👑' : ''}\n`;
        }
      }

      return {
        success: true,
        message: message,
        text: message,
        data: {
          totalTeams: teams.length,
          adminTeams: adminTeams,
          totalMembers: memberCount,
          totalBugs: totalBugs,
          teams: teams.map(t => ({
            name: t.name,
            memberCount: t.members.length,
            userRole: t.members.find(m => m.user.toString() === userId.toString())?.role || 'member'
          }))
        },
        suggestions: [
          'Show all teams',
          'Create a new team',
          'Show team details',
          'View team bugs'
        ]
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ Error getting team statistics.',
        text: '❌ Error getting team statistics.',
        error: error.message,
        suggestions: ['Try again', 'Show all teams instead']
      };
    }
  }
}

module.exports = TeamIntents;