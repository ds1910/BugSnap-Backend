const Team = require('../../model/team');
const User = require('../../model/user');
const Bug = require('../../model/bug');
const Invite = require('../../model/invite');

/**
 * Team-related intent handlers for AI Agent
 * Handles team management, analytics, and collaboration features
 */
class TeamIntents {

  /**
   * Get all teams for a user
   */
  static async getUserTeams(userId) {
    try {
      // Find teams where the user is a member
      const teams = await Team.find({
        'members.user': userId
      }).populate({
        path: 'members.user',
        select: 'name email avatar'
      });

      if (teams.length === 0) {
        return {
          success: true,
          teams: [],
          count: 0,
          message: 'You are not a member of any teams'
        };
      }

      // Get statistics for each team
      const teamsWithStats = await Promise.all(teams.map(async (team) => {
        const [totalBugs, openBugs, closedBugs, highPriorityBugs] = await Promise.all([
          Bug.countDocuments({ teamId: team._id, deleted: false }),
          Bug.countDocuments({ teamId: team._id, status: 'Open', deleted: false }),
          Bug.countDocuments({ teamId: team._id, status: 'Closed', deleted: false }),
          Bug.countDocuments({ teamId: team._id, priority: 'High', status: { $ne: 'Closed' }, deleted: false })
        ]);

        return {
          ...team.toObject(),
          statistics: {
            totalBugs,
            openBugs,
            closedBugs,
            highPriorityBugs,
            memberCount: team.members.length,
            resolutionRate: totalBugs > 0 ? (closedBugs / totalBugs * 100).toFixed(1) : 0
          }
        };
      }));

      return {
        success: true,
        teams: teamsWithStats,
        count: teamsWithStats.length,
        message: `You are member of ${teamsWithStats.length} teams`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching user teams',
        error: error.message
      };
    }
  }

  /**
   * Get detailed team information
   */
  static async getTeamDetails(userId, teamId) {
    try {
      // Verify user has access to this team
      const team = await Team.findOne({
        _id: teamId,
        'members.user': userId
      }).populate({
        path: 'members.user',
        select: 'name email avatar createdAt'
      }).populate('createdBy', 'name email');

      if (!team) {
        return { success: false, message: 'Team not found or access denied' };
      }

      // Get comprehensive team statistics
      const [
        totalBugs,
        openBugs,
        closedBugs,
        inProgressBugs,
        highPriorityBugs,
        mediumPriorityBugs,
        lowPriorityBugs,
        recentBugs,
        bugsByStatus,
        bugsByPriority,
        memberActivity,
        averageResolutionTime
      ] = await Promise.all([
        Bug.countDocuments({ teamId: teamId, deleted: false }),
        Bug.countDocuments({ teamId: teamId, status: 'Open', deleted: false }),
        Bug.countDocuments({ teamId: teamId, status: 'Closed', deleted: false }),
        Bug.countDocuments({ teamId: teamId, status: 'In Progress', deleted: false }),
        Bug.countDocuments({ teamId: teamId, priority: 'High', deleted: false }),
        Bug.countDocuments({ teamId: teamId, priority: 'Medium', deleted: false }),
        Bug.countDocuments({ teamId: teamId, priority: 'Low', deleted: false }),
        Bug.countDocuments({ 
          teamId: teamId, 
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          deleted: false 
        }),
        Bug.aggregate([
          { $match: { teamId: teamId, deleted: false } },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        Bug.aggregate([
          { $match: { team: teamId, deleted: false } },
          { $group: { _id: '$priority', count: { $sum: 1 } } }
        ]),
        Promise.all(team.members.map(async (member) => {
          const [created, assigned, resolved] = await Promise.all([
            Bug.countDocuments({ team: teamId, creator: member._id, deleted: false }),
            Bug.countDocuments({ team: teamId, assignee: member._id, deleted: false }),
            Bug.countDocuments({ team: teamId, assignee: member._id, status: 'Closed', deleted: false })
          ]);
          
          return {
            user: {
              id: member._id,
              name: member.name,
              email: member.email,
              avatar: member.avatar
            },
            activity: { created, assigned, resolved }
          };
        })),
        this.calculateAverageResolutionTime(teamId)
      ]);

      const teamDetails = {
        id: team._id,
        name: team.name,
        description: team.description,
        admin: team.admin,
        createdAt: team.createdAt,
        members: team.members,
        statistics: {
          bugs: {
            total: totalBugs,
            open: openBugs,
            closed: closedBugs,
            inProgress: inProgressBugs,
            recent: recentBugs
          },
          priority: {
            high: highPriorityBugs,
            medium: mediumPriorityBugs,
            low: lowPriorityBugs
          },
          distributions: {
            byStatus: bugsByStatus,
            byPriority: bugsByPriority
          },
          performance: {
            resolutionRate: totalBugs > 0 ? (closedBugs / totalBugs * 100).toFixed(1) : 0,
            averageResolutionTime: averageResolutionTime,
            memberCount: team.members.length
          }
        },
        memberActivity
      };

      return {
        success: true,
        team: teamDetails,
        message: `Team ${team.name} details retrieved`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching team details',
        error: error.message
      };
    }
  }

  /**
   * Create a new team
   */
  static async createTeam(userId, teamData) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      const newTeam = new Team({
        name: teamData.name,
        description: teamData.description || '',
        createdBy: userId,
        members: [{
          user: userId,
          role: 'admin'
        }]
      });

      const savedTeam = await newTeam.save();

      await savedTeam.populate('createdBy', 'name email');

      return {
        success: true,
        team: savedTeam,
        message: `Team "${savedTeam.name}" created successfully`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error creating team',
        error: error.message
      };
    }
  }

