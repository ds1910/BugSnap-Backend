const Bug = require('../../model/bug');
const Team = require('../../model/team');
const User = require('../../model/user');
const mongoose = require('mongoose');

/**
 * Enhanced Bug-related intent handlers for AI Agent
 * Provides detailed, user-friendly responses with comprehensive bug management
 */
class BugIntents {

  /**
   * Get all bugs with detailed formatting
   */
  static async getAllBugs(userId, filters = {}, options = {}) {
    try {
      const query = { deleted: false };
      
      // Find teams where the user is a member
      const teams = await Team.find({
        'members.user': userId
      });
      const userTeamIds = teams.map(team => team._id);
      
      if (userTeamIds.length === 0) {
        return {
          success: true,
          message: '📝 You are not a member of any teams yet. Create or join a team to start managing bugs!',
          text: '📝 You are not a member of any teams yet. Create or join a team to start managing bugs!',
          data: {
            bugs: [],
            count: 0,
            teams: []
          },
          suggestions: [
            'Create a new team',
            'Ask to be added to a team',
            'View team management options'
          ]
        };
      }
      
      query.teamId = { $in: userTeamIds };

      // Apply filters
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query.status = { $in: filters.status };
        } else {
          query.status = filters.status;
        }
      }
      if (filters.priority) {
        if (Array.isArray(filters.priority)) {
          query.priority = { $in: filters.priority };
        } else {
          query.priority = filters.priority;
        }
      }
      if (filters.assignee) query.assignedTo = { $in: [filters.assignee] };
      if (filters.creator) query.createdBy = filters.creator;
      if (filters.team) query.teamId = filters.team;
      
