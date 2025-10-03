const Bug = require('../../model/bug');
const Team = require('../../model/team');
const User = require('../../model/user');
const Comment = require('../../model/comment');
const File = require('../../model/file');
const ActivityLog = require('../../model/activityLog');
const mongoose = require('mongoose');

/**
 * Enhanced Bug Intents Handler
 * Supports all possible bug-related queries including:
 * - CRUD operations (Create, Read, Update, Delete)
 * - Advanced filtering and searching
 * - Analytics and aggregations
 * - Composite operations
 * - Dependent queries
 */
class EnhancedBugIntents {
  
  /**
   * Get all bugs with comprehensive filtering and analytics
   */
  static async getAllBugs(userId, filters = {}, options = {}) {
    try {
      // Get user's teams first
      const userTeams = await Team.find({
        'members.user': userId
      }).select('_id name').lean();

      if (userTeams.length === 0) {
        return {
          success: false,
          message: 'You are not a member of any teams. Please join a team to view bugs.',
          data: []
        };
      }

      const teamIds = userTeams.map(team => team._id);
      
      // Build comprehensive query
      const query = { teamId: { $in: teamIds } };
      
      // Apply filters
      if (filters.status) query.status = filters.status;
      if (filters.priority) query.priority = filters.priority;
      if (filters.assignedTo) query.assignedTo = { $in: [filters.assignedTo] };
      if (filters.createdBy) query.createdBy = filters.createdBy;
      if (filters.teamId) query.teamId = filters.teamId;
      if (filters.tags && filters.tags.length > 0) query.tags = { $in: filters.tags };
      
      // Time-based filters
      if (filters.startDate) query.createdAt = { $gte: filters.startDate };
      if (filters.endDate) {
        if (query.createdAt) {
          query.createdAt.$lte = filters.endDate;
        } else {
          query.createdAt = { $lte: filters.endDate };
        }
      }
      
      // Text search
      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
          { tags: { $regex: filters.search, $options: 'i' } }
        ];
      }

      // Execute query with population
      let bugsQuery = Bug.find(query)
        .populate('createdBy', 'name email')
        .populate('assignedTo', 'name email')
        .populate('teamId', 'name')
        .sort({ createdAt: -1 });
      
      // Apply limit if specified
      if (options.limit) bugsQuery = bugsQuery.limit(options.limit);
      
      const bugs = await bugsQuery.lean();

      // Calculate analytics if requested
      let analytics = null;
      if (options.includeAnalytics) {
        analytics = await this.calculateBugAnalytics(teamIds, filters);
      }

      // Create formatted text response for frontend display
      let responseText = '';
      if (bugs.length > 0) {
        responseText = `📋 **Found ${bugs.length} bug${bugs.length === 1 ? '' : 's'}**\n\n`;
        
        bugs.forEach((bug, index) => {
          responseText += `**${index + 1}. ${bug.title}**\n`;
          responseText += `   • Status: ${bug.status.toUpperCase()}\n`;
          responseText += `   • Priority: ${bug.priority.toUpperCase()}\n`;
          if (bug.assignedTo && bug.assignedTo.length > 0) {
            responseText += `   • Assigned to: ${bug.assignedTo.map(u => u.name).join(', ')}\n`;
          }
          if (bug.teamId) {
            responseText += `   • Team: ${bug.teamId.name}\n`;
          }
          responseText += `   • Created: ${new Date(bug.createdAt).toLocaleDateString()}\n`;
          if (bug.description) {
            responseText += `   • Description: ${bug.description.substring(0, 100)}${bug.description.length > 100 ? '...' : ''}\n`;
          }
          responseText += '\n';
        });
        
        if (analytics) {
          responseText += `\n📊 **Quick Stats:**\n`;
          responseText += `   • Open: ${analytics.statusCounts.open || 0}\n`;
          responseText += `   • In Progress: ${analytics.statusCounts['in-progress'] || 0}\n`;
          responseText += `   • Resolved: ${analytics.statusCounts.resolved || 0}\n`;
          responseText += `   • Closed: ${analytics.statusCounts.closed || 0}\n`;
        }
      } else {
        responseText = '🔍 No bugs found matching your criteria.\n\nTry:\n• "Show all bugs"\n• "Show high priority bugs"\n• "Show open bugs"\n• "Create a new bug"';
      }

      const message = bugs.length > 0 
        ? `Found ${bugs.length} bug${bugs.length === 1 ? '' : 's'}.`
        : 'No bugs found matching your criteria.';