  /**
   * Invite user to team
   */
  static async inviteUserToTeam(userId, teamId, inviteData) {
    try {
      const team = await Team.findById(teamId);
      if (!team) {
        return { success: false, message: 'Team not found' };
      }

      // Check if user is admin of the team
      const userMembership = team.members.find(member => 
        member.user.toString() === userId && member.role === 'admin'
      );
      
      if (!userMembership) {
        return { success: false, message: 'Only team admin can invite members' };
      }

      // Check if user already exists
      let invitedUser = await User.findOne({ email: inviteData.email });
      
      if (invitedUser) {
        // Check if already a member
        const isAlreadyMember = team.members.some(member => 
          member.user.toString() === invitedUser._id.toString()
        );
        
        if (isAlreadyMember) {
          return { success: false, message: 'User is already a team member' };
        }

        // Add to team directly
        await Team.findByIdAndUpdate(teamId, {
          $addToSet: { 
            members: {
              user: invitedUser._id,
              role: 'member'
            }
          }
        });

        return {
          success: true,
          message: `${invitedUser.name} added to team ${team.name}`,
          action: 'direct_add'
        };
      } else {
        // Create invitation for new user
        const existingInvite = await Invite.findOne({
          email: inviteData.email,
          team: teamId,
          status: 'pending'
        });

        if (existingInvite) {
          return { success: false, message: 'Invitation already sent to this email' };
        }

        const newInvite = new Invite({
          email: inviteData.email,
          team: teamId,
          invitedBy: userId,
          message: inviteData.message || `You've been invited to join ${team.name}`,
          status: 'pending',
          createdAt: new Date()
        });

        await newInvite.save();

        return {
          success: true,
          invite: newInvite,
          message: `Invitation sent to ${inviteData.email}`,
          action: 'invite_sent'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Error inviting user to team',
        error: error.message
      };
    }
  }

  /**
   * Get team performance analytics
   */
  static async getTeamAnalytics(userId, teamId, timeRange = '30days') {
    try {
      // Verify access
      const user = await User.findById(userId).populate('teams');
      const hasAccess = user.teams.some(team => team._id.toString() === teamId);

      if (!hasAccess) {
        return { success: false, message: 'Access denied to this team' };
      }

      // Calculate date range
      let dateFrom;
      switch (timeRange) {
        case '7days':
          dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90days':
          dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }

      const team = await Team.findById(teamId).populate('members', 'name email');

      const [
        bugsCreated,
        bugsResolved,
        avgResolutionTime,
        bugTrends,
        memberProductivity,
        priorityDistribution,
        statusProgression
      ] = await Promise.all([
        Bug.countDocuments({ 
          team: teamId, 
          createdAt: { $gte: dateFrom },
          deleted: false 
        }),
        Bug.countDocuments({ 
          team: teamId, 
          status: 'Closed',
          updatedAt: { $gte: dateFrom },
          deleted: false 
        }),
        this.calculateAverageResolutionTime(teamId, dateFrom),
        this.getBugTrends(teamId, dateFrom),
        this.getMemberProductivity(teamId, dateFrom),
        Bug.aggregate([
          { 
            $match: { 
              team: teamId, 
              createdAt: { $gte: dateFrom },
              deleted: false 
            } 
          },
          { $group: { _id: '$priority', count: { $sum: 1 } } }
        ]),
        this.getStatusProgression(teamId, dateFrom)
      ]);

      const analytics = {
        team: {
          id: team._id,
          name: team.name,
          memberCount: team.members.length
        },
        timeRange,
        summary: {
          bugsCreated,
          bugsResolved,
          resolutionRate: bugsCreated > 0 ? (bugsResolved / bugsCreated * 100).toFixed(1) : 0,
          avgResolutionTime,
          productivity: this.calculateProductivityScore(bugsCreated, bugsResolved, avgResolutionTime)
        },
        trends: bugTrends,
        memberProductivity,
        distributions: {
          priority: priorityDistribution,
          statusProgression
        }
      };

      return {
        success: true,
        analytics,
        message: `Team analytics for ${timeRange}`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching team analytics',
        error: error.message
      };
    }
  }

  /**
   * Remove member from team
   */
  static async removeMember(userId, teamId, memberId) {
    try {
      const team = await Team.findById(teamId);
      if (!team) {
        return { success: false, message: 'Team not found' };
      }

      // Check if user is admin
      if (team.admin.toString() !== userId) {
        return { success: false, message: 'Only team admin can remove members' };
      }

      // Can't remove admin
      if (memberId === team.admin.toString()) {
        return { success: false, message: 'Cannot remove team admin' };
      }

      // Remove from team
      await Team.findByIdAndUpdate(teamId, {
        $pull: { members: memberId }
      });

      // Remove team from user
      await User.findByIdAndUpdate(memberId, {
        $pull: { teams: teamId }
      });

      const removedUser = await User.findById(memberId).select('name email');

      return {
        success: true,
        message: `${removedUser.name} removed from team`,
        removedUser: {
          id: removedUser._id,
          name: removedUser.name,
          email: removedUser.email
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error removing team member',
        error: error.message
      };
    }
  }

  /**
   * Helper method to calculate average resolution time
   */
  static async calculateAverageResolutionTime(teamId, dateFrom = null) {
    try {
      const matchQuery = {
        team: teamId,
        status: 'Closed',
        closedAt: { $exists: true },
        deleted: false
      };

      if (dateFrom) {
        matchQuery.closedAt = { $gte: dateFrom };
      }

      const result = await Bug.aggregate([
        { $match: matchQuery },
        {
          $project: {
            resolutionTime: {
              $subtract: ['$closedAt', '$createdAt']
            }
          }
        },
        {
          $group: {
            _id: null,
            avgTime: { $avg: '$resolutionTime' }
          }
        }
      ]);

      if (result.length === 0) return 0;

      // Convert milliseconds to days
      return Math.round(result[0].avgTime / (1000 * 60 * 60 * 24) * 10) / 10;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Helper method to get bug trends
   */
  static async getBugTrends(teamId, dateFrom) {
    try {
      const dailyBugs = await Bug.aggregate([
        {
          $match: {
            team: teamId,
            createdAt: { $gte: dateFrom },
            deleted: false
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            created: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const dailyResolved = await Bug.aggregate([
        {
          $match: {
            team: teamId,
            status: 'Closed',
            updatedAt: { $gte: dateFrom },
            deleted: false
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' }
            },
            resolved: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      return { dailyBugs, dailyResolved };
    } catch (error) {
      return { dailyBugs: [], dailyResolved: [] };
    }
  }

  /**
   * Helper method to get member productivity
   */
  static async getMemberProductivity(teamId, dateFrom) {
    try {
      const team = await Team.findById(teamId).populate('members', 'name email');
      
      const productivity = await Promise.all(team.members.map(async (member) => {
        const [created, resolved, assigned] = await Promise.all([
          Bug.countDocuments({
            team: teamId,
            creator: member._id,
            createdAt: { $gte: dateFrom },
            deleted: false
          }),
          Bug.countDocuments({
            team: teamId,
            assignee: member._id,
            status: 'Closed',
            updatedAt: { $gte: dateFrom },
            deleted: false
          }),
          Bug.countDocuments({
            team: teamId,
            assignee: member._id,
            deleted: false
          })
        ]);

        return {
          user: {
            id: member._id,
            name: member.name,
            email: member.email
          },
          metrics: {
            created,
            resolved,
            assigned,
            resolutionRate: assigned > 0 ? (resolved / assigned * 100).toFixed(1) : 0
          }
        };
      }));

      return productivity;
    } catch (error) {
      return [];
    }
  }

  /**
   * Helper method to get status progression
   */
  static async getStatusProgression(teamId, dateFrom) {
    try {
      return await Bug.aggregate([
        {
          $match: {
            teamId: teamId,
            updatedAt: { $gte: dateFrom },
            deleted: false
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
              status: '$status'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]);
    } catch (error) {
      return [];
    }
  }

  /**
   * Helper method to calculate productivity score
   */
  static calculateProductivityScore(created, resolved, avgResolutionTime) {
    if (created === 0) return 0;
    
    const resolutionRate = resolved / created;
    const timeScore = avgResolutionTime > 0 ? Math.max(0, 10 - avgResolutionTime) / 10 : 0;
    
    return Math.round((resolutionRate * 0.7 + timeScore * 0.3) * 100);
  }

  /**
   * Helper method to calculate average resolution time for a team
   */
  static async calculateAverageResolutionTime(teamId) {
    try {
      const result = await Bug.aggregate([
        {
          $match: {
            teamId: teamId,
            status: 'Closed',
            deleted: false,
            closedAt: { $exists: true }
          }
        },
        {
          $addFields: {
            resolutionTime: {
              $divide: [
                { $subtract: ['$closedAt', '$createdAt'] },
                1000 * 60 * 60 * 24 // Convert to days
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            avgResolutionTime: { $avg: '$resolutionTime' }
          }
        }
      ]);
      
      return result.length > 0 ? result[0].avgResolutionTime : null;
    } catch (error) {
    // console.error('Error calculating average resolution time:', error);
      return null;
    }
  }
}

module.exports = TeamIntents;
