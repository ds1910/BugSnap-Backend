const Team = require('../../model/team');
const User = require('../../model/user');
const Bug = require('../../model/bug');
const mongoose = require('mongoose');

/**
 * Enhanced Team Intents Handler
 * Supports comprehensive team management operations including:
 * - Team CRUD operations
 * - Member management
 * - Team analytics and statistics
 * - Role management
 * - Team performance metrics
 */
class EnhancedTeamIntents {

  /**
   * Get all teams for a user with detailed information
   */
  static async getUserTeams(userId, includeStats = false) {
    try {
      const teams = await Team.find({
        'members.user': userId
      })
      .populate('createdBy', 'name email')
      .populate('members.user', 'name email')
      .lean();

      if (teams.length === 0) {
        return {
          success: true,
          message: 'You are not a member of any teams yet.',
          data: []
        };
      }

      // Add user role and statistics if requested
      const enrichedTeams = await Promise.all(teams.map(async (team) => {
        // Find user's role in this team
        const userMember = team.members.find(member => 
          member.user._id.toString() === userId.toString()
        );

        const enrichedTeam = {
          ...team,
          userRole: userMember ? userMember.role : 'member',
          memberCount: team.members.length
        };

        // Add statistics if requested
        if (includeStats) {
          const stats = await this.getTeamStatistics(team._id);
          enrichedTeam.statistics = stats;
        }

        return enrichedTeam;
      }));

      return {
        success: true,
        message: `Found ${teams.length} team${teams.length === 1 ? '' : 's'}.`,
        data: enrichedTeams
      };

    } catch (error) {
    // console.error('Error in getUserTeams:', error);
      return {
        success: false,
        message: 'Error retrieving your teams.',
        error: error.message
      };
    }
  }

  /**
   * Create a new team with enhanced validation
   */
  static async createTeam(teamData, userId) {
    try {
      // Validate required fields
      if (!teamData.name) {
        return {
          success: false,
          message: 'Team name is required.'
        };
      }

      // Check if user already has a team with this name
      const existingTeam = await Team.findOne({
        name: teamData.name,
        createdBy: userId
      });

      if (existingTeam) {
        return {
          success: false,
          message: 'You already have a team with this name.'
        };
      }

      // Check for team name conflicts (optional: global uniqueness)
      const globalConflict = await Team.findOne({
        name: { $regex: new RegExp(`^${teamData.name}$`, 'i') }
      });

      if (globalConflict) {
        return {
          success: false,
          message: 'A team with this name already exists. Please choose a different name.'
        };
      }

      // Create the team
      const newTeam = await Team.create({
        name: teamData.name,
        description: teamData.description || '',
        createdBy: userId,
        members: [{ user: userId, role: 'admin' }]
      });

      // Populate the created team
      const populatedTeam = await Team.findById(newTeam._id)
        .populate('createdBy', 'name email')
        .populate('members.user', 'name email')
        .lean();

      return {
        success: true,
        message: `Team "${teamData.name}" created successfully.`,
        data: populatedTeam
      };

    } catch (error) {
    // console.error('Error in createTeam:', error);
      return {
        success: false,
        message: 'Error creating team. Please try again.',
        error: error.message
      };
    }
  }

