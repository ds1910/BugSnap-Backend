const natural = require('natural');
const { WordTokenizer, SentimentAnalyzer, PorterStemmer } = natural;

// Import models for direct queries
const Bug = require('../../model/bug');
const Team = require('../../model/team');
const User = require('../../model/user');
const Comment = require('../../model/comment');
const File = require('../../model/file');
const ActivityLog = require('../../model/activityLog');

// Import intent handlers
const BugIntents = require('../intents/bugIntents');
const TeamIntents = require('../intents/teamIntents');
const UserIntents = require('../intents/userIntents');
const CommentIntents = require('../intents/commentIntents');
const FileIntents = require('../intents/fileIntents');

class QueryProcessor {
  constructor() {
    this.tokenizer = new WordTokenizer();
    this.analyzer = new SentimentAnalyzer('English', PorterStemmer, 'afinn');
    this.contextStack = new Map(); // Store conversation context per user
    this.dependencyGraph = new Map(); // Track query dependencies
  }

  /**
   * Main entry point for processing all types of queries
   * Handles simple, composite, independent, and dependent queries
   */
  async processQuery(message, userId, context = {}) {
    try {
      // Parse the query to understand its structure
      const parsedQuery = this.parseComplexQuery(message);
      
      // Determine if this is a composite query (multiple actions/entities)
      if (parsedQuery.isComposite) {
        return await this.handleCompositeQuery(parsedQuery, userId, context);
      }
      
      // Check if this is a dependent query (relies on previous results)
      if (parsedQuery.isDependentQuery) {
        return await this.handleDependentQuery(parsedQuery, userId, context);
      }
      
      // Handle as independent query
      return await this.handleIndependentQuery(parsedQuery, userId, context);
      
    } catch (error) {
    // console.error('Query processing error:', error);
      return {
        success: false,
        message: 'I encountered an error processing your request. Please try rephrasing your query.',
        error: error.message
      };
    }
  }

  /**
   * Parse complex queries to identify structure, entities, and relationships
   */
  parseComplexQuery(message) {
    const tokens = this.tokenizer.tokenize(message.toLowerCase());
    const query = {
      originalMessage: message,
      tokens,
      entities: new Map(),
      actions: [],
      filters: {},
      joinConditions: [],
      aggregations: [],
      timeRanges: [],
      comparisons: [],
      isComposite: false,
      isDependentQuery: false,
      queryType: 'simple',
      dependencies: [],
      subQueries: []
    };

    // Detect composite indicators
    const compositeIndicators = [
      'and', 'also', 'plus', 'as well as', 'along with', 'including', 
      'together with', 'combined with', 'both', 'either', 'then'
    ];
    
    const dependentIndicators = [
      'from that', 'based on', 'using the', 'with those', 'for each',
      'in those', 'of the above', 'from the previous', 'where'
    ];

    // Check for composite query patterns
    query.isComposite = this.containsAny(message.toLowerCase(), compositeIndicators) ||
                       this.countActions(message) > 1 ||
                       this.countEntities(message) > 1;

    // Check for dependent query patterns
    query.isDependentQuery = this.containsAny(message.toLowerCase(), dependentIndicators) ||
                            this.hasConditionalStructure(message);

    // Extract all entities
    query.entities = this.extractAllEntities(message);
    
    // Extract all actions
    query.actions = this.extractAllActions(message);
    
    // Extract filters and conditions
    query.filters = this.extractFilters(message);
    
    // Extract join conditions for composite queries
    query.joinConditions = this.extractJoinConditions(message);
    
    // Extract aggregations (count, sum, average, etc.)
    query.aggregations = this.extractAggregations(message);
    
    // Extract time ranges
    query.timeRanges = this.extractTimeRanges(message);
    
    // Extract comparisons
    query.comparisons = this.extractComparisons(message);

    // Determine query type
    if (query.aggregations.length > 0) {
      query.queryType = 'analytics';
    } else if (query.comparisons.length > 0) {
      query.queryType = 'comparison';
    } else if (query.isComposite) {
      query.queryType = 'composite';
    } else if (query.isDependentQuery) {
      query.queryType = 'dependent';
    }

    return query;
  }

