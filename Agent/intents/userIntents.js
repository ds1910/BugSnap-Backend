const User = require('../../model/user');
const Team = require('../../model/team');
const Bug = require('../../model/bug');

/**
 * User-related intent handlers for AI Agent
 * Handles user profiles, authentication, and user management
 */
class UserIntents {

  /**
   * Get user profile information
   */
  static async getUserProfile(userId, targetUserId = null) {
    try {
      const searchUserId = targetUserId || userId;
      
      const user = await User.findById(searchUserId)
        .populate('teams', 'name description role')
        .select('-password -resetToken');

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Get user statistics
      const [bugsCreated, bugsAssigned, teamsCount] = await Promise.all([
        Bug.countDocuments({ creator: searchUserId, deleted: false }),
        Bug.countDocuments({ assignee: searchUserId, deleted: false }),
        user.teams.length
      ]);

      const profileData = {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        joinedDate: user.createdAt,
        teams: user.teams,
        statistics: {
          bugsCreated,
          bugsAssigned,
          teamsCount,
          activeBugs: await Bug.countDocuments({ 
            assignee: searchUserId, 
            status: 'Open',
            deleted: false 
          })
        }
      };

      return {
        success: true,
        user: profileData,
        message: targetUserId ? `Profile for ${user.name}` : 'Your profile information'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching user profile',
        error: error.message
      };
    }
  }

  /**
   * Search users within accessible teams
   */
  static async searchUsers(userId, searchQuery, filters = {}) {
    try {
      const currentUser = await User.findById(userId).populate('teams');
      const userTeamIds = currentUser.teams.map(team => team._id);

      // Build search query
      const searchConditions = {
        _id: { $ne: userId }, // Exclude current user
        teams: { $in: userTeamIds } // Only users in shared teams
      };

      if (searchQuery) {
        searchConditions.$or = [
          { name: { $regex: searchQuery, $options: 'i' } },
          { email: { $regex: searchQuery, $options: 'i' } }
        ];
      }

      // Apply filters
      if (filters.teamId) {
        searchConditions.teams = filters.teamId;
      }

      const users = await User.find(searchConditions)
        .populate('teams', 'name')
        .select('name email avatar createdAt teams')
        .limit(20);

      // Get additional info for each user
      const usersWithStats = await Promise.all(users.map(async (user) => {
        const [bugsCreated, bugsAssigned] = await Promise.all([
          Bug.countDocuments({ creator: user._id, deleted: false }),
          Bug.countDocuments({ assignee: user._id, deleted: false })
        ]);

        return {
          ...user.toObject(),
          statistics: {
            bugsCreated,
            bugsAssigned
          }
        };
      }));

      return {
        success: true,
        users: usersWithStats,
        count: usersWithStats.length,
        message: `Found ${usersWithStats.length} users`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error searching users',
        error: error.message
      };
    }
  }

  /**
   * Get team members for a specific team
   */
  static async getTeamMembers(userId, teamId) {
    try {
      // Verify user has access to this team
      const currentUser = await User.findById(userId).populate('teams');
      const hasAccess = currentUser.teams.some(team => team._id.toString() === teamId);

      if (!hasAccess) {
        return { success: false, message: 'Access denied to this team' };
      }

      const team = await Team.findById(teamId).populate('members', 'name email avatar createdAt');
      
      if (!team) {
        return { success: false, message: 'Team not found' };
      }

      // Get statistics for each member
      const membersWithStats = await Promise.all(team.members.map(async (member) => {
        const [bugsCreated, bugsAssigned, activeBugs] = await Promise.all([
          Bug.countDocuments({ creator: member._id, team: teamId, deleted: false }),
          Bug.countDocuments({ assignee: member._id, team: teamId, deleted: false }),
          Bug.countDocuments({ 
            assignee: member._id, 
            team: teamId, 
            status: 'Open',
            deleted: false 
          })
        ]);

        return {
          ...member.toObject(),
          teamStatistics: {
            bugsCreated,
            bugsAssigned,
            activeBugs
          }
        };
      }));

      return {
        success: true,
        team: {
          id: team._id,
          name: team.name,
          description: team.description,
          memberCount: team.members.length
        },
        members: membersWithStats,
        message: `${team.members.length} members in ${team.name}`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching team members',
        error: error.message
      };
    }
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(userId, updateData) {
    try {
      // Filter allowed fields for update
      const allowedFields = ['name', 'avatar'];
      const filteredData = {};
      
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      });

      if (Object.keys(filteredData).length === 0) {
        return { success: false, message: 'No valid fields to update' };
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { ...filteredData, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).select('-password -resetToken');

      return {
        success: true,
        user: updatedUser,
        message: 'Profile updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error updating profile',
        error: error.message
      };
    }
  }