  /**
   * Get team members with detailed information
   */
  static async getTeamMembers(teamId, userId) {
    try {
      // Find the team and check membership
      const team = await Team.findById(teamId)
        .populate('members.user', 'name email image')
        .lean();

      if (!team) {
        return {
          success: false,
          message: 'Team not found.'
        };
      }

      // Check if user is a member
      const isMember = team.members.some(member => 
        member.user._id.toString() === userId.toString()
      );

      if (!isMember) {
        return {
          success: false,
          message: 'You must be a team member to view members.'
        };
      }

      // Get additional member statistics
      const enrichedMembers = await Promise.all(team.members.map(async (member) => {
        // Get member's bug statistics for this team
        const bugStats = await Bug.aggregate([
          {
            $match: {
              teamId: team._id,
              $or: [
                { createdBy: member.user._id },
                { assignedTo: { $in: [member.user._id] } }
              ]
            }
          },
          {
            $group: {
              _id: null,
              created: {
                $sum: { $cond: [{ $eq: ['$createdBy', member.user._id] }, 1, 0] }
              },
              assigned: {
                $sum: { $cond: [{ $in: [member.user._id, '$assignedTo'] }, 1, 0] }
              },
              resolved: {
                $sum: { 
                  $cond: [
                    { 
                      $and: [
                        { $in: [member.user._id, '$assignedTo'] },
                        { $in: ['$status', ['closed', 'resolved']] }
                      ]
                    }, 
                    1, 
                    0
                  ]
                }
              }
            }
          }
        ]);

        return {
          ...member,
          statistics: bugStats[0] || { created: 0, assigned: 0, resolved: 0 }
        };
      }));

      return {
        success: true,
        message: `Found ${team.members.length} member${team.members.length === 1 ? '' : 's'}.`,
        data: {
          teamId: team._id,
          teamName: team.name,
          members: enrichedMembers
        }
      };

    } catch (error) {
    // console.error('Error in getTeamMembers:', error);
      return {
        success: false,
        message: 'Error retrieving team members.',
        error: error.message
      };
    }
  }

  /**
   * Add member to team with validation
   */
  static async addMemberToTeam(teamId, memberIdentifier, role = 'member', requesterId) {
    try {
      // Find the team
      const team = await Team.findById(teamId);
      
      if (!team) {
        return {
          success: false,
          message: 'Team not found.'
        };
      }

      // Check if requester is an admin
      const requesterMember = team.members.find(member => 
        member.user.toString() === requesterId.toString()
      );

      if (!requesterMember || requesterMember.role !== 'admin') {
        return {
          success: false,
          message: 'Only team admins can add members.'
        };
      }

      // Find the user to add
      let userToAdd;
      if (mongoose.isValidObjectId(memberIdentifier)) {
        userToAdd = await User.findById(memberIdentifier);
      } else {
        // Try to find by email or name
        userToAdd = await User.findOne({
          $or: [
            { email: memberIdentifier },
            { name: { $regex: new RegExp(memberIdentifier, 'i') } }
          ]
        });
      }

      if (!userToAdd) {
        return {
          success: false,
          message: 'User not found. Please check the email or name.',
          suggestions: ['Make sure the user has registered on the platform']
        };
      }

      // Check if user is already a member
      const existingMember = team.members.find(member => 
        member.user.toString() === userToAdd._id.toString()
      );

      if (existingMember) {
        return {
          success: false,
          message: `${userToAdd.name} is already a member of this team.`
        };
      }

      // Add the member
      team.members.push({ user: userToAdd._id, role });
      await team.save();

      // Return updated team
      const updatedTeam = await Team.findById(teamId)
        .populate('members.user', 'name email')
        .lean();

      return {
        success: true,
        message: `${userToAdd.name} has been added to the team as ${role}.`,
        data: updatedTeam
      };

    } catch (error) {
    // console.error('Error in addMemberToTeam:', error);
      return {
        success: false,
        message: 'Error adding member to team.',
        error: error.message
      };
    }
  }

  /**
   * Remove member from team
   */
  static async removeMemberFromTeam(teamId, memberId, requesterId) {
    try {
      const team = await Team.findById(teamId);
      
      if (!team) {
        return {
          success: false,
          message: 'Team not found.'
        };
      }

      // Check permissions
      const requesterMember = team.members.find(member => 
        member.user.toString() === requesterId.toString()
      );

      const memberToRemove = team.members.find(member => 
        member.user.toString() === memberId.toString()
      );

      if (!memberToRemove) {
        return {
          success: false,
          message: 'Member not found in team.'
        };
      }

      // Allow self-removal or admin removal
      const canRemove = requesterId.toString() === memberId.toString() || 
                       (requesterMember && requesterMember.role === 'admin');

      if (!canRemove) {
        return {
          success: false,
          message: 'You can only remove yourself or you must be an admin to remove others.'
        };
      }

      // Prevent removing the last admin
      const adminCount = team.members.filter(member => member.role === 'admin').length;
      if (memberToRemove.role === 'admin' && adminCount === 1) {
        return {
          success: false,
          message: 'Cannot remove the last admin. Please promote another member to admin first.'
        };
      }

      // Remove the member
      team.members = team.members.filter(member => 
        member.user.toString() !== memberId.toString()
      );
      await team.save();

      // Get member name for response
      const removedUser = await User.findById(memberId, 'name').lean();

      return {
        success: true,
        message: `${removedUser?.name || 'Member'} has been removed from the team.`,
        data: team
      };

    } catch (error) {
    // console.error('Error in removeMemberFromTeam:', error);
      return {
        success: false,
        message: 'Error removing member from team.',
        error: error.message
      };
    }
  }