      // Date range filter
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
      }

      // Text search
      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
          { tags: { $regex: filters.search, $options: 'i' } }
        ];
      }

      const limit = filters.limit || 20;
      const bugs = await Bug.find(query)
        .populate('createdBy', 'name email')
        .populate('assignedTo', 'name email')
        .populate('teamId', 'name description')
        .sort({ createdAt: -1 })
        .limit(limit);

      // Format response based on whether filters were applied
      let message = '';
      let filterDesc = '';
      
      if (filters.status) filterDesc += `Status: ${Array.isArray(filters.status) ? filters.status.join(', ') : filters.status}. `;
      if (filters.priority) filterDesc += `Priority: ${Array.isArray(filters.priority) ? filters.priority.join(', ') : filters.priority}. `;
      if (filters.search) filterDesc += `Search: "${filters.search}". `;
      
      if (bugs.length === 0) {
        message = filterDesc 
          ? `🔍 No bugs found matching your criteria: ${filterDesc}`
          : '✅ Great! You have no bugs at the moment. Your projects are bug-free!';
      } else {
        message = `🐛 Found ${bugs.length} bug${bugs.length === 1 ? '' : 's'}${filterDesc ? ` matching: ${filterDesc}` : ''}`;
      }

      // Add detailed bug information
      const detailedBugs = bugs.map(bug => ({
        id: bug._id,
        title: bug.title,
        description: bug.description || 'No description provided',
        status: bug.status,
        priority: bug.priority,
        team: bug.teamId ? bug.teamId.name : 'Unknown Team',
        createdBy: bug.createdBy ? bug.createdBy.name : 'Unknown User',
        assignedTo: bug.assignedTo.length > 0 
          ? bug.assignedTo.map(user => user.name).join(', ')
          : 'Unassigned',
        tags: bug.tags.length > 0 ? bug.tags.join(', ') : 'No tags',
        createdAt: bug.createdAt,
        dueDate: bug.dueDate || null
      }));

      // Create formatted text display
      let detailsText = '';
      if (bugs.length > 0) {
        detailsText = '\n\n📋 **Bug Details:**\n';
        bugs.slice(0, 5).forEach((bug, index) => {
          const priorityEmoji = {
            'critical': '🔴',
            'high': '🟠', 
            'medium': '🟡',
            'low': '🟢'
          }[bug.priority] || '⚪';
          
          const statusEmoji = {
            'open': '🆕',
            'in progress': '⚡',
            'resolved': '✅',
            'closed': '🔒'
          }[bug.status] || '❓';
          
          detailsText += `\n${index + 1}. ${statusEmoji} **${bug.title}**\n`;
          detailsText += `   ${priorityEmoji} Priority: ${bug.priority} | Status: ${bug.status}\n`;
          detailsText += `   👤 Assigned: ${bug.assignedTo.length > 0 ? bug.assignedTo.map(u => u.name).join(', ') : 'Unassigned'}\n`;
          detailsText += `   🏢 Team: ${bug.teamId.name}\n`;
          if (bug.description) {
            detailsText += `   📝 ${bug.description.substring(0, 100)}${bug.description.length > 100 ? '...' : ''}\n`;
          }
        });
        
        if (bugs.length > 5) {
          detailsText += `\n... and ${bugs.length - 5} more bugs`;
        }
      }

      const fullMessage = message + detailsText;

      // Generate contextual suggestions
      const suggestions = [];
      if (bugs.length > 0) {
        suggestions.push('Show high priority bugs');
        suggestions.push('Show open bugs');
        suggestions.push('Create a new bug');
        if (bugs.some(b => b.assignedTo.length === 0)) {
          suggestions.push('Show unassigned bugs');
        }
      } else {
        suggestions.push('Create a new bug');
        suggestions.push('View team members');
        suggestions.push('Show project overview');
      }

      return {
        success: true,
        message: fullMessage,
        text: fullMessage,
        data: {
          bugs: detailedBugs,
          count: bugs.length,
          totalTeams: teams.length,
          filters: filters
        },
        suggestions: suggestions
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ I encountered an error while fetching bugs. Please try again.',
        text: '❌ I encountered an error while fetching bugs. Please try again.',
        error: error.message,
        suggestions: [
          'Try: "Show all bugs"',
          'Try: "Show bugs for my team"',
          'Contact support if the issue persists'
        ]
      };
    }
  }

  /**
   * Create a new bug with guided input
   */
  static async createBug(bugData, userId) {
    try {
      // Validate required fields
      if (!bugData.title) {
        return {
          success: false,
          message: '📝 To create a bug, I need at least a title. What should I call this bug?',
          text: '📝 To create a bug, I need at least a title. What should I call this bug?',
          action: 'input_required',
          field: 'title',
          suggestions: [
            'Try: "Create bug: Login page not working"',
            'Try: "Report bug: Dashboard crashes on mobile"',
            'Provide just the title and I\'ll ask for other details'
          ]
        };
      }

      // Find user's teams
      const teams = await Team.find({
        'members.user': userId
      });

      if (teams.length === 0) {
        return {
          success: false,
          message: '🚫 You need to be a member of a team before creating bugs. Would you like me to help you create a team?',
          text: '🚫 You need to be a member of a team before creating bugs. Would you like me to help you create a team?',
          suggestions: [
            'Create a new team',
            'Ask to join an existing team',
            'View team management help'
          ]
        };
      }

      // Use the first team if teamId not specified
      let teamId = bugData.teamId;
      if (!teamId) {
        if (teams.length === 1) {
          teamId = teams[0]._id;
        } else {
          return {
            success: false,
            message: `🏢 You're a member of ${teams.length} teams. Which team should I create this bug for?\n\n` +
                    teams.map((team, index) => `${index + 1}. ${team.name}`).join('\n'),
            text: `🏢 You're a member of ${teams.length} teams. Which team should I create this bug for?\n\n` +
                    teams.map((team, index) => `${index + 1}. ${team.name}`).join('\n'),
            action: 'team_selection',
            data: { teams: teams, bugData: bugData },
            suggestions: teams.map(team => `Create bug for ${team.name}`)
          };
        }
      }

      // Validate team membership
      const team = teams.find(t => t._id.toString() === teamId.toString());
      if (!team) {
        return {
          success: false,
          message: '🚫 You are not a member of the specified team.',
          text: '🚫 You are not a member of the specified team.',
          suggestions: ['Choose from your teams', 'View your teams']
        };
      }

      // Check for duplicate title
      const existingBug = await Bug.findOne({ 
        title: { $regex: new RegExp(`^${bugData.title}$`, 'i') }, 
        teamId: teamId 
      });
      
      if (existingBug) {
        return {
          success: false,
          message: `⚠️ A bug with the title "${bugData.title}" already exists in ${team.name}. Please choose a different title.`,
          text: `⚠️ A bug with the title "${bugData.title}" already exists in ${team.name}. Please choose a different title.`,
          suggestions: [
            `"${bugData.title} - v2"`,
            `"${bugData.title} - ${new Date().toLocaleDateString()}"`,
            'Choose a more specific title'
          ]
        };
      }

      // Handle assignee resolution
      let assignedTo = [];
      if (bugData.assignedTo && bugData.assignedTo.length > 0) {
        for (const assigneeData of bugData.assignedTo) {
          let user = null;
          
          if (assigneeData.id) {
            user = await User.findById(assigneeData.id);
          } else if (assigneeData.email) {
            user = await User.findOne({ email: assigneeData.email });
          } else if (assigneeData.name) {
            // Find user by name in the team
            const teamMembers = await User.find({
              _id: { $in: team.members.map(m => m.user) },
              name: { $regex: new RegExp(assigneeData.name, 'i') }
            });
            user = teamMembers[0];
          }
          
          if (user) {
            // Check if user is a team member
            const isMember = team.members.some(m => m.user.toString() === user._id.toString());
            if (isMember) {
              assignedTo.push(user._id);
            }
          }
        }
      }

      // Create the bug
      const bug = new Bug({
        title: bugData.title,
        description: bugData.description || '',
        teamId: teamId,
        createdBy: userId,
        assignedTo: assignedTo,
        priority: bugData.priority || 'medium',
        status: bugData.status || 'open',
        tags: bugData.tags || [],
        startDate: bugData.startDate || null,
        dueDate: bugData.dueDate || null,
        history: [{
          action: 'created',
          detail: `Bug created with title: ${bugData.title}`,
          performedBy: userId,
          performedAt: new Date()
        }]
      });

      const savedBug = await bug.save();
      await savedBug.populate([
        { path: 'createdBy', select: 'name email' },
        { path: 'assignedTo', select: 'name email' },
        { path: 'teamId', select: 'name' }
      ]);

      const assigneeNames = savedBug.assignedTo.length > 0 
        ? savedBug.assignedTo.map(user => user.name).join(', ')
        : 'Unassigned';

      const message = `✅ **Bug Created Successfully!**\n\n` +
        `🐛 **Title:** ${savedBug.title}\n` +
        `🏢 **Team:** ${savedBug.teamId.name}\n` +
        `⚡ **Priority:** ${savedBug.priority}\n` +
        `📊 **Status:** ${savedBug.status}\n` +
        `👤 **Assigned to:** ${assigneeNames}\n` +
        `👨‍💻 **Created by:** ${savedBug.createdBy.name}\n` +
        (savedBug.description ? `📝 **Description:** ${savedBug.description}\n` : '') +
        (savedBug.tags.length > 0 ? `🏷️ **Tags:** ${savedBug.tags.join(', ')}\n` : '') +
        `🆔 **Bug ID:** ${savedBug._id}`;

      return {
        success: true,
        message: message,
        text: message,
        data: {
          bug: {
            id: savedBug._id,
            title: savedBug.title,
            description: savedBug.description,
            status: savedBug.status,
            priority: savedBug.priority,
            team: savedBug.teamId.name,
            assignedTo: assigneeNames,
            createdBy: savedBug.createdBy.name,
            tags: savedBug.tags
          }
        },
        suggestions: [
          'Show all bugs',
          'Assign this bug to someone',
          'Create another bug',
          'Update bug priority'
        ]
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ Failed to create bug. Please try again.',
        text: '❌ Failed to create bug. Please try again.',
        error: error.message,
        suggestions: [
          'Try with just a title first',
          'Check if you\'re in a team',
          'Contact support if the issue persists'
        ]
      };
    }
  }

  /**
   * Get bugs by status with detailed formatting
   */
  static async getBugsByStatus(userId, status) {
    try {
      const filters = { status: status };
      return await this.getAllBugs(userId, filters);
    } catch (error) {
      return {
        success: false,
        message: `❌ Error fetching ${status} bugs`,
        text: `❌ Error fetching ${status} bugs`,
        error: error.message
      };
    }
  }

  /**
   * Get bugs by priority with detailed formatting
   */
  static async getBugsByPriority(userId, priority) {
    try {
      const filters = { priority: priority };
      return await this.getAllBugs(userId, filters);
    } catch (error) {
      return {
        success: false,
        message: `❌ Error fetching ${priority} priority bugs`,
        text: `❌ Error fetching ${priority} priority bugs`,
        error: error.message
      };
    }
  }

  /**
   * Get user's assigned bugs
   */
  static async getMyAssignedBugs(userId) {
    try {
      const filters = { assignee: userId };
      return await this.getAllBugs(userId, filters);
    } catch (error) {
      return {
        success: false,
        message: '❌ Error fetching your assigned bugs',
        text: '❌ Error fetching your assigned bugs',
        error: error.message
      };
    }
  }

  /**
   * Search bugs with intelligent query processing
   */
  static async searchBugs(userId, query) {
    try {
      // Extract search criteria from natural language
      const searchTerms = query.toLowerCase();
      const filters = {};
      
      // Status detection
      if (searchTerms.includes('open')) filters.status = 'open';
      else if (searchTerms.includes('closed')) filters.status = 'closed';
      else if (searchTerms.includes('in progress') || searchTerms.includes('progress')) filters.status = 'in progress';
      else if (searchTerms.includes('resolved')) filters.status = 'resolved';
      
      // Priority detection
      if (searchTerms.includes('high priority') || searchTerms.includes('urgent')) filters.priority = 'high';
      else if (searchTerms.includes('critical')) filters.priority = 'critical';
      else if (searchTerms.includes('low priority')) filters.priority = 'low';
      else if (searchTerms.includes('medium priority')) filters.priority = 'medium';
      
      // Extract search text (remove status/priority keywords)
      let searchText = query.replace(/(open|closed|in progress|resolved|high priority|low priority|medium priority|critical|urgent)/gi, '').trim();
      if (searchText) {
        filters.search = searchText;
      }

      return await this.getAllBugs(userId, filters);
    } catch (error) {
      return {
        success: false,
        message: '❌ Search failed. Please try again.',
        text: '❌ Search failed. Please try again.',
        error: error.message,
        suggestions: [
          'Try: "Show all bugs"',
          'Try: "High priority bugs"',
          'Try: "Open bugs"'
        ]
      };
    }
  }

  /**
   * Update bug status
   */
  static async updateBugStatus(bugId, newStatus, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(bugId)) {
        return {
          success: false,
          message: '❌ Invalid bug ID format.',
          text: '❌ Invalid bug ID format.',
          suggestions: ['Check the bug ID and try again']
        };
      }

      const bug = await Bug.findById(bugId)
        .populate('teamId', 'name members')
        .populate('createdBy', 'name')
        .populate('assignedTo', 'name');

      if (!bug) {
        return {
          success: false,
          message: '🔍 Bug not found.',
          text: '🔍 Bug not found.',
          suggestions: ['Check the bug ID', 'Show all bugs']
        };
      }

      // Check if user is a team member
      const isTeamMember = bug.teamId.members.some(
        member => member.user.toString() === userId.toString()
      );

      if (!isTeamMember) {
        return {
          success: false,
          message: '🚫 You must be a team member to update bug status.',
          text: '🚫 You must be a team member to update bug status.',
          suggestions: ['Join the team first', 'Ask team admin for access']
        };
      }

      const oldStatus = bug.status;
      bug.status = newStatus;
      bug.history.push({
        action: 'status_updated',
        detail: `Status changed from ${oldStatus} to ${newStatus}`,
        performedBy: userId,
        performedAt: new Date()
      });

      await bug.save();

      const statusEmoji = {
        'open': '🆕',
        'in progress': '⚡',
        'resolved': '✅',
        'closed': '🔒'
      }[newStatus] || '❓';

      const message = `${statusEmoji} **Bug Status Updated!**\n\n` +
        `🐛 **Bug:** ${bug.title}\n` +
        `📊 **Status:** ${oldStatus} → ${newStatus}\n` +
        `🏢 **Team:** ${bug.teamId.name}`;

      return {
        success: true,
        message: message,
        text: message,
        data: {
          bug: {
            id: bug._id,
            title: bug.title,
            oldStatus: oldStatus,
            newStatus: newStatus,
            team: bug.teamId.name
          }
        },
        suggestions: [
          'Show bug details',
          'Show all bugs',
          'Update another bug',
          'Assign this bug'
        ]
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ Error updating bug status.',
        text: '❌ Error updating bug status.',
        error: error.message,
        suggestions: ['Try again', 'Check bug ID']
      };
    }
  }

  /**
   * Assign a bug to users
   */
  static async assignBug(bugId, userIds, performedBy) {
    try {
      if (!mongoose.Types.ObjectId.isValid(bugId)) {
        return {
          success: false,
          message: '❌ Invalid bug ID format.',
          text: '❌ Invalid bug ID format.',
          suggestions: ['Check the bug ID and try again']
        };
      }

      const bug = await Bug.findById(bugId)
        .populate('teamId', 'name members')
        .populate('assignedTo', 'name email');

      if (!bug) {
        return {
          success: false,
          message: '🔍 Bug not found.',
          text: '🔍 Bug not found.',
          suggestions: ['Check the bug ID', 'Show all bugs']
        };
      }

      // Verify user is team member
      const isTeamMember = bug.teamId.members.some(
        member => member.user.toString() === performedBy.toString()
      );

      if (!isTeamMember) {
        return {
          success: false,
          message: '🚫 You must be a team member to assign bugs.',
          text: '🚫 You must be a team member to assign bugs.',
          suggestions: ['Join the team first', 'Ask team admin for access']
        };
      }

      // Validate assignees are team members
      const validUserIds = [];
      const invalidUsers = [];
      
      for (const userId of userIds) {
        if (mongoose.Types.ObjectId.isValid(userId)) {
          const isValidMember = bug.teamId.members.some(
            member => member.user.toString() === userId.toString()
          );
          if (isValidMember) {
            validUserIds.push(userId);
          } else {
            invalidUsers.push(userId);
          }
        }
      }

      if (validUserIds.length === 0) {
        return {
          success: false,
          message: '❌ No valid team members found to assign.',
          text: '❌ No valid team members found to assign.',
          suggestions: [
            'Check user IDs',
            'View team members',
            'Add users to team first'
          ]
        };
      }

      // Update bug assignment
      bug.assignedTo = validUserIds;
      bug.history.push({
        action: 'assigned',
        detail: `Bug assigned to ${validUserIds.length} user(s)`,
        performedBy: performedBy,
        performedAt: new Date()
      });

      await bug.save();
      await bug.populate('assignedTo', 'name email');

      const assigneeNames = bug.assignedTo.map(user => user.name).join(', ');
      
      let message = `✅ **Bug Assigned Successfully!**\n\n`;
      message += `🐛 **Bug:** ${bug.title}\n`;
      message += `👤 **Assigned to:** ${assigneeNames}\n`;
      
      if (invalidUsers.length > 0) {
        message += `\n⚠️ Note: ${invalidUsers.length} user(s) could not be assigned (not team members)`;
      }

      return {
        success: true,
        message: message,
        text: message,
        data: {
          bug: {
            id: bug._id,
            title: bug.title,
            assignedTo: bug.assignedTo.map(u => ({ name: u.name, email: u.email }))
          }
        },
        suggestions: [
          'Show bug details',
          'Update bug status',
          'Assign another bug',
          'Show all bugs'
        ]
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ Error assigning bug.',
        text: '❌ Error assigning bug.',
        error: error.message,
        suggestions: ['Try again', 'Check bug and user IDs']
      };
    }
  }

  /**
   * Get bug statistics
   */
  static async getBugStats(userId) {
    try {
      const teams = await Team.find({
        'members.user': userId
      });
      const userTeamIds = teams.map(team => team._id);
      
      if (userTeamIds.length === 0) {
        return {
          success: true,
          message: '📊 No bug statistics available. You need to be part of a team first.',
          text: '📊 No bug statistics available. You need to be part of a team first.',
          data: { stats: {}, total: 0 },
          suggestions: ['Create a new team', 'Join an existing team']
        };
      }

      const totalBugs = await Bug.countDocuments({ 
        teamId: { $in: userTeamIds }, 
        deleted: false 
      });

      const statusStats = await Bug.aggregate([
        { $match: { teamId: { $in: userTeamIds }, deleted: false } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      const priorityStats = await Bug.aggregate([
        { $match: { teamId: { $in: userTeamIds }, deleted: false } },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]);

      let message = `📊 **Bug Statistics Overview:**\n\n`;
      message += `📈 **Total bugs:** ${totalBugs}\n\n`;
      
      if (totalBugs > 0) {
        message += `**By Status:**\n`;
        statusStats.forEach(stat => {
          const emoji = {
            'open': '🆕',
            'in progress': '⚡',
            'resolved': '✅',
            'closed': '🔒'
          }[stat._id] || '❓';
          const percentage = ((stat.count / totalBugs) * 100).toFixed(1);
          message += `${emoji} ${stat._id}: ${stat.count} (${percentage}%)\n`;
        });

        message += `\n**By Priority:**\n`;
        priorityStats.forEach(stat => {
          const emoji = {
            'critical': '🔴',
            'high': '🟠',
            'medium': '🟡',
            'low': '🟢'
          }[stat._id] || '⚪';
          const percentage = ((stat.count / totalBugs) * 100).toFixed(1);
          message += `${emoji} ${stat._id}: ${stat.count} (${percentage}%)\n`;
        });
      }

      return {
        success: true,
        message: message,
        text: message,
        data: {
          total: totalBugs,
          statusStats: statusStats,
          priorityStats: priorityStats,
          teams: teams.length
        },
        suggestions: [
          'Show all bugs',
          'Show high priority bugs',
          'Show open bugs',
          'Create a new bug'
        ]
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ Error getting bug statistics.',
        text: '❌ Error getting bug statistics.',
        error: error.message,
        suggestions: ['Try again', 'Show all bugs instead']
      };
    }
  }
}

module.exports = BugIntents;