  /**
   * Handle composite queries that involve multiple entities or operations
   * Examples: "Show me all high priority bugs and their assigned team members"
   *          "Create a team and add these users to it"
   */
  async handleCompositeQuery(parsedQuery, userId, context) {
    const results = [];
    const compositeResult = {
      success: true,
      message: '',
      data: {},
      subResults: []
    };

    try {
      // Break down composite query into sub-queries
      const subQueries = this.decomposeCompositeQuery(parsedQuery);
      
      for (let i = 0; i < subQueries.length; i++) {
        const subQuery = subQueries[i];
        
        // Execute each sub-query
        const subResult = await this.executeSubQuery(subQuery, userId, context);
        
        // Store result for potential use in subsequent queries
        compositeResult.subResults.push(subResult);
        
        // Check if next sub-query depends on this result
        if (i < subQueries.length - 1) {
          const nextQuery = subQueries[i + 1];
          if (nextQuery.dependsOn) {
            // Pass results as context to next query
            context.previousResult = subResult;
          }
        }
      }

      // Combine results based on query type
      compositeResult.data = this.combineSubResults(compositeResult.subResults, parsedQuery);
      compositeResult.message = this.generateCompositeMessage(compositeResult.subResults, parsedQuery);
      
      return compositeResult;
      
    } catch (error) {
    // console.error('Composite query error:', error);
      return {
        success: false,
        message: 'Error processing your multi-part request. Please try breaking it into smaller parts.',
        error: error.message
      };
    }
  }

  /**
   * Handle dependent queries that rely on results from previous queries
   * Examples: "Show me bugs from that team"
   *          "Add those users to my project"
   */
  async handleDependentQuery(parsedQuery, userId, context) {
    try {
      // Check if we have the required context
      const dependencies = this.identifyDependencies(parsedQuery);
      const missingDependencies = [];

      for (const dependency of dependencies) {
        if (!context[dependency.contextKey]) {
          missingDependencies.push(dependency);
        }
      }

      if (missingDependencies.length > 0) {
        return {
          success: false,
          message: `I need more context for "${missingDependencies[0].entity}". Could you please specify which ${missingDependencies[0].entity} you're referring to?`,
          needsContext: true,
          missingDependencies
        };
      }

      // Resolve dependencies and execute query
      const resolvedQuery = this.resolveDependencies(parsedQuery, context);
      return await this.executeResolvedQuery(resolvedQuery, userId, context);
      
    } catch (error) {
    // console.error('Dependent query error:', error);
      return {
        success: false,
        message: 'Error processing your request. Please provide more specific information.',
        error: error.message
      };
    }
  }

  /**
   * Handle independent queries that don't rely on previous context
   * Examples: "Show all my bugs"
   *          "Create a new team called Development"
   */
  async handleIndependentQuery(parsedQuery, userId, context) {
    try {
      const { entities, actions, queryType } = parsedQuery;
      
      // Route to appropriate handler based on primary entity and action
      const primaryEntity = this.getPrimaryEntity(entities);
      const primaryAction = this.getPrimaryAction(actions);
      
      switch (primaryEntity) {
        case 'bug':
          return await this.handleBugQuery(parsedQuery, userId, context);
        case 'team':
          return await this.handleTeamQuery(parsedQuery, userId, context);
        case 'user':
          return await this.handleUserQuery(parsedQuery, userId, context);
        case 'comment':
          return await this.handleCommentQuery(parsedQuery, userId, context);
        case 'file':
          return await this.handleFileQuery(parsedQuery, userId, context);
        case 'activity':
          return await this.handleActivityQuery(parsedQuery, userId, context);
        default:
          return await this.handleGeneralQuery(parsedQuery, userId, context);
      }
      
    } catch (error) {
    // console.error('Independent query error:', error);
      return {
        success: false,
        message: 'Error processing your request. Please try rephrasing your query.',
        error: error.message
      };
    }
  }

  /**
   * Handle all possible bug-related queries
   */
  async handleBugQuery(parsedQuery, userId, context) {
    const { actions, filters, aggregations, timeRanges } = parsedQuery;
    const primaryAction = this.getPrimaryAction(actions);

    switch (primaryAction) {
      case 'create':
        return await this.createBugFromQuery(parsedQuery, userId);
      case 'list':
      case 'show':
      case 'get':
        return await this.getBugsList(parsedQuery, userId);
      case 'update':
      case 'modify':
        return await this.updateBugFromQuery(parsedQuery, userId);
      case 'delete':
      case 'remove':
        return await this.deleteBugFromQuery(parsedQuery, userId);
      case 'assign':
        return await this.assignBugFromQuery(parsedQuery, userId);
      case 'count':
        return await this.countBugs(parsedQuery, userId);
      case 'analytics':
        return await this.getBugAnalytics(parsedQuery, userId);
      default:
        return await this.getBugsList(parsedQuery, userId);
    }
  }