  /**
   * Update member role
   */
  static async updateMemberRole(teamId, memberId, newRole, requesterId) {
    try {
      const team = await Team.findById(teamId);
      
      if (!team) {
        return {
          success: false,
          message: 'Team not found.'
        };
      }

      // Check if requester is admin
      const requesterMember = team.members.find(member => 
        member.user.toString() === requesterId.toString()
      );

      if (!requesterMember || requesterMember.role !== 'admin') {
        return {
          success: false,
          message: 'Only team admins can update member roles.'
        };
      }

      // Find member to update
      const memberToUpdate = team.members.find(member => 
        member.user.toString() === memberId.toString()
      );

      if (!memberToUpdate) {
        return {
          success: false,
          message: 'Member not found in team.'
        };
      }

      // Validate role
      if (!['member', 'admin'].includes(newRole)) {
        return {
          success: false,
          message: 'Invalid role. Role must be "member" or "admin".'
        };
      }

      // Prevent demoting the last admin
      if (memberToUpdate.role === 'admin' && newRole === 'member') {
        const adminCount = team.members.filter(member => member.role === 'admin').length;
        if (adminCount === 1) {
          return {
            success: false,
            message: 'Cannot demote the last admin. Please promote another member first.'
          };
        }
      }

      // Update the role
      memberToUpdate.role = newRole;
      await team.save();

      // Get updated member info
      const updatedUser = await User.findById(memberId, 'name').lean();

      return {
        success: true,
        message: `${updatedUser?.name || 'Member'} role updated to ${newRole}.`,
        data: team
      };

    } catch (error) {
    // console.error('Error in updateMemberRole:', error);
      return {
        success: false,
        message: 'Error updating member role.',
        error: error.message
      };
    }
  }

  /**
   * Get team statistics and analytics
   */
  static async getTeamStatistics(teamId) {
    try {
      // Get basic team info
      const team = await Team.findById(teamId).lean();
      
      if (!team) {
        return null;
      }

      // Get bug statistics
      const bugStats = await Bug.aggregate([
        { $match: { teamId: team._id } },
        {
          $group: {
            _id: null,
            totalBugs: { $sum: 1 },
            openBugs: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
            inProgressBugs: { $sum: { $cond: [{ $eq: ['$status', 'in progress'] }, 1, 0] } },
            closedBugs: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
            resolvedBugs: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
            highPriorityBugs: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } },
            criticalBugs: { $sum: { $cond: [{ $eq: ['$priority', 'critical'] }, 1, 0] } },
            avgResolutionTime: { $avg: '$resolutionTime' }
          }
        }
      ]);

