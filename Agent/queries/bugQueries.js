const Bug = require('../../model/bug');
const User = require('../../model/user');
const Team = require('../../model/team');
const mongoose = require('mongoose');

/**
 * Advanced Bug Query System
 * Provides sophisticated querying capabilities for bugs with complex filters and aggregations
 */
class BugQueries {

  /**
   * Advanced bug search with multiple criteria
   */
  static async advancedSearch(userId, searchCriteria) {
    try {
      // Find teams where the user is a member
      const teams = await Team.find({
        'members.user': userId
      });
      const userTeamIds = teams.map(team => team._id);
      
      if (userTeamIds.length === 0) {
        return {
          success: true,
          bugs: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            pages: 0,
            hasNext: false,
            hasPrev: false
          },
          query: searchCriteria,
          message: 'No teams found for user'
        };
      }
      
      // Base query - user must have access to bugs through teams
      let query = {
        deleted: false,
        teamId: { $in: userTeamIds }
      };

      // Text search across multiple fields
      if (searchCriteria.text) {
        query.$text = { $search: searchCriteria.text };
      }

      // Status filtering
      if (searchCriteria.status) {
        if (Array.isArray(searchCriteria.status)) {
          query.status = { $in: searchCriteria.status };
        } else {
          query.status = searchCriteria.status;
        }
      }

      // Priority filtering
      if (searchCriteria.priority) {
        if (Array.isArray(searchCriteria.priority)) {
          query.priority = { $in: searchCriteria.priority };
        } else {
          query.priority = searchCriteria.priority;
        }
      }

      // Team filtering
      if (searchCriteria.teams) {
        const teamIds = Array.isArray(searchCriteria.teams) ? searchCriteria.teams : [searchCriteria.teams];
        query.teamId = { $in: teamIds.filter(id => userTeamIds.includes(mongoose.Types.ObjectId(id))) };
      }

      // Assignee filtering
      if (searchCriteria.assignee) {
        if (searchCriteria.assignee === 'me') {
          query.assignedTo = userId;
        } else if (searchCriteria.assignee === 'unassigned') {
          query.assignedTo = { $exists: false };
        } else {
          query.assignedTo = searchCriteria.assignee;
        }
      }

      // Creator filtering
      if (searchCriteria.creator) {
        if (searchCriteria.creator === 'me') {
          query.createdBy = userId;
        } else {
          query.createdBy = searchCriteria.creator;
        }
      }

      // Date range filtering
      if (searchCriteria.dateRange) {
        const { field = 'createdAt', from, to } = searchCriteria.dateRange;
        query[field] = {};
        if (from) query[field].$gte = new Date(from);
        if (to) query[field].$lte = new Date(to);
      }

      // Tag filtering
      if (searchCriteria.tags) {
        const tags = Array.isArray(searchCriteria.tags) ? searchCriteria.tags : [searchCriteria.tags];
        query.tags = { $in: tags };
      }

      // Due date filtering
      if (searchCriteria.dueDate) {
        switch (searchCriteria.dueDate) {
          case 'overdue':
            query.dueDate = { $lt: new Date() };
            query.status = { $ne: 'Closed' };
            break;
          case 'today':
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            query.dueDate = { $gte: today, $lt: tomorrow };
            break;
          case 'this_week':
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);
            query.dueDate = { $gte: weekStart, $lt: weekEnd };
            break;
        }
      }

      // Sorting
      let sort = { createdAt: -1 }; // Default sort
      if (searchCriteria.sort) {
        const { field, order = 'desc' } = searchCriteria.sort;
        sort = { [field]: order === 'desc' ? -1 : 1 };
      }

      // Pagination
      const page = searchCriteria.page || 1;
      const limit = Math.min(searchCriteria.limit || 20, 100); // Max 100 items
      const skip = (page - 1) * limit;

      // Execute query
      const [bugs, totalCount] = await Promise.all([
        Bug.find(query)
          .populate('createdBy', 'name email avatar')
          .populate('assignedTo', 'name email avatar')
          .populate('teamId', 'name description')
          .sort(sort)
          .skip(skip)
          .limit(limit),
        Bug.countDocuments(query)
      ]);