  /**
   * Handle all possible team-related queries
   */
  async handleTeamQuery(parsedQuery, userId, context) {
    const { actions } = parsedQuery;
    const primaryAction = this.getPrimaryAction(actions);

    switch (primaryAction) {
      case 'create':
        return await this.createTeamFromQuery(parsedQuery, userId);
      case 'list':
      case 'show':
      case 'get':
        return await this.getTeamsList(parsedQuery, userId);
      case 'add':
        return await this.addTeamMemberFromQuery(parsedQuery, userId);
      case 'remove':
        return await this.removeTeamMemberFromQuery(parsedQuery, userId);
      case 'analytics':
        return await this.getTeamAnalytics(parsedQuery, userId);
      default:
        return await this.getTeamsList(parsedQuery, userId);
    }
  }

  /**
   * Create bug from natural language query
   */
  async createBugFromQuery(parsedQuery, userId) {
    try {
      const entities = parsedQuery.entities;
      const title = entities.get('title') || entities.get('bugTitle') || 'New Bug';
      const description = entities.get('description') || '';
      const priority = entities.get('priority') || 'medium';
      const status = entities.get('status') || 'open';
      const teamId = entities.get('teamId') || entities.get('team');

      // Get user's teams if no team specified
      if (!teamId) {
        const userTeams = await Team.find({ 'members.user': userId }).lean();
        if (userTeams.length === 0) {
          return {
            success: false,
            message: 'You need to be part of a team to create bugs. Would you like to create a team first?',
            suggestedAction: 'create_team'
          };
        }
        
        if (userTeams.length === 1) {
          entities.set('teamId', userTeams[0]._id);
        } else {
          return {
            success: false,
            message: 'Which team should this bug be created for?',
            needsSelection: true,
            options: userTeams.map(team => ({ id: team._id, name: team.name }))
          };
        }
      }

      const bugData = {
        title,
        description,
        priority,
        status,
        teamId: entities.get('teamId'),
        createdBy: userId
      };

      // Create the bug
      const newBug = await Bug.create(bugData);
      
      // Populate the created bug
      const populatedBug = await Bug.findById(newBug._id)
        .populate('createdBy', 'name email')
        .populate('teamId', 'name')
        .lean();

      return {
        success: true,
        message: `Bug "${title}" created successfully.`,
        data: populatedBug
      };

    } catch (error) {
    // console.error('Error creating bug from query:', error);
      return {
        success: false,
        message: 'Error creating bug. Please try again.',
        error: error.message
      };
    }
  }

  /**
   * Get bugs list with complex filtering
   */
  async getBugsList(parsedQuery, userId) {
    try {
      const filters = this.buildBugFilters(parsedQuery, userId);
      
      // Get user's teams
      const userTeams = await Team.find({ 'members.user': userId }).select('_id').lean();
      
      if (userTeams.length === 0) {
        return {
          success: false,
          message: 'You are not a member of any teams.',
          data: []
        };
      }

      const teamIds = userTeams.map(team => team._id);
      
      // Build query
      const query = { teamId: { $in: teamIds } };
      
      // Apply filters
      if (filters.status) query.status = filters.status;
      if (filters.priority) query.priority = filters.priority;
      if (filters.assignedTo) query.assignedTo = { $in: [filters.assignedTo] };
      if (filters.createdBy) query.createdBy = filters.createdBy;
      if (filters.teamId) query.teamId = filters.teamId;
      if (filters.tags && filters.tags.length > 0) query.tags = { $in: filters.tags };
      
      // Execute query
      const bugs = await Bug.find(query)
        .populate('createdBy', 'name email')
        .populate('assignedTo', 'name email')
        .populate('teamId', 'name')
        .sort({ createdAt: -1 })
        .lean();
      
      // Apply additional processing for analytics queries
      if (parsedQuery.queryType === 'analytics') {
        const analytics = this.calculateBugAnalytics(bugs);
        return {
          success: true,
          message: this.generateAnalyticsMessage(analytics, parsedQuery),
          data: bugs,
          analytics
        };
      }

      const message = bugs.length > 0 
        ? `Found ${bugs.length} bug${bugs.length === 1 ? '' : 's'}.`
        : 'No bugs found matching your criteria.';

      return {
        success: true,
        message,
        data: bugs
      };

    } catch (error) {
    // console.error('Error getting bugs list:', error);
      return {
        success: false,
        message: 'Error retrieving bugs. Please try again.',
        error: error.message
      };
    }
  }