      // Get member activity
      const memberActivity = await Bug.aggregate([
        { $match: { teamId: team._id } },
        { $unwind: { path: '$assignedTo', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$assignedTo',
            assignedCount: { $sum: 1 },
            resolvedCount: { 
              $sum: { $cond: [{ $in: ['$status', ['closed', 'resolved']] }, 1, 0] }
            }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }
      ]);

      const stats = bugStats[0] || {
        totalBugs: 0,
        openBugs: 0,
        inProgressBugs: 0,
        closedBugs: 0,
        resolvedBugs: 0,
        highPriorityBugs: 0,
        criticalBugs: 0,
        avgResolutionTime: 0
      };

      return {
        teamInfo: {
          id: team._id,
          name: team.name,
          memberCount: team.members.length,
          createdAt: team.createdAt
        },
        bugStatistics: stats,
        memberActivity: memberActivity,
        completionRate: stats.totalBugs > 0 ? 
          Math.round(((stats.closedBugs + stats.resolvedBugs) / stats.totalBugs) * 100) : 0
      };

    } catch (error) {
    // console.error('Error in getTeamStatistics:', error);
      return null;
    }
  }

  /**
   * Get team performance metrics
   */
  static async getTeamPerformanceMetrics(teamId, timeframe = 'month') {
    try {
      // Calculate time range
      const now = new Date();
      let startDate;
      
      switch (timeframe) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'quarter':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const metrics = await Bug.aggregate([
        {
          $match: {
            teamId: mongoose.Types.ObjectId(teamId),
            createdAt: { $gte: startDate }
          }
        },
        {
          $facet: {
            creationTrend: [
              {
                $group: {
                  _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                  },
                  count: { $sum: 1 }
                }
              },
              { $sort: { '_id': 1 } }
            ],
            resolutionTrend: [
              {
                $match: {
                  status: { $in: ['closed', 'resolved'] },
                  updatedAt: { $gte: startDate }
                }
              },
              {
                $group: {
                  _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' }
                  },
                  count: { $sum: 1 }
                }
              },
              { $sort: { '_id': 1 } }
            ],
            priorityDistribution: [
              {
                $group: {
                  _id: '$priority',
                  count: { $sum: 1 }
                }
              }
            ],
            statusDistribution: [
              {
                $group: {
                  _id: '$status',
                  count: { $sum: 1 }
                }
              }
            ]
          }
        }
      ]);

      return {
        success: true,
        message: `Team performance metrics for the last ${timeframe}`,
        data: metrics[0],
        timeframe,
        startDate
      };

    } catch (error) {
    // console.error('Error in getTeamPerformanceMetrics:', error);
      return {
        success: false,
        message: 'Error retrieving team performance metrics.',
        error: error.message
      };
    }
  }

  /**
   * Search teams with filters
   */
  static async searchTeams(userId, searchCriteria) {
    try {
      const query = {
        'members.user': userId
      };

      // Add search filters
      if (searchCriteria.name) {
        query.name = { $regex: searchCriteria.name, $options: 'i' };
      }

      if (searchCriteria.role) {
        query['members'] = {
          $elemMatch: {
            user: userId,
            role: searchCriteria.role
          }
        };
      }

      const teams = await Team.find(query)
        .populate('createdBy', 'name email')
        .populate('members.user', 'name email')
        .lean();

      return {
        success: true,
        message: `Found ${teams.length} team${teams.length === 1 ? '' : 's'}.`,
        data: teams
      };

    } catch (error) {
    // console.error('Error in searchTeams:', error);
      return {
        success: false,
        message: 'Error searching teams.',
        error: error.message
      };
    }
  }

  /**
   * Delete team (admin only)
   */
  static async deleteTeam(teamId, requesterId) {
    try {
      const team = await Team.findById(teamId);
      
      if (!team) {
        return {
          success: false,
          message: 'Team not found.'
        };
      }

      // Check if requester is admin or creator
      const isCreator = team.createdBy.toString() === requesterId.toString();
      const requesterMember = team.members.find(member => 
        member.user.toString() === requesterId.toString()
      );
      const isAdmin = requesterMember && requesterMember.role === 'admin';

      if (!isCreator && !isAdmin) {
        return {
          success: false,
          message: 'Only team creators or admins can delete teams.'
        };
      }

      // Check if team has active bugs
      const activeBugsCount = await Bug.countDocuments({
        teamId: teamId,
        status: { $in: ['open', 'in progress'] }
      });

      if (activeBugsCount > 0) {
        return {
          success: false,
          message: `Cannot delete team with ${activeBugsCount} active bug${activeBugsCount === 1 ? '' : 's'}. Please resolve or reassign them first.`,
          activeBugsCount
        };
      }

      // Delete the team
      await Team.findByIdAndDelete(teamId);

      return {
        success: true,
        message: `Team "${team.name}" has been deleted successfully.`
      };

    } catch (error) {
    // console.error('Error in deleteTeam:', error);
      return {
        success: false,
        message: 'Error deleting team.',
        error: error.message
      };
    }
  }
}

module.exports = EnhancedTeamIntents;