  /**
   * Get user's activity summary
   */
  static async getUserActivity(userId, targetUserId = null, timeRange = '30days') {
    try {
      const searchUserId = targetUserId || userId;
      
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

      const [
        bugsCreated,
        bugsResolved,
        bugsAssigned,
        activeBugs,
        recentBugs
      ] = await Promise.all([
        Bug.countDocuments({ 
          creator: searchUserId, 
          createdAt: { $gte: dateFrom },
          deleted: false 
        }),
        Bug.countDocuments({ 
          assignee: searchUserId, 
          status: 'Closed',
          updatedAt: { $gte: dateFrom },
          deleted: false 
        }),
        Bug.countDocuments({ 
          assignee: searchUserId,
          deleted: false 
        }),
        Bug.countDocuments({ 
          assignee: searchUserId, 
          status: 'Open',
          deleted: false 
        }),
        Bug.find({ 
          $or: [
            { creator: searchUserId },
            { assignee: searchUserId }
          ],
          createdAt: { $gte: dateFrom },
          deleted: false 
        })
        .populate('team', 'name')
        .sort({ createdAt: -1 })
        .limit(10)
      ]);

      const user = await User.findById(searchUserId).select('name email');

      return {
        success: true,
        activity: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email
          },
          timeRange,
          statistics: {
            bugsCreated,
            bugsResolved,
            bugsAssigned,
            activeBugs,
            productivityScore: bugsResolved + (bugsCreated * 0.5)
          },
          recentBugs
        },
        message: `Activity summary for ${timeRange}`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching user activity',
        error: error.message
      };
    }
  }

  /**
   * Get user's workload analysis
   */
  static async getUserWorkload(userId, targetUserId = null) {
    try {
      const searchUserId = targetUserId || userId;
      
      const user = await User.findById(searchUserId).populate('teams', 'name');
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Get workload data
      const [
        totalAssigned,
        highPriorityBugs,
        overduelBugs,
        bugsByStatus,
        bugsByPriority,
        bugsByTeam
      ] = await Promise.all([
        Bug.countDocuments({ assignee: searchUserId, deleted: false }),
        Bug.countDocuments({ 
          assignee: searchUserId, 
          priority: 'High',
          status: { $ne: 'Closed' },
          deleted: false 
        }),
        Bug.countDocuments({ 
          assignee: searchUserId, 
          dueDate: { $lt: new Date() },
          status: { $ne: 'Closed' },
          deleted: false 
        }),
        Bug.aggregate([
          { $match: { assignee: searchUserId, deleted: false } },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        Bug.aggregate([
          { $match: { assignee: searchUserId, deleted: false } },
          { $group: { _id: '$priority', count: { $sum: 1 } } }
        ]),
        Bug.aggregate([
          { $match: { assignee: searchUserId, deleted: false } },
          { $group: { _id: '$team', count: { $sum: 1 } } },
          { $lookup: { from: 'teams', localField: '_id', foreignField: '_id', as: 'teamInfo' } }
        ])
      ]);

      // Calculate workload score (higher = more overloaded)
      const workloadScore = (totalAssigned * 1) + (highPriorityBugs * 2) + (overduelBugs * 3);
      let workloadLevel = 'Light';
      if (workloadScore > 20) workloadLevel = 'Heavy';
      else if (workloadScore > 10) workloadLevel = 'Moderate';

      return {
        success: true,
        workload: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email
          },
          summary: {
            totalAssigned,
            highPriorityBugs,
            overduelBugs,
            workloadScore,
            workloadLevel
          },
          distributions: {
            byStatus: bugsByStatus,
            byPriority: bugsByPriority,
            byTeam: bugsByTeam
          }
        },
        message: `Workload analysis: ${workloadLevel} (${totalAssigned} total bugs)`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error analyzing user workload',
        error: error.message
      };
    }
  }

  /**
   * Get recommended users for bug assignment
   */
  static async getRecommendedAssignees(userId, teamId, bugPriority = 'Medium') {
    try {
      const team = await Team.findById(teamId).populate('members', 'name email avatar');
      
      if (!team) {
        return { success: false, message: 'Team not found' };
      }

      // Verify current user has access to this team
      const currentUser = await User.findById(userId).populate('teams');
      const hasAccess = currentUser.teams.some(t => t._id.toString() === teamId);
      
      if (!hasAccess) {
        return { success: false, message: 'Access denied to this team' };
      }

      // Get workload for each team member
      const membersWithWorkload = await Promise.all(team.members.map(async (member) => {
        const [
          activeBugs,
          highPriorityBugs,
          recentlyResolved
        ] = await Promise.all([
          Bug.countDocuments({ 
            assignee: member._id, 
            team: teamId,
            status: { $ne: 'Closed' },
            deleted: false 
          }),
          Bug.countDocuments({ 
            assignee: member._id, 
            team: teamId,
            priority: 'High',
            status: { $ne: 'Closed' },
            deleted: false 
          }),
          Bug.countDocuments({ 
            assignee: member._id, 
            team: teamId,
            status: 'Closed',
            updatedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            deleted: false 
          })
        ]);

        // Calculate recommendation score (lower = better candidate)
        let score = activeBugs + (highPriorityBugs * 2);
        score -= recentlyResolved; // Bonus for recent productivity
        
        // Penalty for high priority bugs if this is also high priority
        if (bugPriority === 'High' && highPriorityBugs > 2) {
          score += 5;
        }

        return {
          user: {
            id: member._id,
            name: member.name,
            email: member.email,
            avatar: member.avatar
          },
          workload: {
            activeBugs,
            highPriorityBugs,
            recentlyResolved
          },
          recommendationScore: Math.max(0, score),
          reason: this.getRecommendationReason(activeBugs, highPriorityBugs, recentlyResolved)
        };
      }));

      // Sort by recommendation score (ascending - lower is better)
      membersWithWorkload.sort((a, b) => a.recommendationScore - b.recommendationScore);

      return {
        success: true,
        recommendations: membersWithWorkload.slice(0, 5), // Top 5 recommendations
        team: {
          id: team._id,
          name: team.name
        },
        message: `Found ${membersWithWorkload.length} potential assignees`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error getting assignee recommendations',
        error: error.message
      };
    }
  }

  /**
   * Helper method to generate recommendation reasons
   */
  static getRecommendationReason(activeBugs, highPriorityBugs, recentlyResolved) {
    if (activeBugs === 0) return 'Available - no active bugs';
    if (activeBugs <= 2) return 'Light workload';
    if (recentlyResolved > 2) return 'High productivity recently';
    if (highPriorityBugs === 0) return 'No high-priority bugs assigned';
    if (activeBugs <= 5) return 'Moderate workload';
    return 'Heavy workload - consider others first';
  }
}

module.exports = UserIntents;