  /**
   * Build comprehensive bug filters from natural language
   */
  buildBugFilters(parsedQuery, userId) {
    const filters = {};
    const { filters: queryFilters, timeRanges, entities } = parsedQuery;

    // Status filters
    if (queryFilters.status) {
      filters.status = queryFilters.status;
    }

    // Priority filters
    if (queryFilters.priority) {
      filters.priority = queryFilters.priority;
    }

    // Assignment filters
    if (queryFilters.assignedToMe || entities.get('assignedToMe')) {
      filters.assignedTo = userId;
    }

    if (queryFilters.createdByMe || entities.get('createdByMe')) {
      filters.createdBy = userId;
    }

    // Team filters
    if (entities.get('teamId')) {
      filters.teamId = entities.get('teamId');
    }

    // Time range filters
    if (timeRanges.length > 0) {
      const timeRange = timeRanges[0];
      if (timeRange.startDate) filters.startDate = { $gte: timeRange.startDate };
      if (timeRange.endDate) filters.endDate = { $lte: timeRange.endDate };
    }

    // Tag filters
    if (entities.get('tags')) {
      filters.tags = { $in: entities.get('tags') };
    }

    return filters;
  }

  /**
   * Calculate analytics for bugs
   */
  calculateBugAnalytics(bugs) {
    return {
      total: bugs.length,
      byStatus: this.groupBy(bugs, 'status'),
      byPriority: this.groupBy(bugs, 'priority'),
      averageAge: this.calculateAverageAge(bugs),
      completionRate: this.calculateCompletionRate(bugs),
      assignmentDistribution: this.calculateAssignmentDistribution(bugs)
    };
  }

  /**
   * Utility function to group array by property
   */
  groupBy(array, property) {
    return array.reduce((groups, item) => {
      const key = item[property] || 'unspecified';
      groups[key] = (groups[key] || 0) + 1;
      return groups;
    }, {});
  }

  /**
   * Calculate average age of bugs in days
   */
  calculateAverageAge(bugs) {
    if (bugs.length === 0) return 0;
    
    const now = new Date();
    const totalAge = bugs.reduce((sum, bug) => {
      const created = new Date(bug.createdAt);
      const ageInDays = (now - created) / (1000 * 60 * 60 * 24);
      return sum + ageInDays;
    }, 0);
    
    return Math.round(totalAge / bugs.length);
  }

  /**
   * Calculate completion rate
   */
  calculateCompletionRate(bugs) {
    if (bugs.length === 0) return 0;
    const completed = bugs.filter(bug => 
      bug.status === 'closed' || bug.status === 'resolved'
    ).length;
    return Math.round((completed / bugs.length) * 100);
  }

  /**
   * Calculate assignment distribution
   */
  calculateAssignmentDistribution(bugs) {
    const assigned = bugs.filter(bug => bug.assignedTo && bug.assignedTo.length > 0).length;
    const unassigned = bugs.length - assigned;
    return { assigned, unassigned };
  }

  /**
   * Decompose composite query into sub-queries
   */
  decomposeCompositeQuery(parsedQuery) {
    const subQueries = [];
    // Implementation for breaking down composite queries
    // This would analyze the query structure and create sub-queries
    return subQueries;
  }

  /**
   * Execute a sub-query
   */
  async executeSubQuery(subQuery, userId, context) {
    // Implementation for executing individual sub-queries
    return await this.handleIndependentQuery(subQuery, userId, context);
  }

  /**
   * Helper methods for query parsing
   */
  containsAny(text, patterns) {
    return patterns.some(pattern => text.includes(pattern));
  }