      return {
        success: true,
        bugs,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        },
        query: searchCriteria,
        message: `Found ${bugs.length} of ${totalCount} bugs`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error performing advanced search',
        error: error.message
      };
    }
  }

  /**
   * Get bugs with advanced aggregation and analytics
   */
  static async getBugsWithAnalytics(userId, filters = {}) {
    try {
      // Find teams where the user is a member
      const teams = await Team.find({
        'members.user': userId
      });
      const userTeamIds = teams.map(team => team._id);
      
      if (userTeamIds.length === 0) {
        return {
          success: true,
          bugs: [],
          analytics: {},
          count: 0,
          message: 'No teams found for user'
        };
      }

      const matchStage = {
        deleted: false,
        teamId: { $in: userTeamIds }
      };

      // Apply filters to match stage
      if (filters.status) matchStage.status = filters.status;
      if (filters.priority) matchStage.priority = filters.priority;
      if (filters.team) matchStage.teamId = mongoose.Types.ObjectId(filters.team);
      if (filters.dateFrom) {
        matchStage.createdAt = { $gte: new Date(filters.dateFrom) };
      }

      const pipeline = [
        { $match: matchStage },
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'creatorInfo'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'assignedTo',
            foreignField: '_id',
            as: 'assigneeInfo'
          }
        },
        {
          $lookup: {
            from: 'teams',
            localField: 'teamId',
            foreignField: '_id',
            as: 'teamInfo'
          }
        },
        {
          $lookup: {
            from: 'comments',
            localField: '_id',
            foreignField: 'bug',
            as: 'comments'
          }
        },
        {
          $addFields: {
            commentCount: { $size: '$comments' },
            hasAssignee: { $ne: ['$assignedTo', null] },
            isOverdue: {
              $and: [
                { $ne: ['$dueDate', null] },
                { $lt: ['$dueDate', new Date()] },
                { $ne: ['$status', 'Closed'] }
              ]
            },
            daysSinceCreated: {
              $divide: [
                { $subtract: [new Date(), '$createdAt'] },
                1000 * 60 * 60 * 24
              ]
            },
            resolutionTime: {
              $cond: {
                if: { $eq: ['$status', 'Closed'] },
                then: {
                  $divide: [
                    { $subtract: ['$closedAt', '$createdAt'] },
                    1000 * 60 * 60 * 24
                  ]
                },
                else: null
              }
            }
          }
        },
        {
          $project: {
            title: 1,
            description: 1,
            status: 1,
            priority: 1,
            tags: 1,
            dueDate: 1,
            createdAt: 1,
            updatedAt: 1,
            closedAt: 1,
            creator: { $arrayElemAt: ['$creatorInfo', 0] },
            assignee: { $arrayElemAt: ['$assigneeInfo', 0] },
            team: { $arrayElemAt: ['$teamInfo', 0] },
            commentCount: 1,
            hasAssignee: 1,
            isOverdue: 1,
            daysSinceCreated: 1,
            resolutionTime: 1
          }
        },
        { $sort: { createdAt: -1 } },
        { $limit: filters.limit || 50 }
      ];

      const [bugs, analytics] = await Promise.all([
        Bug.aggregate(pipeline),
        this.getBugAnalyticsAggregation(matchStage)
      ]);

      return {
        success: true,
        bugs,
        analytics,
        count: bugs.length,
        message: `Retrieved ${bugs.length} bugs with analytics`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error getting bugs with analytics',
        error: error.message
      };
    }
  }

  /**
   * Get bug trends and patterns
   */
  static async getBugTrends(userId, timeRange = '30days', groupBy = 'day') {
    try {
      // Find teams where the user is a member
      const teams = await Team.find({
        'members.user': userId
      });
      const userTeamIds = teams.map(team => team._id);
      
      if (userTeamIds.length === 0) {
        return {
          success: true,
          trends: [],
          resolutionTrends: [],
          priorityTrends: [],
          timeRange,
          groupBy,
          message: 'No teams found for user'
        };
      }

      // Calculate date range
      const now = new Date();
      let dateFrom;
      switch (timeRange) {
        case '7days':
          dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90days':
          dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1year':
          dateFrom = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Group by format
      let dateFormat;
      switch (groupBy) {
        case 'hour':
          dateFormat = '%Y-%m-%d %H:00';
          break;
        case 'day':
          dateFormat = '%Y-%m-%d';
          break;
        case 'week':
          dateFormat = '%Y-W%V';
          break;
        case 'month':
          dateFormat = '%Y-%m';
          break;
        default:
          dateFormat = '%Y-%m-%d';
      }

      const pipeline = [
        {
          $match: {
            teamId: { $in: userTeamIds },
            deleted: false,
            createdAt: { $gte: dateFrom }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: dateFormat, date: '$createdAt' } },
              status: '$status',
              priority: '$priority'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.date': 1 } }
      ];

      const [trends, resolutionTrends, priorityTrends] = await Promise.all([
        Bug.aggregate(pipeline),
        Bug.aggregate([
          {
            $match: {
              teamId: { $in: userTeamIds },
              deleted: false,
              status: 'Closed',
              closedAt: { $gte: dateFrom }
            }
          },
          {
            $group: {
              _id: { $dateToString: { format: dateFormat, date: '$closedAt' } },
              count: { $sum: 1 },
              avgResolutionTime: {
                $avg: {
                  $divide: [
                    { $subtract: ['$closedAt', '$createdAt'] },
                    1000 * 60 * 60 * 24
                  ]
                }
              }
            }
          },
          { $sort: { _id: 1 } }
        ]),
        Bug.aggregate([
          {
            $match: {
              teamId: { $in: userTeamIds },
              deleted: false,
              createdAt: { $gte: dateFrom }
            }
          },
          {
            $group: {
              _id: {
                date: { $dateToString: { format: dateFormat, date: '$createdAt' } },
                priority: '$priority'
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.date': 1 } }
        ])
      ]);

      return {
        success: true,
        trends: {
          creation: trends,
          resolution: resolutionTrends,
          priority: priorityTrends
        },
        timeRange,
        groupBy,
        dateFrom,
        message: `Bug trends for ${timeRange} grouped by ${groupBy}`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error getting bug trends',
        error: error.message
      };
    }
  }

  /**
   * Get bugs by complex relationships
   */
  static async getBugsByRelationships(userId, relationshipQuery) {
    try {
      // Find teams where the user is a member
      const teams = await Team.find({
        'members.user': userId
      });
      const userTeamIds = teams.map(team => team._id);
      
      if (userTeamIds.length === 0) {
        return {
          success: true,
          relationships: [],
          type: relationshipQuery.type,
          count: 0,
          message: 'No teams found for user'
        };
      }

      let pipeline = [
        {
          $match: {
            teamId: { $in: userTeamIds },
            deleted: false
          }
        }
      ];

      // Add relationship-specific stages
      if (relationshipQuery.type === 'similar_bugs') {
        // Find bugs with similar titles or descriptions
        const targetBug = await Bug.findById(relationshipQuery.bugId);
        if (!targetBug) {
          throw new Error('Target bug not found');
        }

        const keywords = targetBug.title.split(' ').filter(word => word.length > 3);
        
        pipeline.push({
          $match: {
            _id: { $ne: mongoose.Types.ObjectId(relationshipQuery.bugId) },
            $or: [
              { title: { $regex: keywords.join('|'), $options: 'i' } },
              { description: { $regex: keywords.join('|'), $options: 'i' } },
              { tags: { $in: targetBug.tags } }
            ]
          }
        });

        pipeline.push({
          $addFields: {
            similarity: {
              $add: [
                {
                  $cond: [
                    { $regexMatch: { input: '$title', regex: keywords.join('|'), options: 'i' } },
                    2, 0
                  ]
                },
                {
                  $size: {
                    $setIntersection: ['$tags', targetBug.tags]
                  }
                }
              ]
            }
          }
        });

        pipeline.push({ $sort: { similarity: -1 } });

      } else if (relationshipQuery.type === 'blocked_by') {
        // Find bugs that are blocking this bug
        pipeline.push({
          $match: {
            blockedBy: { $exists: true, $ne: [] }
          }
        });

        pipeline.push({
          $lookup: {
            from: 'bugs',
            localField: 'blockedBy',
            foreignField: '_id',
            as: 'blockingBugs'
          }
        });

      } else if (relationshipQuery.type === 'assignee_workload') {
        // Find bugs by assignee workload
        pipeline.push({
          $match: {
            assignee: { $exists: true },
            status: { $ne: 'Closed' }
          }
        });

        pipeline.push({
          $group: {
            _id: '$assignee',
            bugs: { $push: '$$ROOT' },
            count: { $sum: 1 },
            highPriorityCount: {
              $sum: { $cond: [{ $eq: ['$priority', 'High'] }, 1, 0] }
            }
          }
        });

        pipeline.push({
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'assigneeInfo'
          }
        });

        pipeline.push({
          $addFields: {
            assignee: { $arrayElemAt: ['$assigneeInfo', 0] },
            workloadScore: { $add: ['$count', { $multiply: ['$highPriorityCount', 2] }] }
          }
        });

        pipeline.push({ $sort: { workloadScore: -1 } });
      }

      // Common lookups for bug details
      if (!relationshipQuery.type.includes('workload')) {
        pipeline.push(
          {
            $lookup: {
              from: 'users',
              localField: 'creator',
              foreignField: '_id',
              as: 'creator'
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'assignee',
              foreignField: '_id',
              as: 'assignee'
            }
          },
          {
            $lookup: {
              from: 'teams',
              localField: 'team',
              foreignField: '_id',
              as: 'team'
            }
          }
        );
      }

      pipeline.push({ $limit: relationshipQuery.limit || 20 });

      const results = await Bug.aggregate(pipeline);

      return {
        success: true,
        relationships: results,
        type: relationshipQuery.type,
        count: results.length,
        message: `Found ${results.length} related bugs`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error getting bugs by relationships',
        error: error.message
      };
    }
  }

  /**
   * Helper method for bug analytics aggregation
   */
  static async getBugAnalyticsAggregation(matchStage) {
    const analyticsData = await Bug.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalBugs: { $sum: 1 },
          openBugs: {
            $sum: { $cond: [{ $ne: ['$status', 'Closed'] }, 1, 0] }
          },
          closedBugs: {
            $sum: { $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0] }
          },
          highPriorityBugs: {
            $sum: { $cond: [{ $eq: ['$priority', 'High'] }, 1, 0] }
          },
          averageResolutionTime: {
            $avg: {
              $cond: [
                { $eq: ['$status', 'Closed'] },
                {
                  $divide: [
                    { $subtract: ['$closedAt', '$createdAt'] },
                    1000 * 60 * 60 * 24
                  ]
                },
                null
              ]
            }
          },
          statusDistribution: {
            $push: '$status'
          },
          priorityDistribution: {
            $push: '$priority'
          }
        }
      }
    ]);

    return analyticsData[0] || {};
  }

  /**
   * Export bugs to various formats
   */
  static async exportBugs(userId, exportOptions) {
    try {
      // Find teams where the user is a member
      const teams = await Team.find({
        'members.user': userId
      });
      const userTeamIds = teams.map(team => team._id);
      
      if (userTeamIds.length === 0) {
        return {
          success: true,
          data: [],
          format: exportOptions.format,
          count: 0,
          message: 'No teams found for user'
        };
      }

      let query = {
        deleted: false,
        teamId: { $in: userTeamIds }
      };

      // Apply export filters
      if (exportOptions.filters) {
        Object.assign(query, exportOptions.filters);
      }

      const bugs = await Bug.find(query)
        .populate('createdBy', 'name email')
        .populate('assignedTo', 'name email')
        .populate('teamId', 'name')
        .sort({ createdAt: -1 });

      // Format data based on export type
      let exportData;
      switch (exportOptions.format) {
        case 'csv':
          exportData = this.formatBugsForCSV(bugs);
          break;
        case 'json':
          exportData = this.formatBugsForJSON(bugs);
          break;
        case 'summary':
          exportData = this.formatBugsForSummary(bugs);
          break;
        default:
          exportData = bugs;
      }

      return {
        success: true,
        data: exportData,
        format: exportOptions.format,
        count: bugs.length,
        message: `Exported ${bugs.length} bugs in ${exportOptions.format} format`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error exporting bugs',
        error: error.message
      };
    }
  }

  /**
   * Helper methods for export formatting
   */
  static formatBugsForCSV(bugs) {
    return bugs.map(bug => ({
      ID: bug._id.toString(),
      Title: bug.title,
      Description: bug.description?.substring(0, 200) + '...',
      Status: bug.status,
      Priority: bug.priority,
      Creator: bug.creator?.name || 'Unknown',
      Assignee: bug.assignee?.name || 'Unassigned',
      Team: bug.team?.name || 'Unknown',
      Created: bug.createdAt.toISOString(),
      Updated: bug.updatedAt.toISOString(),
      Tags: bug.tags?.join(', ') || ''
    }));
  }

  static formatBugsForJSON(bugs) {
    return bugs.map(bug => ({
      id: bug._id,
      title: bug.title,
      description: bug.description,
      status: bug.status,
      priority: bug.priority,
      creator: {
        id: bug.creator?._id,
        name: bug.creator?.name,
        email: bug.creator?.email
      },
      assignee: bug.assignee ? {
        id: bug.assignee._id,
        name: bug.assignee.name,
        email: bug.assignee.email
      } : null,
      team: {
        id: bug.team?._id,
        name: bug.team?.name
      },
      dates: {
        created: bug.createdAt,
        updated: bug.updatedAt,
        closed: bug.closedAt
      },
      tags: bug.tags || []
    }));
  }

  static formatBugsForSummary(bugs) {
    const summary = {
      totalBugs: bugs.length,
      statusBreakdown: {},
      priorityBreakdown: {},
      teamBreakdown: {},
      assigneeBreakdown: {},
      recentActivity: bugs.slice(0, 10).map(bug => ({
        id: bug._id,
        title: bug.title,
        status: bug.status,
        updated: bug.updatedAt
      }))
    };

    bugs.forEach(bug => {
      // Status breakdown
      summary.statusBreakdown[bug.status] = (summary.statusBreakdown[bug.status] || 0) + 1;
      
      // Priority breakdown
      summary.priorityBreakdown[bug.priority] = (summary.priorityBreakdown[bug.priority] || 0) + 1;
      
      // Team breakdown
      const teamName = bug.teamId?.name || 'Unknown';
      summary.teamBreakdown[teamName] = (summary.teamBreakdown[teamName] || 0) + 1;
      
      // Assignee breakdown
      const assigneeName = bug.assignedTo?.name || 'Unassigned';
      summary.assigneeBreakdown[assigneeName] = (summary.assigneeBreakdown[assigneeName] || 0) + 1;
    });

    return summary;
  }
}

module.exports = BugQueries;
