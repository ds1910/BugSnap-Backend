const Team = require('../../model/team');
const User = require('../../model/user');
const Bug = require('../../model/bug');
const mongoose = require('mongoose');

/**
 * Advanced Team Query System
 * Provides sophisticated querying capabilities for teams with complex analytics and insights
 */
class TeamQueries {

  /**
   * Advanced team search and filtering
   */
  static async advancedTeamSearch(userId, searchCriteria) {
    try {
      // Find teams where the user is a member
      const userTeams = await Team.find({
        'members.user': userId
      });
      const userTeamIds = userTeams.map(team => team._id);
      
      if (userTeamIds.length === 0) {
        return {
          success: true,
          teams: [],
          count: 0,
          message: 'No teams found for user'
        };
      }

      // Base query - only teams user belongs to
      let query = {
        _id: { $in: userTeamIds }
      };

      // Text search
      if (searchCriteria.text) {
        query.$or = [
          { name: { $regex: searchCriteria.text, $options: 'i' } },
          { description: { $regex: searchCriteria.text, $options: 'i' } }
        ];
      }

      // Member count filtering
      if (searchCriteria.memberCount) {
        const { min, max } = searchCriteria.memberCount;
        if (min !== undefined || max !== undefined) {
          query.$expr = {
            $and: [
              min !== undefined ? { $gte: [{ $size: '$members' }, min] } : {},
              max !== undefined ? { $lte: [{ $size: '$members' }, max] } : {}
            ].filter(condition => Object.keys(condition).length > 0)
          };
        }
      }

      // Creation date filtering
      if (searchCriteria.createdDate) {
        const { from, to } = searchCriteria.createdDate;
        query.createdAt = {};
        if (from) query.createdAt.$gte = new Date(from);
        if (to) query.createdAt.$lte = new Date(to);
      }

      // Admin filtering
      if (searchCriteria.admin) {
        if (searchCriteria.admin === 'me') {
          query.admin = userId;
        } else {
          query.admin = searchCriteria.admin;
        }
      }

      // Execute query with aggregation for enhanced data
      const pipeline = [
        { $match: query },
        {
          $lookup: {
            from: 'users',
            localField: 'admin',
            foreignField: '_id',
            as: 'adminInfo'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'members',
            foreignField: '_id',
            as: 'memberDetails'
          }
        },
        {
          $lookup: {
            from: 'bugs',
            localField: '_id',
            foreignField: 'teamId',
            as: 'teamBugs'
          }
        },
        {
          $addFields: {
            admin: { $arrayElemAt: ['$adminInfo', 0] },
            memberCount: { $size: '$memberDetails' },
            totalBugs: { $size: '$teamBugs' },
            openBugs: {
              $size: {
                $filter: {
                  input: '$teamBugs',
                  cond: { 
                    $and: [
                      { $ne: ['$$this.status', 'Closed'] },
                      { $eq: ['$$this.deleted', false] }
                    ]
                  }
                }
              }
            },
            highPriorityBugs: {
              $size: {
                $filter: {
                  input: '$teamBugs',
                  cond: { 
                    $and: [
                      { $eq: ['$$this.priority', 'High'] },
                      { $ne: ['$$this.status', 'Closed'] },
                      { $eq: ['$$this.deleted', false] }
                    ]
                  }
                }
              }
            },
            recentActivity: {
              $size: {
                $filter: {
                  input: '$teamBugs',
                  cond: { 
                    $and: [
                      { $gte: ['$$this.updatedAt', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
                      { $eq: ['$$this.deleted', false] }
                    ]
                  }
                }
              }
            }
          }
        },
        {
          $project: {
            name: 1,
            description: 1,
            createdAt: 1,
            admin: { name: 1, email: 1, avatar: 1 },
            memberDetails: { name: 1, email: 1, avatar: 1 },
            memberCount: 1,
            totalBugs: 1,
            openBugs: 1,
            highPriorityBugs: 1,
            recentActivity: 1,
            isAdmin: { $eq: ['$admin._id', mongoose.Types.ObjectId(userId)] }
          }
        }
      ];

      // Apply sorting
      let sort = { name: 1 };
      if (searchCriteria.sort) {
        const { field, order = 'asc' } = searchCriteria.sort;
        sort = { [field]: order === 'desc' ? -1 : 1 };
      }
      pipeline.push({ $sort: sort });

      // Apply pagination
      const page = searchCriteria.page || 1;
      const limit = Math.min(searchCriteria.limit || 20, 100);
      const skip = (page - 1) * limit;
      
      pipeline.push({ $skip: skip }, { $limit: limit });

      const [teams, totalCount] = await Promise.all([
        Team.aggregate(pipeline),
        Team.countDocuments(query)
      ]);

      return {
        success: true,
        teams,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        },
        query: searchCriteria,
        message: `Found ${teams.length} of ${totalCount} teams`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error performing advanced team search',
        error: error.message
      };
    }
  }

  /**
   * Get comprehensive team analytics
   */
  static async getTeamAnalytics(userId, teamId, timeRange = '30days') {
    try {
      // Verify access
      const user = await User.findById(userId).populate('teams');
      const hasAccess = user.teams.some(team => team._id.toString() === teamId);
      
      if (!hasAccess) {
        return { success: false, message: 'Access denied to this team' };
      }

      const dateFrom = this.getDateFromRange(timeRange);
      
      const team = await Team.findById(teamId)
        .populate('admin', 'name email')
        .populate('members', 'name email avatar');

      // Comprehensive analytics pipeline
      const analyticsData = await Bug.aggregate([
        {
          $match: {
            team: mongoose.Types.ObjectId(teamId),
            deleted: false
          }
        },
        {
          $facet: {
            // Overall statistics
            overallStats: [
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
                  }
                }
              }
            ],
            
            // Time-based trends
            timeBasedTrends: [
              {
                $match: {
                  createdAt: { $gte: dateFrom }
                }
              },
              {
                $group: {
                  _id: {
                    date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    status: '$status'
                  },
                  count: { $sum: 1 }
                }
              },
              { $sort: { '_id.date': 1 } }
            ],
            
            // Member productivity
            memberProductivity: [
              {
                $group: {
                  _id: '$assignee',
                  assigned: { $sum: 1 },
                  resolved: {
                    $sum: { $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0] }
                  },
                  highPriority: {
                    $sum: { $cond: [{ $eq: ['$priority', 'High'] }, 1, 0] }
                  },
                  avgResolutionTime: {
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
                  }
                }
              },
              {
                $lookup: {
                  from: 'users',
                  localField: '_id',
                  foreignField: '_id',
                  as: 'memberInfo'
                }
              },
              {
                $addFields: {
                  member: { $arrayElemAt: ['$memberInfo', 0] },
                  resolutionRate: {
                    $cond: [
                      { $gt: ['$assigned', 0] },
                      { $multiply: [{ $divide: ['$resolved', '$assigned'] }, 100] },
                      0
                    ]
                  }
                }
              },
              { $sort: { assigned: -1 } }
            ],
            
            // Priority and status distributions
            distributions: [
              {
                $group: {
                  _id: null,
                  statusDist: {
                    $push: {
                      k: '$status',
                      v: 1
                    }
                  },
                  priorityDist: {
                    $push: {
                      k: '$priority',
                      v: 1
                    }
                  }
                }
              }
            ],
            
            // Recent activity (last 30 days)
            recentActivity: [
              {
                $match: {
                  updatedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                }
              },
              {
                $group: {
                  _id: {
                    date: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } }
                  },
                  bugUpdates: { $sum: 1 },
                  newBugs: {
                    $sum: {
                      $cond: [
                        { $gte: ['$createdAt', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                        1, 0
                      ]
                    }
                  },
                  closedBugs: {
                    $sum: { $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0] }
                  }
                }
              },
              { $sort: { '_id.date': 1 } }
            ]
          }
        }
      ]);

      // Get team health metrics
      const teamHealth = await this.calculateTeamHealth(teamId, dateFrom);
      
      // Get collaboration patterns
      const collaborationPatterns = await this.getTeamCollaborationPatterns(teamId, dateFrom);

      const analytics = {
        team: {
          id: team._id,
          name: team.name,
          description: team.description,
          admin: team.admin,
          memberCount: team.members.length,
          createdAt: team.createdAt
        },
        timeRange,
        summary: analyticsData[0].overallStats[0] || {},
        trends: analyticsData[0].timeBasedTrends || [],
        memberProductivity: analyticsData[0].memberProductivity || [],
        distributions: this.processDistributions(analyticsData[0].distributions[0] || {}),
        recentActivity: analyticsData[0].recentActivity || [],
        teamHealth,
        collaborationPatterns,
        insights: this.generateTeamInsights(analyticsData[0], teamHealth)
      };

      return {
        success: true,
        analytics,
        message: `Comprehensive analytics for ${team.name}`
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
   * Compare team performance across multiple teams
   */
  static async compareTeams(userId, teamIds, timeRange = '30days') {
    try {
      const user = await User.findById(userId).populate('teams');
      const userTeamIds = user.teams.map(team => team._id.toString());
      
      // Filter to only teams user has access to
      const accessibleTeamIds = teamIds.filter(id => userTeamIds.includes(id));
      
      if (accessibleTeamIds.length === 0) {
        return { success: false, message: 'No accessible teams to compare' };
      }

      const dateFrom = this.getDateFromRange(timeRange);
      
      const comparison = await Promise.all(
        accessibleTeamIds.map(async (teamId) => {
          const team = await Team.findById(teamId).populate('admin', 'name');
          
          const stats = await Bug.aggregate([
            {
              $match: {
                team: mongoose.Types.ObjectId(teamId),
                deleted: false
              }
            },
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
                recentBugs: {
                  $sum: {
                    $cond: [
                      { $gte: ['$createdAt', dateFrom] },
                      1, 0
                    ]
                  }
                },
                avgResolutionTime: {
                  $avg: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$status', 'Closed'] },
                          { $gte: ['$closedAt', dateFrom] }
                        ]
                      },
                      {
                        $divide: [
                          { $subtract: ['$closedAt', '$createdAt'] },
                          1000 * 60 * 60 * 24
                        ]
                      },
                      null
                    ]
                  }
                }
              }
            }
          ]);

          const teamStats = stats[0] || {};
          const resolutionRate = teamStats.totalBugs > 0 ? 
            (teamStats.closedBugs / teamStats.totalBugs * 100) : 0;

          return {
            team: {
              id: team._id,
              name: team.name,
              admin: team.admin?.name,
              memberCount: team.members.length
            },
            metrics: {
              ...teamStats,
              resolutionRate: resolutionRate.toFixed(1),
              productivityScore: this.calculateTeamProductivityScore(teamStats),
              efficiency: this.calculateTeamEfficiency(teamStats)
            }
          };
        })
      );

      // Calculate rankings
      const rankings = this.calculateTeamRankings(comparison);

      return {
        success: true,
        comparison,
        rankings,
        timeRange,
        teamCount: comparison.length,
        message: `Compared ${comparison.length} teams`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error comparing teams',
        error: error.message
      };
    }
  }

  /**
   * Get team collaboration network analysis
   */
  static async getTeamCollaborationNetwork(userId, teamId) {
    try {
      // Verify access
      const user = await User.findById(userId).populate('teams');
      const hasAccess = user.teams.some(team => team._id.toString() === teamId);
      
      if (!hasAccess) {
        return { success: false, message: 'Access denied to this team' };
      }

      const team = await Team.findById(teamId).populate('members', 'name email');

      // Analyze collaboration patterns through bug assignments and comments
      const collaborationData = await Bug.aggregate([
        {
          $match: {
            team: mongoose.Types.ObjectId(teamId),
            deleted: false
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
          $project: {
            creator: 1,
            assignee: 1,
            status: 1,
            commentAuthors: '$comments.author'
          }
        }
      ]);

      // Build collaboration network
      const network = {
        nodes: team.members.map(member => ({
          id: member._id.toString(),
          name: member.name,
          email: member.email,
          type: 'member'
        })),
        edges: [],
        metrics: {}
      };

      // Create edges based on collaboration patterns
      const edgeMap = new Map();

      collaborationData.forEach(bug => {
        // Creator -> Assignee relationships
        if (bug.creator && bug.assignee && bug.creator.toString() !== bug.assignee.toString()) {
          const edgeKey = `${bug.creator}-${bug.assignee}`;
          const existing = edgeMap.get(edgeKey) || {
            source: bug.creator.toString(),
            target: bug.assignee.toString(),
            weight: 0,
            type: 'assignment'
          };
          existing.weight += 1;
          edgeMap.set(edgeKey, existing);
        }

        // Comment-based collaboration
        bug.commentAuthors.forEach(author => {
          if (author && bug.assignee && author.toString() !== bug.assignee.toString()) {
            const edgeKey = `${author}-${bug.assignee}`;
            const existing = edgeMap.get(edgeKey) || {
              source: author.toString(),
              target: bug.assignee.toString(),
              weight: 0,
              type: 'discussion'
            };
            existing.weight += 0.5; // Comments have less weight than assignments
            edgeMap.set(edgeKey, existing);
          }
        });
      });

      network.edges = Array.from(edgeMap.values());

      // Calculate network metrics
      network.metrics = this.calculateNetworkMetrics(network);

      return {
        success: true,
        network,
        team: {
          id: team._id,
          name: team.name,
          memberCount: team.members.length
        },
        message: `Collaboration network for ${team.name}`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error analyzing collaboration network',
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

  static async calculateTeamHealth(teamId, dateFrom) {
    try {
      const healthMetrics = await Bug.aggregate([
        {
          $match: {
            team: mongoose.Types.ObjectId(teamId),
            deleted: false
          }
        },
        {
          $group: {
            _id: null,
            totalBugs: { $sum: 1 },
            oldBugs: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$status', 'Closed'] },
                      { $lt: ['$createdAt', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] }
                    ]
                  },
                  1, 0
                ]
              }
            },
            overduelBugs: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$status', 'Closed'] },
                      { $lt: ['$dueDate', new Date()] },
                      { $ne: ['$dueDate', null] }
                    ]
                  },
                  1, 0
                ]
              }
            },
            highPriorityOpen: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$priority', 'High'] },
                      { $ne: ['$status', 'Closed'] }
                    ]
                  },
                  1, 0
                ]
              }
            }
          }
        }
      ]);

      const metrics = healthMetrics[0] || {};
      
      // Calculate health score (0-100)
      let healthScore = 100;
      healthScore -= (metrics.oldBugs || 0) * 5; // -5 for each old bug
      healthScore -= (metrics.overduelBugs || 0) * 10; // -10 for each overdue bug
      healthScore -= (metrics.highPriorityOpen || 0) * 3; // -3 for each high priority open bug
      
      healthScore = Math.max(0, Math.min(100, healthScore));

      let healthLevel = 'Excellent';
      if (healthScore < 70) healthLevel = 'Poor';
      else if (healthScore < 85) healthLevel = 'Good';

      return {
        score: healthScore,
        level: healthLevel,
        indicators: {
          oldBugs: metrics.oldBugs || 0,
          overduelBugs: metrics.overduelBugs || 0,
          highPriorityOpen: metrics.highPriorityOpen || 0
        }
      };
    } catch (error) {
      return { score: 0, level: 'Unknown', indicators: {} };
    }
  }

  static async getTeamCollaborationPatterns(teamId, dateFrom) {
    try {
      const patterns = await Bug.aggregate([
        {
          $match: {
            team: mongoose.Types.ObjectId(teamId),
            createdAt: { $gte: dateFrom },
            deleted: false
          }
        },
        {
          $group: {
            _id: {
              creator: '$creator',
              assignee: '$assignee'
            },
            count: { $sum: 1 },
            avgResolutionTime: {
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
            }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ]);

      return patterns;
    } catch (error) {
      return [];
    }
  }

  static processDistributions(distributions) {
    const processed = {
      status: {},
      priority: {}
    };

    if (distributions.statusDist) {
      distributions.statusDist.forEach(item => {
        processed.status[item.k] = (processed.status[item.k] || 0) + item.v;
      });
    }

    if (distributions.priorityDist) {
      distributions.priorityDist.forEach(item => {
        processed.priority[item.k] = (processed.priority[item.k] || 0) + item.v;
      });
    }

    return processed;
  }

  static generateTeamInsights(analyticsData, teamHealth) {
    const insights = [];
    const stats = analyticsData.overallStats[0] || {};

    // Resolution rate insight
    const resolutionRate = stats.totalBugs > 0 ? (stats.closedBugs / stats.totalBugs * 100) : 0;
    if (resolutionRate > 80) {
      insights.push({ type: 'positive', message: 'Excellent bug resolution rate' });
    } else if (resolutionRate < 50) {
      insights.push({ type: 'warning', message: 'Low bug resolution rate needs attention' });
    }

    // Team health insight
    if (teamHealth.score < 70) {
      insights.push({ type: 'alert', message: 'Team health indicators show areas for improvement' });
    }

    // High priority bugs insight
    if (stats.highPriorityBugs > 5) {
      insights.push({ type: 'warning', message: 'High number of high-priority bugs' });
    }

    return insights;
  }

  static calculateTeamProductivityScore(stats) {
    const resolutionRate = stats.totalBugs > 0 ? (stats.closedBugs / stats.totalBugs) : 0;
    const recentActivity = stats.recentBugs || 0;
    const priority = stats.highPriorityBugs || 0;

    let score = resolutionRate * 50; // 50% weight on resolution
    score += Math.min(recentActivity * 2, 30); // 30% max for recent activity
    score -= priority * 2; // Penalty for high priority bugs
    score += (stats.avgResolutionTime ? Math.max(0, 20 - stats.avgResolutionTime) : 0); // Speed bonus

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  static calculateTeamEfficiency(stats) {
    const resolutionTime = stats.avgResolutionTime || 0;
    if (resolutionTime === 0) return 'Unknown';
    if (resolutionTime < 3) return 'Excellent';
    if (resolutionTime < 7) return 'Good';
    if (resolutionTime < 14) return 'Average';
    return 'Needs Improvement';
  }

  static calculateTeamRankings(comparison) {
    return {
      byResolutionRate: [...comparison].sort((a, b) => b.metrics.resolutionRate - a.metrics.resolutionRate),
      byProductivity: [...comparison].sort((a, b) => b.metrics.productivityScore - a.metrics.productivityScore),
      byBugVolume: [...comparison].sort((a, b) => b.metrics.totalBugs - a.metrics.totalBugs),
      byRecentActivity: [...comparison].sort((a, b) => b.metrics.recentBugs - a.metrics.recentBugs)
    };
  }

  static calculateNetworkMetrics(network) {
    const { nodes, edges } = network;
    
    // Calculate centrality metrics
    const nodeDegrees = new Map();
    
    edges.forEach(edge => {
      nodeDegrees.set(edge.source, (nodeDegrees.get(edge.source) || 0) + edge.weight);
      nodeDegrees.set(edge.target, (nodeDegrees.get(edge.target) || 0) + edge.weight);
    });

    const maxDegree = Math.max(...Array.from(nodeDegrees.values()));
    const avgDegree = Array.from(nodeDegrees.values()).reduce((a, b) => a + b, 0) / nodeDegrees.size;

    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      density: edges.length / (nodes.length * (nodes.length - 1) / 2),
      maxDegree,
      avgDegree: avgDegree.toFixed(2),
      mostConnected: Array.from(nodeDegrees.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([nodeId, degree]) => {
          const node = nodes.find(n => n.id === nodeId);
          return { name: node?.name, degree };
        })
    };
  }
}

module.exports = TeamQueries;