  countActions(message) {
    const actionWords = ['create', 'show', 'list', 'update', 'delete', 'add', 'remove', 'get', 'find'];
    return actionWords.filter(action => message.toLowerCase().includes(action)).length;
  }

  countEntities(message) {
    const entityWords = ['bug', 'team', 'user', 'comment', 'file', 'issue', 'project'];
    return entityWords.filter(entity => message.toLowerCase().includes(entity)).length;
  }

  hasConditionalStructure(message) {
    const conditionalWords = ['if', 'when', 'where', 'that', 'which', 'those'];
    return this.containsAny(message.toLowerCase(), conditionalWords);
  }

  extractAllEntities(message) {
    const entities = new Map();
    const lowerMessage = message.toLowerCase();
    
    // Extract bug-related entities
    const bugTitlePatterns = [
      /(?:bug|issue|problem)\s+(?:called|named|titled)?\s*["']([^"']+)["']/i,
      /(?:create|add|new)\s+(?:bug|issue)\s+["']([^"']+)["']/i,
      /(?:bug|issue)\s+(?:for|about|with)\s+(.+?)(?:\.|$|,)/i,
      /(?:create|add|new)\s+(?:bug|issue)\s+(?:for|about|with)?\s*(.+?)(?:\.|$|,)/i,
      /["']([^"']+)["']\s+(?:bug|issue|problem)/i
    ];
    
    for (const pattern of bugTitlePatterns) {
      const match = message.match(pattern);
      if (match) {
        entities.set('title', match[1].trim());
        entities.set('bugTitle', match[1].trim());
        break;
      }
    }
    
    // Extract team-related entities
    const teamNamePatterns = [
      /(?:team|group)\s+(?:called|named)?\s*["']([^"']+)["']/i,
      /(?:create|add|new)\s+(?:team|group)\s+["']([^"']+)["']/i,
      /(?:team|group)\s+(?:for|about)?\s*(.+?)(?:\.|$)/i,
      /(?:create|add|new)\s+(?:team|group)\s+(?:for|about)?\s*(.+?)(?:\.|$)/i
    ];
    
    for (const pattern of teamNamePatterns) {
      const match = message.match(pattern);
      if (match) {
        entities.set('teamName', match[1].trim());
        break;
      }
    }
    
    // Extract priority
    if (lowerMessage.includes('high') || lowerMessage.includes('urgent') || lowerMessage.includes('critical')) {
      entities.set('priority', lowerMessage.includes('critical') ? 'critical' : 'high');
    } else if (lowerMessage.includes('low')) {
      entities.set('priority', 'low');
    } else if (lowerMessage.includes('medium') || lowerMessage.includes('normal')) {
      entities.set('priority', 'medium');
    }
    
    // Extract status
    if (lowerMessage.includes('open')) {
      entities.set('status', 'open');
    } else if (lowerMessage.includes('closed') || lowerMessage.includes('resolved')) {
      entities.set('status', 'closed');
    } else if (lowerMessage.includes('in progress') || lowerMessage.includes('working')) {
      entities.set('status', 'in progress');
    }
    
    // Extract assignment indicators
    if (lowerMessage.includes('my bugs') || lowerMessage.includes('assigned to me')) {
      entities.set('assignedToMe', true);
    }
    
    if (lowerMessage.includes('created by me') || lowerMessage.includes('i created')) {
      entities.set('createdByMe', true);
    }
    
    // Extract description
    const descriptionPatterns = [
      /(?:description|desc|details?):\s*(.+?)(?:\.|$)/i,
      /(?:about|regarding|concerning)\s+(.+?)(?:\.|$)/i,
      /(?:with description|described as)\s+["']([^"']+)["']/i
    ];
    
    for (const pattern of descriptionPatterns) {
      const match = message.match(pattern);
      if (match) {
        entities.set('description', match[1].trim());
        break;
      }
    }
    
    return entities;
  }

  extractAllActions(message) {
    const actions = [];
    const actionPatterns = [
      /create|add|new|make/i,
      /show|list|display|get|find/i,
      /update|edit|modify|change/i,
      /delete|remove|cancel/i,
      /assign|delegate/i,
      /count|total|number/i,
      /analytics|stats|metrics/i
    ];
    
    for (const pattern of actionPatterns) {
      if (pattern.test(message)) {
        const match = message.match(pattern);
        if (match) actions.push(match[0].toLowerCase());
      }
    }
    
    return actions;
  }

