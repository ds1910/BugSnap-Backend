console.log('🤖 Loading bot controller...');

const aiAgent = require('../services/aiAgent');
const botIntegration = require('../services/botIntegration');
const BugIntents = require('../intents/bugIntents');
const UserIntents = require('../intents/userIntents');
const TeamIntents = require('../intents/teamIntents');
const CommentIntents = require('../intents/commentIntents');
const FileIntents = require('../intents/fileIntents');
const axios = require('axios');

console.log('✅ Bot controller dependencies loaded');

// Bot controller for handling AI agent interactions
class BotController {
  
  // Main chat endpoint
  static async chat(req, res) {
    console.log('💬 Chat endpoint called');
    try {
      const { message, context } = req.body;
      const userId = req.user?.id;
      
      console.log('📨 Chat request:', { message, userId, hasContext: !!context });
      
      // Validate message input
      if (!message) {
        console.log('❌ No message provided');
        return res.status(400).json({
          success: false,
          error: 'Message is required'
        });
      }
      
      if (typeof message !== 'string') {
        console.log('❌ Invalid message type:', typeof message);
        return res.status(400).json({
          success: false,
          error: 'Message must be a string'
        });
      }

      if (message.trim().length === 0) {
        console.log('❌ Empty message provided');
        return res.status(400).json({
          success: false,
          error: 'Message cannot be empty'
        });
      }
      
      console.log('🚀 Calling AI agent processMessage...');
      // Process the message using AI agent
      const response = await aiAgent.processMessage(userId, message, req.user, context);
      console.log('✅ AI agent response received:', { 
        success: response.success, 
        hasText: !!response.text, 
        hasMessage: !!response.message,
        intent: response.intent 
      });
      
      // Get contextual suggestions from the response
      const suggestions = response.suggestions || [];
      console.log('💡 Suggestions generated:', suggestions.length);
      
      const finalResponse = {
        success: true,
        data: {
          response: response.text || response.message,
          intent: response.intent,
          confidence: response.confidence,
          actions: response.actions || [],
          data: response.data || {},
          suggestions: suggestions,
          timestamp: new Date().toISOString()
        }
      };
      
      console.log('📤 Sending response to frontend:', { 
        success: finalResponse.success, 
        responseLength: finalResponse.data?.response?.length 
      });
      
      return res.json(finalResponse);
      
    } catch (error) {
      console.error('❌ Bot chat error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to process message'
      });
    }
  }

  // Process natural language query endpoint  
  static async processNaturalQuery(req, res) {
    try {
      const { query, entities = ['all'] } = req.body;
      const userId = req.user?.id;
      
      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Query is required'
        });
      }

      if (typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Query must be a string'
        });
      }

      if (query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Query cannot be empty'
        });
      }
      
      // Process using AI agent
      const results = await BotController.performGeneralSearch(query, entities, userId, req.user);
      
      return res.json({
        success: true,
        data: {
          query,
          results,
          entities,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      // console.error('Natural query processing error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to process natural language query'
      });
    }
  }

  // Get query suggestions based on current context
  static async getQuerySuggestions(req, res) {
    try {
      const { context = 'general', entityType = 'all' } = req.query;
      
      const suggestions = BotController.generateQuerySuggestions(context, entityType);
      
      return res.json({
        success: true,
        data: {
          suggestions,
          context,
          entityType,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      // console.error('Get suggestions error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate suggestions'
      });
    }
  }

  // Generate contextual query suggestions
  static generateQuerySuggestions(context, entityType) {
    const suggestions = {
      general: [
        "Show me all bugs",
        "List my teams",
        "What's my current workload?",
        "Show recent activity",
        "Display bug statistics"
      ],
      bugs: [
        "Show high priority bugs",
        "List bugs assigned to me", 
        "Find open bugs in current team",
        "Show recently created bugs",
        "Display bug trends this month"
      ],
      teams: [
        "Show team members",
        "List team statistics",
        "Show team performance",
        "Display team workload",
        "Find team bugs"
      ],
      users: [
        "Show user assignments",
        "List user activity",
        "Display user statistics",
        "Find user teams",
        "Show user performance"
      ],
      analytics: [
        "Show project analytics",
        "Display performance metrics",
        "Generate monthly report",
        "Show trend analysis",
        "Display team comparison"
      ]
    };

    const entitySuggestions = {
      bugs: [
        "Create new bug",
        "Update bug status",
        "Assign bug to user",
        "Set bug priority",
        "Add bug comment"
      ],
      teams: [
        "Add team member",
        "Remove team member", 
        "Update team settings",
        "Create new team",
        "Archive team"
      ],
      users: [
        "Update user profile",
        "Change user role",
        "Assign user to team",
        "Remove user assignment",
        "Update user permissions"
      ]
    };

    let contextSuggestions = suggestions[context] || suggestions.general;
    let entitySpecificSuggestions = entitySuggestions[entityType] || [];
    
    return [...contextSuggestions, ...entitySpecificSuggestions].slice(0, 10);
  }

  // Perform general search across entities
  static async performGeneralSearch(query, entities, userId, user) {
    const results = {};
    
    try {
      // Search bugs if included
      if (entities.includes('all') || entities.includes('bugs')) {
        try {
          const bugs = await BugIntents.searchBugs(query, userId, user);
          results.bugs = bugs;
        } catch (error) {
          // console.error('Bug search error:', error);
          results.bugs = [];
        }
      }
      
      // Search teams if included  
      if (entities.includes('all') || entities.includes('teams')) {
        try {
          const teams = await TeamIntents.searchTeams(query, userId, user);
          results.teams = teams;
        } catch (error) {
          // console.error('Team search error:', error);
          results.teams = [];
        }
      }
      
      // Search users if included
      if (entities.includes('all') || entities.includes('users')) {
        try {
          const users = await UserIntents.searchUsers(query, userId, user);
          results.users = users;
        } catch (error) {
          // console.error('User search error:', error);
          results.users = [];
        }
      }
      
      // Search comments if included
      if (entities.includes('all') || entities.includes('comments')) {
        try {
          const comments = await CommentIntents.searchComments(query, userId, user);
          results.comments = comments;
        } catch (error) {
          // console.error('Comment search error:', error);
          results.comments = [];
        }
      }
      
      // Search files if included
      if (entities.includes('all') || entities.includes('files')) {
        try {
          const files = await FileIntents.searchFiles(query, userId, user);
          results.files = files;
        } catch (error) {
          // console.error('File search error:', error);
          results.files = [];
        }
      }
      
      return results;
      
    } catch (error) {
      // console.error('General search error:', error);
      throw error;
    }
  }

  // Get user context and initial suggestions for chatbot initialization
  static async getUserContext(req, res) {
    try {
      const userId = req.user?.id;
      const user = req.user;
      
      // Get basic user context
      const userContext = {
        userId: user?.id,
        userName: user?.name,
        userEmail: user?.email,
        activeTeams: user?.teams || [],
        lastActivity: new Date().toISOString()
      };
      
      // Generate initial suggestions based on user's context
      const suggestions = BotController.generateQuerySuggestions('general', 'all');
      
      return res.json({
        success: true,
        data: {
          context: userContext,
          suggestions: suggestions.slice(0, 5), // Return top 5 suggestions
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      // console.error('Get user context error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get user context'
      });
    }
  }

  // Health check endpoint for bot service
  static async healthCheck(req, res) {
    try {
      return res.json({
        success: true,
        message: 'Bot service is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Bot service health check failed'
      });
    }
  }
}

module.exports = BotController;