      return {
        success: true,
        message,
        text: responseText,  // Added text field for frontend display
        data: bugs,
        analytics,
        totalCount: bugs.length,
        filters: filters
      };

    } catch (error) {
    // console.error('Error in getAllBugs:', error);
      return {
        success: false,
        message: 'Error retrieving bugs. Please try again.',
        text: '❌ **Error retrieving bugs**\n\nPlease try again or contact support if the problem persists.',
        error: error.message
      };
    }
  }

  /**
   * Advanced bug search with multiple criteria
   */
  static async searchBugs(userId, searchCriteria) {
    try {
      const filters = this.parseSearchCriteria(searchCriteria);
      return await this.getAllBugs(userId, filters, { includeAnalytics: false });
    } catch (error) {
    // console.error('Error in searchBugs:', error);
      return {
        success: false,
        message: 'Error searching bugs. Please try again.',
        text: '❌ **Error searching bugs**\n\nPlease try again or contact support if the problem persists.',
        error: error.message
      };
    }
  }

  /**
   * Get bugs by specific criteria with natural language parsing
   */
  static async getBugsByCriteria(userId, criteria) {
    try {
      const filters = this.parseCriteriaString(criteria);
      const options = { includeAnalytics: true };
      
      return await this.getAllBugs(userId, filters, options);
    } catch (error) {
    // console.error('Error in getBugsByCriteria:', error);
      return {
        success: false,
        message: 'Error retrieving bugs by criteria. Please try again.',
        text: '❌ **Error retrieving bugs**\n\nPlease try again or contact support if the problem persists.',
        error: error.message
      };
    }
  }

  /**
   * Create bug with enhanced validation and team resolution
   */
  static async createBug(bugData, userId) {
    try {
      // Validate required fields
      if (!bugData.title) {
        return {
          success: false,
          message: 'Bug title is required.'
        };
      }

      // Auto-resolve team if not provided
      if (!bugData.teamId) {
        const userTeams = await Team.find({
          'members.user': userId
        }).lean();

        if (userTeams.length === 0) {
          return {
            success: false,
            message: 'You must be a member of a team to create bugs. Please join a team first.'
          };
        }

        if (userTeams.length === 1) {
          bugData.teamId = userTeams[0]._id;
        } else {
          return {
            success: false,
            message: 'Please specify which team this bug should be created for.',
            needsTeamSelection: true,
            availableTeams: userTeams.map(team => ({ id: team._id, name: team.name }))
          };
        }
      }

      // Validate team membership
      const team = await Team.findOne({
        _id: bugData.teamId,
        'members.user': userId
      });

      if (!team) {
        return {
          success: false,
          message: 'You are not a member of the specified team.'
        };
      }

      // Check for duplicate bug titles in team
      const existingBug = await Bug.findOne({
        title: bugData.title,
        teamId: bugData.teamId
      });

      if (existingBug) {
        return {
          success: false,
          message: 'A bug with this title already exists in the team.'
        };
      }

      // Create the bug
      const newBug = await Bug.create({
        title: bugData.title,
        description: bugData.description || '',
        teamId: bugData.teamId,
        priority: bugData.priority || 'medium',
        status: bugData.status || 'open',
        createdBy: userId,
        assignedTo: bugData.assignedTo || [],
        tags: bugData.tags || [],
        startDate: bugData.startDate,
        dueDate: bugData.dueDate
      });

      // Populate the created bug
      const populatedBug = await Bug.findById(newBug._id)
        .populate('createdBy', 'name email')
        .populate('assignedTo', 'name email')
        .populate('teamId', 'name')
        .lean();

      return {
        success: true,
        message: `Bug "${bugData.title}" created successfully.`,
        data: populatedBug
      };

    } catch (error) {
    // console.error('Error in createBug:', error);
      return {
        success: false,
        message: 'Error creating bug. Please try again.',
        error: error.message
      };
    }
  }

  /**
   * Update bug with comprehensive validation
   */
  static async updateBug(bugId, updateData, userId) {
    try {
      // Find the bug and validate permissions
      const bug = await Bug.findById(bugId).populate('teamId');
      
      if (!bug) {
        return {
          success: false,
          message: 'Bug not found.'
        };
      }

      // Check team membership
      const team = await Team.findOne({
        _id: bug.teamId._id,
        'members.user': userId
      });

      if (!team) {
        return {
          success: false,
          message: 'You do not have permission to update this bug.'
        };
      }

      // Update the bug
      const updatedBug = await Bug.findByIdAndUpdate(
        bugId,
        updateData,
        { new: true }
      ).populate('createdBy', 'name email')
       .populate('assignedTo', 'name email')
       .populate('teamId', 'name')
       .lean();

      return {
        success: true,
        message: 'Bug updated successfully.',
        data: updatedBug
      };

    } catch (error) {
    // console.error('Error in updateBug:', error);
      return {
        success: false,
        message: 'Error updating bug. Please try again.',
        error: error.message
      };
    }
  }

  /**
   * Delete bug with validation
   */
  static async deleteBug(bugId, userId) {
    try {
      const bug = await Bug.findById(bugId).populate('teamId');
      
      if (!bug) {
        return {
          success: false,
          message: 'Bug not found.'
        };
      }

      // Check permissions (admin or creator)
      const team = await Team.findOne({
        _id: bug.teamId._id,
        'members': {
          $elemMatch: {
            user: userId,
            role: { $in: ['admin'] }
          }
        }
      });

      if (!team && bug.createdBy.toString() !== userId.toString()) {
        return {
          success: false,
          message: 'You do not have permission to delete this bug.'
        };
      }

      await Bug.findByIdAndDelete(bugId);

      return {
        success: true,
        message: 'Bug deleted successfully.'
      };

    } catch (error) {
    // console.error('Error in deleteBug:', error);
      return {
        success: false,
        message: 'Error deleting bug. Please try again.',
        error: error.message
      };
    }
  }

  /**
   * Assign users to bug
   */
  static async assignBug(bugId, userIds, assignerId) {
    try {
      const bug = await Bug.findById(bugId).populate('teamId');
      
      if (!bug) {
        return {
          success: false,
          message: 'Bug not found.'
        };
      }

      // Validate team membership for assigner
      const team = await Team.findOne({
        _id: bug.teamId._id,
        'members.user': assignerId
      });

      if (!team) {
        return {
          success: false,
          message: 'You do not have permission to assign this bug.'
        };
      }

      // Validate that all users being assigned are team members
      const teamMembers = team.members.map(m => m.user.toString());
      const invalidUsers = userIds.filter(id => !teamMembers.includes(id.toString()));
      
      if (invalidUsers.length > 0) {
        return {
          success: false,
          message: 'Some users are not members of this team.'
        };
      }

      // Update the bug
      const updatedBug = await Bug.findByIdAndUpdate(
        bugId,
        { assignedTo: userIds },
        { new: true }
      ).populate('createdBy', 'name email')
       .populate('assignedTo', 'name email')
       .populate('teamId', 'name')
       .lean();

      return {
        success: true,
        message: 'Bug assigned successfully.',
        data: updatedBug
      };

    } catch (error) {
    // console.error('Error in assignBug:', error);
      return {
        success: false,
        message: 'Error assigning bug. Please try again.',
        error: error.message
      };
    }
  }

  /**
   * Get bug analytics for teams
   */
  static async calculateBugAnalytics(teamIds, filters = {}) {
    try {
      const matchStage = { teamId: { $in: teamIds } };
      
      // Apply filters to analytics
      if (filters.status) matchStage.status = filters.status;
      if (filters.priority) matchStage.priority = filters.priority;
      if (filters.startDate) matchStage.createdAt = { $gte: filters.startDate };
      if (filters.endDate) {
        if (matchStage.createdAt) {
          matchStage.createdAt.$lte = filters.endDate;
        } else {
          matchStage.createdAt = { $lte: filters.endDate };
        }
      }

      const analytics = await Bug.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalBugs: { $sum: 1 },
            openBugs: {
              $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
            },
            closedBugs: {
              $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
            },
            inProgressBugs: {
              $sum: { $cond: [{ $eq: ['$status', 'in progress'] }, 1, 0] }
            },
            highPriorityBugs: {
              $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
            },
            criticalBugs: {
              $sum: { $cond: [{ $eq: ['$priority', 'critical'] }, 1, 0] }
            },
            assignedBugs: {
              $sum: { $cond: [{ $gt: [{ $size: '$assignedTo' }, 0] }, 1, 0] }
            },
            unassignedBugs: {
              $sum: { $cond: [{ $eq: [{ $size: '$assignedTo' }, 0] }, 1, 0] }
            }
          }
        }
      ]);

      return analytics[0] || {
        totalBugs: 0,
        openBugs: 0,
        closedBugs: 0,
        inProgressBugs: 0,
        highPriorityBugs: 0,
        criticalBugs: 0,
        assignedBugs: 0,
        unassignedBugs: 0
      };

    } catch (error) {
    // console.error('Error calculating bug analytics:', error);
      return null;
    }
  }

  /**
   * Parse search criteria from natural language
   */
  static parseSearchCriteria(criteria) {
    const filters = {};
    const lowerCriteria = criteria.toLowerCase();

    // Status extraction
    if (lowerCriteria.includes('open')) filters.status = 'open';
    else if (lowerCriteria.includes('closed')) filters.status = 'closed';
    else if (lowerCriteria.includes('in progress')) filters.status = 'in progress';

    // Priority extraction
    if (lowerCriteria.includes('high priority') || lowerCriteria.includes('urgent')) {
      filters.priority = 'high';
    } else if (lowerCriteria.includes('critical')) {
      filters.priority = 'critical';
    } else if (lowerCriteria.includes('low priority')) {
      filters.priority = 'low';
    } else if (lowerCriteria.includes('medium priority')) {
      filters.priority = 'medium';
    }

    // Extract search terms
    const searchTerms = criteria.replace(/(open|closed|in progress|high|critical|low|medium|priority|urgent)/gi, '').trim();
    if (searchTerms) {
      filters.search = searchTerms;
    }

    return filters;
  }

  /**
   * Parse criteria string from natural language
   */
  static parseCriteriaString(criteria) {
    const filters = {};
    const lowerCriteria = criteria.toLowerCase();

    // Parse various patterns
    if (lowerCriteria.includes('my bugs') || lowerCriteria.includes('assigned to me')) {
      filters.assignedToMe = true;
    }

    if (lowerCriteria.includes('created by me') || lowerCriteria.includes('i created')) {
      filters.createdByMe = true;
    }

    // Time-based filters
    if (lowerCriteria.includes('today')) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filters.startDate = today;
    } else if (lowerCriteria.includes('this week')) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      filters.startDate = weekStart;
    } else if (lowerCriteria.includes('this month')) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      filters.startDate = monthStart;
    }

    // Combine with basic search criteria parsing
    const basicFilters = this.parseSearchCriteria(criteria);
    return { ...filters, ...basicFilters };
  }

  /**
   * Get bug counts by various dimensions
   */
  static async getBugCounts(userId, dimension = 'status') {
    try {
      const userTeams = await Team.find({
        'members.user': userId
      }).select('_id').lean();

      if (userTeams.length === 0) {
        return {
          success: false,
          message: 'You are not a member of any teams.'
        };
      }

      const teamIds = userTeams.map(team => team._id);
      
      const counts = await Bug.aggregate([
        { $match: { teamId: { $in: teamIds } } },
        { $group: { _id: `$${dimension}`, count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      return {
        success: true,
        message: `Bug counts by ${dimension}`,
        data: counts,
        dimension
      };

    } catch (error) {
    // console.error('Error in getBugCounts:', error);
      return {
        success: false,
        message: 'Error retrieving bug counts.',
        error: error.message
      };
    }
  }

  /**
   * Get comprehensive bug statistics
   */
  static async getBugStatistics(userId, timeframe = 'all') {
    try {
      const userTeams = await Team.find({
        'members.user': userId
      }).select('_id name').lean();

      if (userTeams.length === 0) {
        return {
          success: false,
          message: 'You are not a member of any teams.'
        };
      }

      const teamIds = userTeams.map(team => team._id);
      
      // Build time filter
      let timeFilter = {};
      if (timeframe !== 'all') {
        const now = new Date();
        switch (timeframe) {
          case 'week':
            timeFilter.createdAt = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
            break;
          case 'month':
            timeFilter.createdAt = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
            break;
          case 'quarter':
            timeFilter.createdAt = { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
            break;
        }
      }

      const statistics = await Bug.aggregate([
        { $match: { teamId: { $in: teamIds }, ...timeFilter } },
        {
          $facet: {
            byStatus: [
              { $group: { _id: '$status', count: { $sum: 1 } } }
            ],
            byPriority: [
              { $group: { _id: '$priority', count: { $sum: 1 } } }
            ],
            byTeam: [
              { $group: { _id: '$teamId', count: { $sum: 1 } } },
              { $lookup: { from: 'teams', localField: '_id', foreignField: '_id', as: 'team' } },
              { $unwind: '$team' },
              { $project: { _id: 1, count: 1, teamName: '$team.name' } }
            ],
            assignmentStats: [
              {
                $group: {
                  _id: null,
                  assigned: { $sum: { $cond: [{ $gt: [{ $size: '$assignedTo' }, 0] }, 1, 0] } },
                  unassigned: { $sum: { $cond: [{ $eq: [{ $size: '$assignedTo' }, 0] }, 1, 0] } }
                }
              }
            ],
            totalCount: [
              { $count: 'total' }
            ]
          }
        }
      ]);

      return {
        success: true,
        message: `Bug statistics for ${timeframe}`,
        data: statistics[0],
        timeframe,
        teams: userTeams
      };

    } catch (error) {
    // console.error('Error in getBugStatistics:', error);
      return {
        success: false,
        message: 'Error retrieving bug statistics.',
        error: error.message
      };
    }
  }
}

module.exports = EnhancedBugIntents;