  extractFilters(message) {
    const filters = {};
    // Implementation for extracting filters
    return filters;
  }

  extractJoinConditions(message) {
    const conditions = [];
    // Implementation for extracting join conditions
    return conditions;
  }

  extractAggregations(message) {
    const aggregations = [];
    // Implementation for extracting aggregation operations
    return aggregations;
  }

  extractTimeRanges(message) {
    const ranges = [];
    // Implementation for extracting time ranges
    return ranges;
  }

  extractComparisons(message) {
    const comparisons = [];
    // Implementation for extracting comparison operations
    return comparisons;
  }

  getPrimaryEntity(entities) {
    // Return the most relevant entity for the query
    const entityKeys = Array.from(entities.keys());
    const priorities = ['bug', 'team', 'user', 'comment', 'file', 'activity'];
    
    for (const priority of priorities) {
      if (entityKeys.includes(priority)) return priority;
    }
    
    return entityKeys[0] || 'general';
  }

  getPrimaryAction(actions) {
    // Return the most relevant action for the query
    const actionPriorities = ['create', 'update', 'delete', 'list', 'show', 'get', 'count', 'analytics'];
    
    for (const priority of actionPriorities) {
      if (actions.includes(priority)) return priority;
    }
    
    return actions[0] || 'get';
  }

  // Additional helper methods for other query types
  async handleUserQuery(parsedQuery, userId, context) {
    // Implementation for user-related queries
    return { success: true, message: 'User query processed', data: [] };
  }

  async handleCommentQuery(parsedQuery, userId, context) {
    // Implementation for comment-related queries
    return { success: true, message: 'Comment query processed', data: [] };
  }

  async handleFileQuery(parsedQuery, userId, context) {
    // Implementation for file-related queries
    return { success: true, message: 'File query processed', data: [] };
  }

  async handleActivityQuery(parsedQuery, userId, context) {
    // Implementation for activity-related queries
    return { success: true, message: 'Activity query processed', data: [] };
  }

  async handleGeneralQuery(parsedQuery, userId, context) {
    // Implementation for general queries
    return { success: true, message: 'General query processed', data: [] };
  }

  generateCompositeMessage(subResults, parsedQuery) {
    return 'Composite query completed successfully.';
  }

  combineSubResults(subResults, parsedQuery) {
    return { combinedData: subResults };
  }

  identifyDependencies(parsedQuery) {
    return [];
  }

  resolveDependencies(parsedQuery, context) {
    return parsedQuery;
  }

  async executeResolvedQuery(resolvedQuery, userId, context) {
    return await this.handleIndependentQuery(resolvedQuery, userId, context);
  }

  generateAnalyticsMessage(analytics, parsedQuery) {
    return `Analytics: ${analytics.total} total items found.`;
  }

  // Placeholder methods for team operations
  async createTeamFromQuery(parsedQuery, userId) {
    return { success: true, message: 'Team creation feature to be implemented' };
  }

  async getTeamsList(parsedQuery, userId) {
    return { success: true, message: 'Team list feature to be implemented' };
  }

  async addTeamMemberFromQuery(parsedQuery, userId) {
    return { success: true, message: 'Add member feature to be implemented' };
  }

  async removeTeamMemberFromQuery(parsedQuery, userId) {
    return { success: true, message: 'Remove member feature to be implemented' };
  }

  async getTeamAnalytics(parsedQuery, userId) {
    return { success: true, message: 'Team analytics feature to be implemented' };
  }

  async updateBugFromQuery(parsedQuery, userId) {
    return { success: true, message: 'Bug update feature to be implemented' };
  }

  async deleteBugFromQuery(parsedQuery, userId) {
    return { success: true, message: 'Bug deletion feature to be implemented' };
  }

  async assignBugFromQuery(parsedQuery, userId) {
    return { success: true, message: 'Bug assignment feature to be implemented' };
  }

  async countBugs(parsedQuery, userId) {
    return { success: true, message: 'Bug count feature to be implemented' };
  }

  async getBugAnalytics(parsedQuery, userId) {
    return { success: true, message: 'Bug analytics feature to be implemented' };
  }
}

module.exports = QueryProcessor;
