const User = require('../../model/user');
const Team = require('../../model/team');
const Bug = require('../../model/bug');
const mongoose = require('mongoose');

/**
 * Advanced User Query System
 * Provides sophisticated querying capabilities for users with complex filters and analytics
 */
class UserQueries {

  /**
   * Advanced user search with multiple criteria
   */
  static async advancedUserSearch(userId, searchCriteria) {
    try {
      const currentUser = await User.findById(userId).populate('teams');
      const userTeamIds = currentUser.teams.map(team => team._id);

      // Base query - only users in shared teams
      let query = {
        teams: { $in: userTeamIds }
      };

      // Exclude current user unless specifically requested
      if (!searchCriteria.includeSelf) {
        query._id = { $ne: userId };
      }

      // Text search across name and email
      if (searchCriteria.text) {
        query.$or = [
          { name: { $regex: searchCriteria.text, $options: 'i' } },
          { email: { $regex: searchCriteria.text, $options: 'i' } }
        ];
      }

      // Team filtering
      if (searchCriteria.teams) {
        const teamIds = Array.isArray(searchCriteria.teams) ? searchCriteria.teams : [searchCriteria.teams];
        query.teams = { $in: teamIds.filter(id => userTeamIds.includes(mongoose.Types.ObjectId(id))) };
      }

      // Role/Permission filtering (if implemented)
      if (searchCriteria.role) {
        query.role = searchCriteria.role;
      }

      // Activity filtering
      if (searchCriteria.activity) {
        const activityDate = new Date();
        switch (searchCriteria.activity) {
          case 'active_today':
            activityDate.setHours(0, 0, 0, 0);
            query.lastActiveAt = { $gte: activityDate };
            break;
          case 'active_week':
            activityDate.setDate(activityDate.getDate() - 7);
            query.lastActiveAt = { $gte: activityDate };
            break;
          case 'inactive_month':
            activityDate.setDate(activityDate.getDate() - 30);
            query.lastActiveAt = { $lt: activityDate };
            break;
        }
      }

      // Join date filtering
      if (searchCriteria.joinedDate) {
        const { from, to } = searchCriteria.joinedDate;
        query.createdAt = {};
        if (from) query.createdAt.$gte = new Date(from);
        if (to) query.createdAt.$lte = new Date(to);
      }

      // Sorting
      let sort = { name: 1 }; // Default sort by name
      if (searchCriteria.sort) {
        const { field, order = 'asc' } = searchCriteria.sort;
        sort = { [field]: order === 'desc' ? -1 : 1 };
      }

      // Pagination
      const page = searchCriteria.page || 1;
      const limit = Math.min(searchCriteria.limit || 20, 100);
      const skip = (page - 1) * limit;

      // Execute query with aggregation for additional data
      const pipeline = [
        { $match: query },
        {
          $lookup: {
            from: 'teams',
            localField: 'teams',
            foreignField: '_id',
            as: 'teamDetails'
          }
        },
        {
          $lookup: {
            from: 'bugs',
            localField: '_id',
            foreignField: 'creator',
            as: 'createdBugs'
          }
        },
        {
          $lookup: {
            from: 'bugs',
            localField: '_id',
            foreignField: 'assignee',
            as: 'assignedBugs'
          }
        },
        {
          $addFields: {
            bugsCreated: { $size: '$createdBugs' },
            bugsAssigned: { $size: '$assignedBugs' },
            activeBugs: {
              $size: {
                $filter: {
                  input: '$assignedBugs',
                  cond: { $ne: ['$$this.status', 'Closed'] }
                }
              }
            },
            teamCount: { $size: '$teamDetails' }
          }
        },
        {
          $project: {
            name: 1,
            email: 1,
            avatar: 1,
            createdAt: 1,
            lastActiveAt: 1,
            teamDetails: { name: 1, _id: 1 },
            bugsCreated: 1,
            bugsAssigned: 1,
            activeBugs: 1,
            teamCount: 1
          }
        },
        { $sort: sort },
        { $skip: skip },
        { $limit: limit }
      ];

      const [users, totalCount] = await Promise.all([
        User.aggregate(pipeline),
        User.countDocuments(query)
      ]);

      return {
        success: true,
        users,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        },
        query: searchCriteria,
        message: `Found ${users.length} of ${totalCount} users`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error performing advanced user search',
        error: error.message
      };
    }
  }

  /**
   * Get user analytics and performance metrics
   */
  static async getUserAnalytics(userId, targetUserId = null, timeRange = '30days') {
    try {
      const searchUserId = targetUserId || userId;
      
      // Verify access
      if (targetUserId && targetUserId !== userId) {
        const currentUser = await User.findById(userId).populate('teams');
        const targetUser = await User.findById(targetUserId).populate('teams');
        
        const sharedTeams = currentUser.teams.filter(team => 
          targetUser.teams.some(t => t._id.toString() === team._id.toString())
        );
        
        if (sharedTeams.length === 0) {
          return { success: false, message: 'Access denied to this user\'s analytics' };
        }
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
        case 'all':
          dateFrom = new Date(0);
          break;
        default:
          dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const user = await User.findById(searchUserId)
        .populate('teams', 'name')
        .select('-password -resetToken');

      const [
        bugsCreated,
        bugsAssigned,
        bugsResolved,
        activeBugs,
        overduelBugs,
        averageResolutionTime,
        activityTrends,
        priorityDistribution,
        teamContributions
      ] = await Promise.all([
        Bug.countDocuments({
          creator: searchUserId,
          createdAt: { $gte: dateFrom },
          deleted: false
        }),
        Bug.countDocuments({
          assignee: searchUserId,
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
          status: { $ne: 'Closed' },
          deleted: false
        }),
        Bug.countDocuments({
          assignee: searchUserId,
          dueDate: { $lt: now },
          status: { $ne: 'Closed' },
          deleted: false
        }),
        this.calculateUserResolutionTime(searchUserId, dateFrom),
        this.getUserActivityTrends(searchUserId, dateFrom),
        Bug.aggregate([
          {
            $match: {
              $or: [
                { creator: mongoose.Types.ObjectId(searchUserId) },
                { assignee: mongoose.Types.ObjectId(searchUserId) }
              ],
              createdAt: { $gte: dateFrom },
              deleted: false
            }
          },
          {
            $group: {
              _id: '$priority',
              count: { $sum: 1 }
            }
          }
        ]),
        Bug.aggregate([
          {
            $match: {
              $or: [
                { creator: mongoose.Types.ObjectId(searchUserId) },
                { assignee: mongoose.Types.ObjectId(searchUserId) }
              ],
              createdAt: { $gte: dateFrom },
              deleted: false
            }
          },
          {
            $lookup: {
              from: 'teams',
              localField: 'team',
              foreignField: '_id',
              as: 'teamInfo'
            }
          },
          {
            $group: {
              _id: '$team',
              teamName: { $first: { $arrayElemAt: ['$teamInfo.name', 0] } },
              created: {
                $sum: {
                  $cond: [
                    { $eq: ['$creator', mongoose.Types.ObjectId(searchUserId)] },
                    1, 0
                  ]
                }
              },
              assigned: {
                $sum: {
                  $cond: [
                    { $eq: ['$assignee', mongoose.Types.ObjectId(searchUserId)] },
                    1, 0
                  ]
                }
              }
            }
          }
        ])
      ]);

      // Calculate performance scores
      const resolutionRate = bugsAssigned > 0 ? (bugsResolved / bugsAssigned * 100) : 0;
      const productivityScore = this.calculateProductivityScore(
        bugsCreated, bugsResolved, averageResolutionTime, overduelBugs
      );

      const analytics = {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          joinDate: user.createdAt,
          teams: user.teams
        },
        timeRange,
        summary: {
          bugsCreated,
          bugsAssigned,
          bugsResolved,
          activeBugs,
          overduelBugs,
          resolutionRate: resolutionRate.toFixed(1),
          averageResolutionTime,
          productivityScore
        },
        trends: activityTrends,
        distributions: {
          priority: priorityDistribution,
          teams: teamContributions
        },
        performance: {
          efficiency: resolutionRate > 80 ? 'High' : resolutionRate > 60 ? 'Medium' : 'Low',
          workload: activeBugs > 10 ? 'Heavy' : activeBugs > 5 ? 'Moderate' : 'Light',
          reliability: overduelBugs === 0 ? 'Excellent' : overduelBugs <= 2 ? 'Good' : 'Needs Improvement'
        }
      };

      return {
        success: true,
        analytics,
        message: `Analytics for ${user.name} over ${timeRange}`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching user analytics',
        error: error.message
      };
    }
  }

  /**
   * Get team collaboration patterns for users
   */
  static async getUserCollaborationPatterns(userId, options = {}) {
    try {
      const user = await User.findById(userId).populate('teams');
      const userTeamIds = user.teams.map(team => team._id);

      const timeRange = options.timeRange || '30days';
      const dateFrom = this.getDateFromRange(timeRange);

      // Get collaboration data
      const collaborationData = await Bug.aggregate([
        {
          $match: {
            team: { $in: userTeamIds },
            createdAt: { $gte: dateFrom },
            deleted: false
          }
        },
        {
          $group: {
            _id: {
              creator: '$creator',
              assignee: '$assignee',
              team: '$team'
            },
            bugCount: { $sum: 1 },
            bugs: { $push: { id: '$_id', title: '$title', status: '$status' } }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id.creator',
            foreignField: '_id',
            as: 'creatorInfo'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id.assignee',
            foreignField: '_id',
            as: 'assigneeInfo'
          }
        },
        {
          $lookup: {
            from: 'teams',
            localField: '_id.team',
            foreignField: '_id',
            as: 'teamInfo'
          }
        },
        {
          $match: {
            $or: [
              { '_id.creator': mongoose.Types.ObjectId(userId) },
              { '_id.assignee': mongoose.Types.ObjectId(userId) }
            ]
          }
        },
        {
          $project: {
            creator: { $arrayElemAt: ['$creatorInfo', 0] },
            assignee: { $arrayElemAt: ['$assigneeInfo', 0] },
            team: { $arrayElemAt: ['$teamInfo', 0] },
            bugCount: 1,
            bugs: 1,
            isUserCreator: { $eq: ['$_id.creator', mongoose.Types.ObjectId(userId)] },
            isUserAssignee: { $eq: ['$_id.assignee', mongoose.Types.ObjectId(userId)] }
          }
        },
        { $sort: { bugCount: -1 } }
      ]);

      // Analyze collaboration patterns
      const patterns = {
        mostFrequentCollaborators: [],
        createdForOthers: collaborationData.filter(item => item.isUserCreator && !item.isUserAssignee),
        assignedFromOthers: collaborationData.filter(item => !item.isUserCreator && item.isUserAssignee),
        teamCollaboration: {}
      };

      // Group by teams
      userTeamIds.forEach(teamId => {
        const teamCollabs = collaborationData.filter(item => 
          item.team._id.toString() === teamId.toString()
        );
        
        if (teamCollabs.length > 0) {
          patterns.teamCollaboration[teamId] = {
            teamName: teamCollabs[0].team.name,
            collaborations: teamCollabs,
            totalBugs: teamCollabs.reduce((sum, item) => sum + item.bugCount, 0)
          };
        }
      });

      // Find most frequent collaborators
      const collaboratorMap = new Map();
      collaborationData.forEach(item => {
        const collaboratorId = item.isUserCreator ? 
          item.assignee?._id?.toString() : 
          item.creator?._id?.toString();
        
        if (collaboratorId && collaboratorId !== userId) {
          const existing = collaboratorMap.get(collaboratorId) || { 
            user: item.isUserCreator ? item.assignee : item.creator, 
            count: 0,
            relationships: []
          };
          existing.count += item.bugCount;
          existing.relationships.push({
            type: item.isUserCreator ? 'created_for' : 'assigned_by',
            team: item.team.name,
            bugCount: item.bugCount
          });
          collaboratorMap.set(collaboratorId, existing);
        }
      });

      patterns.mostFrequentCollaborators = Array.from(collaboratorMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        success: true,
        collaboration: patterns,
        timeRange,
        user: {
          id: user._id,
          name: user.name
        },
        message: `Collaboration patterns for ${timeRange}`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching collaboration patterns',
        error: error.message
      };
    }
  }

  /**
   * Get user workload comparison within teams
   */
  static async getUserWorkloadComparison(userId, teamId = null) {
    try {
      const user = await User.findById(userId).populate('teams');
      let targetTeams = teamId ? [teamId] : user.teams.map(team => team._id);

      // Verify access to specified team
      if (teamId) {
        const hasAccess = user.teams.some(team => team._id.toString() === teamId);
        if (!hasAccess) {
          return { success: false, message: 'Access denied to this team' };
        }
        targetTeams = [mongoose.Types.ObjectId(teamId)];
      }

      const workloadComparison = await User.aggregate([
        {
          $match: {
            teams: { $in: targetTeams }
          }
        },
        {
          $lookup: {
            from: 'bugs',
            let: { userId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$assignee', '$$userId'] },
                      { $in: ['$team', targetTeams] },
                      { $eq: ['$deleted', false] }
                    ]
                  }
                }
              }
            ],
            as: 'assignedBugs'
          }
        },
        {
          $lookup: {
            from: 'bugs',
            let: { userId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$creator', '$$userId'] },
                      { $in: ['$team', targetTeams] },
                      { $eq: ['$deleted', false] }
                    ]
                  }
                }
              }
            ],
            as: 'createdBugs'
          }
        },
        {
          $addFields: {
            totalAssigned: { $size: '$assignedBugs' },
            activeBugs: {
              $size: {
                $filter: {
                  input: '$assignedBugs',
                  cond: { $ne: ['$$this.status', 'Closed'] }
                }
              }
            },
            highPriorityBugs: {
              $size: {
                $filter: {
                  input: '$assignedBugs',
                  cond: {
                    $and: [
                      { $eq: ['$$this.priority', 'High'] },
                      { $ne: ['$$this.status', 'Closed'] }
                    ]
                  }
                }
              }
            },
            resolvedBugs: {
              $size: {
                $filter: {
                  input: '$assignedBugs',
                  cond: { $eq: ['$$this.status', 'Closed'] }
                }
              }
            },
            createdCount: { $size: '$createdBugs' },
            overduelBugs: {
              $size: {
                $filter: {
                  input: '$assignedBugs',
                  cond: {
                    $and: [
                      { $ne: ['$$this.status', 'Closed'] },
                      { $lt: ['$$this.dueDate', new Date()] },
                      { $ne: ['$$this.dueDate', null] }
                    ]
                  }
                }
              }
            }
          }
        },
        {
          $addFields: {
            workloadScore: {
              $add: [
                '$activeBugs',
                { $multiply: ['$highPriorityBugs', 2] },
                { $multiply: ['$overduelBugs', 3] }
              ]
            },
            resolutionRate: {
              $cond: [
                { $gt: ['$totalAssigned', 0] },
                { $multiply: [{ $divide: ['$resolvedBugs', '$totalAssigned'] }, 100] },
                0
              ]
            }
          }
        },
        {
          $project: {
            name: 1,
            email: 1,
            avatar: 1,
            totalAssigned: 1,
            activeBugs: 1,
            highPriorityBugs: 1,
            resolvedBugs: 1,
            createdCount: 1,
            overduelBugs: 1,
            workloadScore: 1,
            resolutionRate: 1,
            isCurrentUser: { $eq: ['$_id', mongoose.Types.ObjectId(userId)] }
          }
        },
        { $sort: { workloadScore: -1 } }
      ]);

      // Calculate team averages
      const teamStats = {
        totalMembers: workloadComparison.length,
        averageWorkload: workloadComparison.reduce((sum, user) => sum + user.workloadScore, 0) / workloadComparison.length,
        averageResolutionRate: workloadComparison.reduce((sum, user) => sum + user.resolutionRate, 0) / workloadComparison.length,
        totalActiveBugs: workloadComparison.reduce((sum, user) => sum + user.activeBugs, 0)
      };

      // Find current user's position
      const currentUserIndex = workloadComparison.findIndex(user => user.isCurrentUser);
      const currentUser = workloadComparison[currentUserIndex];

      return {
        success: true,
        workloadComparison: workloadComparison,
        teamStats,
        currentUser: {
          ...currentUser,
          position: currentUserIndex + 1,
          percentile: ((workloadComparison.length - currentUserIndex) / workloadComparison.length * 100).toFixed(0)
        },
        teamId,
        message: `Workload comparison for ${workloadComparison.length} team members`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching workload comparison',
        error: error.message
      };
    }
  }

  /**
   * Helper methods
   */
  static getDateFromRange(timeRange) {
    const now = new Date();
    switch (timeRange) {
      case '7days':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30days':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90days':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case 'all':
        return new Date(0);
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  static async calculateUserResolutionTime(userId, dateFrom) {
    try {
      const result = await Bug.aggregate([
        {
          $match: {
            assignee: mongoose.Types.ObjectId(userId),
            status: 'Closed',
            closedAt: { $gte: dateFrom },
            deleted: false
          }
        },
        {
          $project: {
            resolutionTime: {
              $divide: [
                { $subtract: ['$closedAt', '$createdAt'] },
                1000 * 60 * 60 * 24
              ]
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

      return result.length > 0 ? Math.round(result[0].avgTime * 10) / 10 : 0;
    } catch (error) {
      return 0;
    }
  }

  static async getUserActivityTrends(userId, dateFrom) {
    try {
      const trends = await Bug.aggregate([
        {
          $match: {
            $or: [
              { creator: mongoose.Types.ObjectId(userId) },
              { assignee: mongoose.Types.ObjectId(userId) }
            ],
            createdAt: { $gte: dateFrom },
            deleted: false
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              type: {
                $cond: [
                  { $eq: ['$creator', mongoose.Types.ObjectId(userId)] },
                  'created',
                  'assigned'
                ]
              }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]);

      return trends;
    } catch (error) {
      return [];
    }
  }

  static calculateProductivityScore(created, resolved, avgResolutionTime, overdue) {
    let score = 0;
    
    // Creation score (30%)
    score += Math.min(created * 2, 30);
    
    // Resolution score (40%)
    score += Math.min(resolved * 3, 40);
    
    // Speed score (20%)
    if (avgResolutionTime > 0) {
      const speedScore = Math.max(0, 20 - (avgResolutionTime - 3) * 2);
      score += speedScore;
    }
    
    // Reliability score (10%) - penalty for overdue
    score += Math.max(0, 10 - overdue * 2);
    
    return Math.min(100, Math.max(0, Math.round(score)));
  }
}

module.exports = UserQueries;
