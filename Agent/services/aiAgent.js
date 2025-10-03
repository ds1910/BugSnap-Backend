console.log('🔄 Loading aiAgent.js...');

const natural = require('natural');
const { WordTokenizer, SentimentAnalyzer, PorterStemmer } = natural;

console.log('✅ Natural library loaded');

// Import all intent handlers
console.log('📥 Loading intent handlers...');
const BugIntents = require('../intents/bugIntents');
console.log('✅ BugIntents loaded');
const UserIntents = require('../intents/userIntents');
console.log('✅ UserIntents loaded');
const TeamIntents = require('../intents/teamIntents');
console.log('✅ TeamIntents loaded');
const CommentIntents = require('../intents/commentIntents');
console.log('✅ CommentIntents loaded');
const FileIntents = require('../intents/fileIntents');
console.log('✅ FileIntents loaded');

// Import all query systems
console.log('📥 Loading query systems...');
const BugQueries = require('../queries/bugQueries');
const UserQueries = require('../queries/userQueries');
const TeamQueries = require('../queries/teamQueries');
console.log('✅ Query systems loaded');

// Import models
const Team = require('../../model/team');
const Bug = require('../../model/bug');
const User = require('../../model/user');
const Comment = require('../../model/comment');
const File = require('../../model/file');
const ActivityLog = require('../../model/activityLog');

// Initialize components
const tokenizer = new WordTokenizer();
const analyzer = new SentimentAnalyzer('English', PorterStemmer, 'afinn');

class AIAgentService {
  constructor() {
    console.log('🤖 Initializing AIAgentService...');
    this.intents = this.initializeIntents();
    console.log('✅ Intents initialized');
    this.context = new Map(); // Store conversation context per user
    this.conversationHistory = new Map(); // Track conversation history per user
    this.capabilities = this.initializeCapabilities();
    console.log('✅ AIAgentService fully initialized');
  }

  // Initialize comprehensive capabilities mapping
  initializeCapabilities() {
    return {
      bug: {
        create: ['createBug', 'reportBug', 'logIssue', 'fileTicket'],
        read: ['getBugs', 'listBugs', 'showBugs', 'viewBugs', 'findBugs', 'searchBugs'],
        update: ['updateBug', 'editBug', 'modifyBug', 'changeBug'],
        delete: ['deleteBug', 'removeBug', 'closeBug'],
        assign: ['assignBug', 'delegateBug', 'reassignBug'],
        analytics: ['bugStats', 'bugMetrics', 'bugAnalytics', 'bugInsights']
      },
      team: {
        create: ['createTeam', 'newTeam', 'makeTeam', 'buildTeam'],
        read: ['getTeams', 'listTeams', 'showTeams', 'viewTeams'],
        update: ['updateTeam', 'editTeam', 'modifyTeam'],
        delete: ['deleteTeam', 'removeTeam'],
        members: ['addMember', 'removeMember', 'listMembers', 'teamMembers'],
        analytics: ['teamStats', 'teamMetrics', 'teamAnalytics']
      },
      user: {
        read: ['getUsers', 'listUsers', 'showUsers', 'findUsers'],
        profile: ['getProfile', 'showProfile', 'myProfile'],
        friends: ['getFriends', 'addFriend', 'removeFriend'],
        analytics: ['userStats', 'userActivity']
      },
      comment: {
        create: ['addComment', 'postComment', 'writeComment'],
        read: ['getComments', 'listComments', 'showComments'],
        update: ['editComment', 'modifyComment'],
        delete: ['deleteComment', 'removeComment']
      },
      file: {
        upload: ['uploadFile', 'attachFile', 'addFile'],
        read: ['getFiles', 'listFiles', 'showFiles'],
        delete: ['deleteFile', 'removeFile'],
        download: ['downloadFile', 'getFile']
      },
      activity: {
        read: ['getActivity', 'showActivity', 'activityLog', 'history']
      },
      analytics: {
        overview: ['dashboard', 'overview', 'summary', 'insights'],
        reports: ['report', 'analysis', 'metrics', 'statistics'],
        trends: ['trends', 'patterns', 'timeline'],
        comparisons: ['compare', 'vs', 'versus', 'difference']
      }
    };
  }

  // Initialize intent patterns and responses
  initializeIntents() {
    return {
      greeting: {
        patterns: [
          'hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 
          'good evening', 'howdy', 'what\'s up', 'sup'
        ],
        responses: [
          'Hello! I\'m your BugSnap assistant. How can I help you today?',
          'Hi there! I\'m here to help you with your project management needs.',
          'Hey! I can help you manage bugs, teams, and collaborate better. What would you like to do?'
        ]
      },
      
      help: {
        patterns: [
          'help', 'what can you do', 'commands', 'features', 'assist', 'support',
          'how to use', 'guide', 'tutorial'
        ],
        responses: [
          `I can help you with:
          🐛 **Bug Management**: Create, view, update, and assign bugs
          👥 **Team Management**: Create teams, add members, manage roles
          👤 **People Management**: View team members, send invites
          📊 **Project Overview**: Get insights about your projects
          
          Just ask me naturally! For example:
          - "Create a new bug for login issue"
          - "Show me all high priority bugs"
          - "Add John to my team"
          - "Who are my team members?"`
        ]
      },

      bug_create: {
        patterns: [
          'create bug', 'new bug', 'add bug', 'report bug', 'bug report',
          'issue', 'problem', 'create issue', 'log bug', 'submit bug',
          'file bug', 'register bug', 'record bug', 'document bug',
          'report issue', 'submit issue', 'file issue', 'log issue',
          'create problem', 'report problem', 'document issue',
          'bug for', 'issue with', 'problem with', 'trouble with'
        ],
        responses: [
          'I\'ll help you create a new bug. What\'s the title and description of the issue?',
          'Let\'s create a bug report. Please provide the bug title and details.'
        ]
      },

      bug_list: {
        patterns: [
          'show bugs', 'list bugs', 'view bugs', 'all bugs', 'my bugs',
          'bug list', 'see bugs', 'display bugs'
        ],
        responses: [
          'Let me fetch your bugs for you.',
          'Here are your current bugs:'
        ]
      },

      team_create: {
        patterns: [
          'create team', 'new team', 'add team', 'make team', 'team create',
          'start team', 'build team'
        ],
        responses: [
          'I\'ll help you create a new team. What would you like to name your team?',
          'Let\'s create a team! Please provide a team name and description.'
        ]
      },

      team_list: {
        patterns: [
          'show teams', 'list teams', 'my teams', 'view teams', 'all teams',
          'team list', 'see teams'
        ],
        responses: [
          'Here are your teams:',
          'Let me show you your current teams:'
        ]
      },

      people_list: {
        patterns: [
          'show people', 'list people', 'team members', 'members', 'who',
          'people list', 'view members', 'see people'
        ],
        responses: [
          'Here are your team members:',
          'Let me show you the people in your teams:'
        ]
      },

      status_check: {
        patterns: [
          'status', 'how are things', 'overview', 'summary', 'dashboard',
          'what\'s happening', 'project status'
        ],
        responses: [
          'Let me give you a quick overview of your project:',
          'Here\'s your project summary:'
        ]
      },

      search: {
        patterns: [
          'search', 'find', 'look for', 'search for', 'locate', 'where is',
          'show me', 'display', 'get me'
        ],
        responses: [
          'I\'ll search through your project for you. What are you looking for?',
          'Let me find that for you in your bugs, teams, and people.'
        ]
      },

      assign_bug: {
        patterns: [
          'assign bug', 'assign to', 'give bug to', 'assign task', 'delegate',
          'assign issue', 'give task'
        ],
        responses: [
          'I\'ll help you assign a bug to someone. Which bug and who should I assign it to?',
          'Let me help you delegate that task. Please specify the bug and assignee.'
        ]
      },

      priority_bugs: {
        patterns: [
          'high priority', 'urgent bugs', 'critical bugs', 'important bugs',
          'priority bugs', 'urgent issues'
        ],
        responses: [
          'Here are your high priority and critical bugs:',
          'Let me show you the urgent bugs that need attention:'
        ]
      },

      goodbye: {
        patterns: [
          'bye', 'goodbye', 'see you', 'exit', 'quit', 'thanks', 'thank you',
          'that\'s all', 'done'
        ],
        responses: [
          'Goodbye! Feel free to ask me anything anytime.',
          'See you later! I\'m always here to help with your project management.',
          'Thanks for using BugSnap! Have a great day!'
        ]
      },

      general_query: {
        patterns: [
          'how', 'what', 'when', 'where', 'why', 'which', 'who', 'can you',
          'tell me', 'explain', 'describe', 'information about'
        ],
        responses: [
          'I understand you have a question. Let me try to help you with that.',
          'I\'ll do my best to answer your question about the project.',
          'Let me process your query and provide you with relevant information.'
        ]
      }
    };
  }

  // Analyze user input and determine intent
  analyzeIntent(message) {
    const tokens = tokenizer.tokenize(message.toLowerCase());
    const stemmedTokens = tokens.map(token => PorterStemmer.stem(token));
    
    let bestMatch = null;
    let highestScore = 0;

    // Check each intent
    for (const [intentName, intent] of Object.entries(this.intents)) {
      let score = 0;
      
      // Calculate similarity score
      for (const pattern of intent.patterns) {
        const patternTokens = tokenizer.tokenize(pattern.toLowerCase());
        const stemmedPatternTokens = patternTokens.map(token => PorterStemmer.stem(token));
        
        // Check for exact matches and partial matches
        const commonTokens = stemmedTokens.filter(token => 
          stemmedPatternTokens.includes(token)
        );
        
        if (commonTokens.length > 0) {
          const patternScore = commonTokens.length / Math.max(stemmedTokens.length, stemmedPatternTokens.length);
          score = Math.max(score, patternScore);
        }
      }
      
      if (score > highestScore) {
        highestScore = score;
        bestMatch = intentName;
      }
    }

    // If no good match found, classify as general query
    if (highestScore < 0.3) {
      bestMatch = 'general_query';
      highestScore = 0.5;
    }

    return {
      intent: bestMatch,
      confidence: highestScore,
      sentiment: this.analyzeSentiment(tokens)
    };
  }

  // Analyze sentiment of the message
  analyzeSentiment(tokens) {
    if (tokens.length === 0) return 'neutral';
    
    const stemmedTokens = tokens.map(token => PorterStemmer.stem(token));
    const score = analyzer.getSentiment(stemmedTokens);
    
    if (score > 0.1) return 'positive';
    if (score < -0.1) return 'negative';
    return 'neutral';
  }

  // Extract entities from the message (like bug title, team name, etc.)
  extractEntities(message, intent) {
    const entities = {};
    
    switch (intent) {
      case 'bug_create':
        // Try to extract bug title and description with improved patterns
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
            entities.title = match[1].trim();
            break;
          }
        }
        
        // If no quoted title found, try to extract from context
        if (!entities.title) {
          // Look for patterns like "create bug login not working"
          const contextPattern = /(?:create|add|new)\s+(?:bug|issue)\s+(.+?)(?:\.|$)/i;
          const contextMatch = message.match(contextPattern);
          if (contextMatch) {
            entities.title = contextMatch[1].trim();
          }
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
            entities.description = match[1].trim();
            break;
          }
        }
        
        // Extract priority if mentioned
        entities.priority = this.extractPriority(message.toLowerCase());
        
        // Extract status if mentioned  
        entities.status = this.extractStatus(message.toLowerCase());
        
        break;
        
      case 'team_create':
        // Extract team name with improved patterns
        const teamNamePatterns = [
          /(?:team|group)\s+(?:called|named)?\s*["']([^"']+)["']/i,
          /(?:create|add|new)\s+(?:team|group)\s+["']([^"']+)["']/i,
          /(?:team|group)\s+(?:for|about)?\s*(.+?)(?:\.|$)/i,
          /(?:create|add|new)\s+(?:team|group)\s+(?:for|about)?\s*(.+?)(?:\.|$)/i
        ];
        
        for (const pattern of teamNamePatterns) {
          const match = message.match(pattern);
          if (match) {
            entities.teamName = match[1].trim();
            break;
          }
        }
        
        // Extract description
        const teamDescPattern = /(?:description|desc):\s*(.+?)(?:\.|$)/i;
        const teamDescMatch = message.match(teamDescPattern);
        if (teamDescMatch) {
          entities.description = teamDescMatch[1].trim();
        }
        
        break;
        
      case 'bug_list':
        // Extract filters like priority, status, assignee
        entities.priority = this.extractPriority(message.toLowerCase());
        entities.status = this.extractStatus(message.toLowerCase());
        
        // Check for "my bugs" or "assigned to me"
        if (this.containsAny(message.toLowerCase(), ['my bugs', 'assigned to me', 'my assigned'])) {
          entities.assignedToMe = true;
        }
        
        // Check for "created by me"
        if (this.containsAny(message.toLowerCase(), ['created by me', 'i created', 'my reports'])) {
          entities.createdByMe = true;
        }
        
        break;
    }
    
    return entities;
  }

  // Enhanced query parsing for natural language database queries
  parseNaturalQuery(message) {
    const query = {
      entities: {},
      filters: {},
      action: 'search',
      limit: null,
      sortBy: null,
      timeRange: null,
      queryType: 'general'
    };

    const lowerMessage = message.toLowerCase();

    // Extract entity types with more flexibility
    if (this.containsAny(lowerMessage, ['bug', 'issue', 'problem', 'defect', 'error', 'ticket'])) {
      query.entityType = 'bug';
    } else if (this.containsAny(lowerMessage, ['user', 'member', 'people', 'person', 'developer', 'team member'])) {
      query.entityType = 'user';
    } else if (this.containsAny(lowerMessage, ['team', 'group', 'project', 'department'])) {
      query.entityType = 'team';
    } else if (this.containsAny(lowerMessage, ['comment', 'note', 'discussion', 'feedback'])) {
      query.entityType = 'comment';
    } else if (this.containsAny(lowerMessage, ['file', 'attachment', 'document', 'image', 'upload'])) {
      query.entityType = 'file';
    }

    // Extract action type with more variations
    if (this.containsAny(lowerMessage, ['create', 'add', 'new', 'make', 'build', 'generate'])) {
      query.action = 'create';
    } else if (this.containsAny(lowerMessage, ['update', 'edit', 'modify', 'change', 'alter'])) {
      query.action = 'update';
    } else if (this.containsAny(lowerMessage, ['delete', 'remove', 'cancel', 'eliminate'])) {
      query.action = 'delete';
    } else if (this.containsAny(lowerMessage, ['count', 'how many', 'number of', 'total', 'amount'])) {
      query.action = 'count';
      query.queryType = 'analytics';
    } else if (this.containsAny(lowerMessage, ['analytics', 'statistics', 'stats', 'metrics', 'analysis', 'insights', 'dashboard'])) {
      query.action = 'analytics';
      query.queryType = 'analytics';
    } else if (this.containsAny(lowerMessage, ['trend', 'over time', 'pattern', 'history', 'timeline', 'growth'])) {
      query.action = 'trends';
      query.queryType = 'analytics';
    } else if (this.containsAny(lowerMessage, ['compare', 'vs', 'versus', 'difference', 'between'])) {
      query.action = 'compare';
      query.queryType = 'analytics';
    }

    // Extract status filters
    if (this.containsAny(lowerMessage, ['open', 'active', 'new', 'pending'])) {
      query.filters.status = 'Open';
    } else if (this.containsAny(lowerMessage, ['closed', 'resolved', 'fixed', 'completed', 'done'])) {
      query.filters.status = 'Closed';
    } else if (this.containsAny(lowerMessage, ['in progress', 'working', 'development', 'progress'])) {
      query.filters.status = 'In Progress';
    } else if (this.containsAny(lowerMessage, ['testing', 'review', 'qa'])) {
      query.filters.status = 'Testing';
    }

    // Extract priority filters
    if (this.containsAny(lowerMessage, ['high priority', 'urgent', 'critical', 'important'])) {
      query.filters.priority = 'High';
    } else if (this.containsAny(lowerMessage, ['medium priority', 'normal', 'moderate'])) {
      query.filters.priority = 'Medium';
    } else if (this.containsAny(lowerMessage, ['low priority', 'minor', 'trivial'])) {
      query.filters.priority = 'Low';
    }

    // Extract assignment filters
    if (this.containsAny(lowerMessage, ['my bugs', 'assigned to me', 'my assigned', 'my issues'])) {
      query.filters.assignedToMe = true;
    } else if (this.containsAny(lowerMessage, ['created by me', 'my reports', 'i created', 'i reported'])) {
      query.filters.createdByMe = true;
    } else if (this.containsAny(lowerMessage, ['unassigned', 'no assignee', 'nobody assigned'])) {
      query.filters.unassigned = true;
    }

    // Extract time filters with more variations
    if (this.containsAny(lowerMessage, ['today', "today's", 'today only'])) {
      query.timeRange = 'today';
    } else if (this.containsAny(lowerMessage, ['yesterday', "yesterday's"])) {
      query.timeRange = 'yesterday';
    } else if (this.containsAny(lowerMessage, ['this week', 'weekly', 'past week', 'last 7 days'])) {
      query.timeRange = 'week';
    } else if (this.containsAny(lowerMessage, ['this month', 'monthly', 'past month', 'last 30 days'])) {
      query.timeRange = 'month';
    } else if (this.containsAny(lowerMessage, ['recent', 'lately', 'latest', 'new', 'newest'])) {
      query.timeRange = 'recent';
    }

    // Extract sorting preferences
    if (this.containsAny(lowerMessage, ['latest', 'newest', 'recent', 'by date'])) {
      query.sortBy = 'date_desc';
    } else if (this.containsAny(lowerMessage, ['oldest', 'earliest', 'first'])) {
      query.sortBy = 'date_asc';
    } else if (this.containsAny(lowerMessage, ['by priority', 'priority order', 'most important'])) {
      query.sortBy = 'priority';
    }

    // Extract limits
    const limitMatch = message.match(/(?:show|give|get|find)\s+(?:me\s+)?(?:only\s+)?(?:the\s+)?(?:first\s+)?(\d+)/i);
    if (limitMatch) {
      query.limit = parseInt(limitMatch[1]);
    } else if (this.containsAny(lowerMessage, ['top 10', 'first 10', 'ten'])) {
      query.limit = 10;
    } else if (this.containsAny(lowerMessage, ['top 5', 'first 5', 'five'])) {
      query.limit = 5;
    }

    // Extract search terms from quoted text
    const quotedMatch = message.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      query.searchTerm = quotedMatch[1];
    }

    // Extract component/technology filters
    if (this.containsAny(lowerMessage, ['frontend', 'ui', 'react', 'client'])) {
      query.filters.component = 'frontend';
    } else if (this.containsAny(lowerMessage, ['backend', 'api', 'server', 'database'])) {
      query.filters.component = 'backend';
    }

    return query;
  }

  // Helper method to check if message contains any of the given terms
  containsAny(message, terms) {
    return terms.some(term => message.includes(term));
  }

  // Enhanced entity extraction with better pattern matching
  extractEntities(message, intent) {
    const entities = {};
    const lowerMessage = message.toLowerCase();
    
    // Extract names from quoted text
    const quotedNames = message.match(/["']([^"']+)["']/g);
    if (quotedNames) {
      entities.names = quotedNames.map(name => name.replace(/["']/g, ''));
    }

    // Extract numbers and IDs
    const numbers = message.match(/\b\d+\b/g);
    if (numbers) {
      entities.numbers = numbers.map(num => parseInt(num));
    }

    // Extract email addresses
    const emails = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g);
    if (emails) {
      entities.emails = emails;
    }

    // Enhanced entity extraction based on intent
    switch (intent) {
      case 'bug_create':
      case 'bug_list':
      case 'bug_analytics':
        // Extract bug-specific entities
        entities.priority = this.extractPriority(lowerMessage);
        entities.status = this.extractStatus(lowerMessage);
        entities.component = this.extractComponent(lowerMessage);
        break;
        
      case 'team_create':
      case 'team_list':
        // Extract team-specific entities
        const teamNameMatch = message.match(/(?:team|group)\s+(?:called|named)?\s*["']?([^"'\n]+)["']?/i);
        if (teamNameMatch) {
          entities.teamName = teamNameMatch[1].trim();
        }
        break;
        
      case 'user_list':
      case 'people_list':
        // Extract user-specific entities
        const roleMatch = message.match(/\b(admin|developer|manager|tester|designer)s?\b/i);
        if (roleMatch) {
          entities.role = roleMatch[1].toLowerCase();
        }
        break;
    }
    
    return entities;
  }

  // Helper methods for entity extraction
  extractPriority(message) {
    if (this.containsAny(message, ['high', 'urgent', 'critical', 'important'])) return 'High';
    if (this.containsAny(message, ['medium', 'normal', 'moderate'])) return 'Medium';
    if (this.containsAny(message, ['low', 'minor', 'trivial'])) return 'Low';
    return null;
  }

  extractStatus(message) {
    if (this.containsAny(message, ['open', 'active', 'new'])) return 'Open';
    if (this.containsAny(message, ['closed', 'resolved', 'fixed'])) return 'Closed';
    if (this.containsAny(message, ['in progress', 'working', 'development'])) return 'In Progress';
    if (this.containsAny(message, ['testing', 'review'])) return 'Testing';
    return null;
  }

  extractComponent(message) {
    if (this.containsAny(message, ['frontend', 'ui', 'react'])) return 'frontend';
    if (this.containsAny(message, ['backend', 'api', 'server'])) return 'backend';
    if (this.containsAny(message, ['database', 'db', 'mongo'])) return 'database';
    return null;
  }

  // Convert natural language query to database query parameters
  buildQueryParameters(parsedQuery, userId) {
    const params = {
      userId: userId,
      filters: {},
      limit: parsedQuery.limit || 20,
      sort: {}
    };

    // Add filters based on parsed query
    if (parsedQuery.filters.priority) {
      params.filters.priority = parsedQuery.filters.priority;
    }

    if (parsedQuery.filters.status) {
      params.filters.status = parsedQuery.filters.status;
    }

    if (parsedQuery.filters.assignee) {
      params.filters.assignee = parsedQuery.filters.assignee;
    }

    // Add time range filters
    if (parsedQuery.timeRange) {
      const now = new Date();
      switch (parsedQuery.timeRange) {
        case 'today':
          params.filters.createdAt = {
            $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate())
          };
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          params.filters.createdAt = { $gte: weekAgo };
          break;
        case 'month':
          const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          params.filters.createdAt = { $gte: monthAgo };
          break;
        case 'recent':
          const recentAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
          params.filters.createdAt = { $gte: recentAgo };
          break;
      }
    }

    // Add sorting
    if (parsedQuery.sortBy) {
      params.sort[parsedQuery.sortBy] = parsedQuery.sortOrder === 'asc' ? 1 : -1;
    } else {
      params.sort.createdAt = -1; // Default to newest first
    }

    return params;
  }

  // Get response for an intent
  getResponse(intent) {
    if (!this.intents[intent]) {
      return "I'm not sure I understand. Could you please rephrase that? Type 'help' to see what I can do.";
    }
    
    const responses = this.intents[intent].responses;
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Update conversation context for a user
  updateContext(userId, key, value) {
    if (!this.context.has(userId)) {
      this.context.set(userId, {});
    }
    
    const userContext = this.context.get(userId);
    userContext[key] = value;
    this.context.set(userId, userContext);
  }

  // Get conversation context for a user
  getContext(userId) {
    return this.context.get(userId) || {};
  }

  // Clear context for a user
  clearContext(userId) {
    this.context.delete(userId);
  }

  // Process user message and generate response using new intent system
  // Enhanced main processing method with comprehensive query handling
  async processMessage(userId, message, userInfo = null, context = null) {
    console.log('🎯 Processing message:', { userId, message, hasUserInfo: !!userInfo, hasContext: !!context });
    try {
      // Get or initialize user context
      const userContext = this.getUserContext(userId);
      console.log('📋 User context:', userContext);
      
      // Merge provided context with existing user context
      const mergedContext = { ...userContext, ...context };
      console.log('🔀 Merged context:', mergedContext);
      
      // Update conversation history
      this.updateConversationHistory(userId, message);
      
      // Determine if this is a complex query that needs advanced processing
      const isComplexQuery = this.isComplexQuery(message);
      
      if (isComplexQuery) {
        // Use enhanced query processor for complex queries
        const result = await this.queryProcessor.processQuery(message, userId, { userInfo, ...mergedContext });
        
        // Update context with results for potential follow-up queries
        this.updateUserContext(userId, result);
        
        return {
          intent: 'complex_query',
          confidence: 0.9,
          message: result.message || result.response || "I've processed your request.",
          text: result.message || result.response || "I've processed your request.",
          actionResult: result,
          suggestions: this.generateAdvancedSuggestions(result),
          timestamp: new Date().toISOString()
        };
      }
      
      // Handle simple queries with existing intent system
      const analysis = this.analyzeIntent(message);
      const entities = this.extractEntities(message, analysis.intent);
      
      // Add comprehensive entity extraction
      const enhancedEntities = await this.enhanceEntityExtraction(message, entities, userId);
      
      // Update context
      this.updateContext(userId, 'lastIntent', analysis.intent);
      this.updateContext(userId, 'lastEntities', enhancedEntities);
      this.updateContext(userId, 'lastMessage', message);
      
      // Execute intent using appropriate handler
      let actionResult = null;
      let responseMessage = this.getResponse(analysis.intent);
      
      try {
        actionResult = await this.executeIntent(userId, analysis.intent, enhancedEntities, message);
        if (actionResult && actionResult.success) {
          responseMessage = actionResult.message || responseMessage;
        }
      } catch (error) {
    // console.error('Error executing intent:', error);
        actionResult = { success: false, error: error.message };
      }
      
      // Update context for follow-up queries
      this.updateUserContext(userId, actionResult);
      
      // Generate response
      const response = {
        intent: analysis.intent,
        confidence: analysis.confidence,
        sentiment: analysis.sentiment,
        entities: enhancedEntities,
        message: responseMessage,
        text: responseMessage, // Add text field for compatibility
        actionResult: actionResult,
        suggestions: this.generateSuggestions(analysis.intent, enhancedEntities),
        timestamp: new Date().toISOString()
      };
      
      return response;
    } catch (error) {
    // console.error('Error processing message:', error);
      return {
        intent: 'error',
        message: 'Sorry, I encountered an error processing your message. Please try again.',
        text: 'Sorry, I encountered an error processing your message. Please try again.',
        canRetry: true,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Determine if query requires complex processing
  isComplexQuery(message) {
    const complexIndicators = [
      // Composite queries
      'and also', 'plus', 'as well as', 'along with', 'including', 'together with',
      
      // Analytical queries
      'how many', 'count', 'total', 'sum', 'average', 'statistics', 'analytics',
      'metrics', 'insights', 'trends', 'patterns', 'over time', 'comparison',
      
      // Conditional queries
      'if', 'when', 'where', 'that have', 'which are', 'those that',
      
      // Multi-entity queries
      'bugs and teams', 'users and projects', 'files and comments',
      
      // Time-based queries
      'last week', 'this month', 'yesterday', 'before', 'after', 'between',
      
      // Aggregation queries
      'group by', 'sort by', 'order by', 'filter by', 'categorize',
      
      // Relationship queries
      'assigned to', 'created by', 'belongs to', 'part of', 'related to'
    ];
    
    const lowerMessage = message.toLowerCase();
    return complexIndicators.some(indicator => lowerMessage.includes(indicator)) ||
           this.hasMultipleActions(message) ||
           this.hasMultipleEntities(message);
  }

  // Check for multiple actions in query
  hasMultipleActions(message) {
    const actions = ['create', 'show', 'list', 'update', 'delete', 'add', 'remove', 'get', 'find', 'count'];
    const foundActions = actions.filter(action => message.toLowerCase().includes(action));
    return foundActions.length > 1;
  }

  // Check for multiple entities in query
  hasMultipleEntities(message) {
    const entities = ['bug', 'team', 'user', 'comment', 'file', 'issue', 'project', 'member'];
    const foundEntities = entities.filter(entity => message.toLowerCase().includes(entity));
    return foundEntities.length > 1;
  }

  // Get user context with defaults
  getUserContext(userId) {
    if (!this.context.has(userId)) {
      this.context.set(userId, {
        currentTeam: null,
        recentBugs: [],
        preferences: {},
        lastQuery: null,
        queryHistory: []
      });
    }
    return this.context.get(userId);
  }

  // Update user context with new information
  updateUserContext(userId, result) {
    const userContext = this.getUserContext(userId);
    
    if (result && result.data) {
      // Store relevant data for potential follow-up queries
      if (result.data.bugs) {
        userContext.recentBugs = result.data.bugs.slice(0, 10); // Keep last 10 bugs
      }
      if (result.data.team) {
        userContext.currentTeam = result.data.team;
      }
    }
    
    userContext.lastQuery = result;
    if (!userContext.queryHistory) {
      userContext.queryHistory = [];
    }
    userContext.queryHistory.push({
      timestamp: new Date(),
      result: result
    });
    
    // Keep only last 20 queries in history
    if (userContext.queryHistory.length > 20) {
      userContext.queryHistory = userContext.queryHistory.slice(-20);
    }
    
    this.context.set(userId, userContext);
  }

  // Update conversation history
  updateConversationHistory(userId, message) {
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, []);
    }
    
    const history = this.conversationHistory.get(userId);
    history.push({
      timestamp: new Date(),
      message: message,
      type: 'user'
    });
    
    // Keep only last 50 messages
    if (history.length > 50) {
      this.conversationHistory.set(userId, history.slice(-50));
    }
  }

  // Enhanced entity extraction with context awareness
  async enhanceEntityExtraction(message, basicEntities, userId) {
    const enhancedEntities = { ...basicEntities };
    const userContext = this.getUserContext(userId);
    
    // Auto-resolve team references if user has a current team
    if (!enhancedEntities.teamId && userContext.currentTeam) {
      const teamReferences = ['this team', 'my team', 'current team', 'our team'];
      if (teamReferences.some(ref => message.toLowerCase().includes(ref))) {
        enhancedEntities.teamId = userContext.currentTeam._id;
      }
    }
    
    // Resolve user references
    await this.resolveUserReferences(message, enhancedEntities, userId);
    
    // Resolve bug references
    await this.resolveBugReferences(message, enhancedEntities, userContext);
    
    // Extract temporal references
    this.extractTemporalReferences(message, enhancedEntities);
    
    // Extract comparative references
    this.extractComparativeReferences(message, enhancedEntities);
    
    return enhancedEntities;
  }

  // Resolve user references in the message
  async resolveUserReferences(message, entities, userId) {
    const userReferencePatterns = [
      /assign to ([a-zA-Z\s]+)/i,
      /assigned to ([a-zA-Z\s]+)/i,
      /user ([a-zA-Z\s]+)/i,
      /member ([a-zA-Z\s]+)/i,
      /for ([a-zA-Z\s]+)/i
    ];

    for (const pattern of userReferencePatterns) {
      const match = message.match(pattern);
      if (match) {
        const userName = match[1].trim();
        if (userName.toLowerCase() === 'me' || userName.toLowerCase() === 'myself') {
          entities.assignedUserId = userId;
        } else {
          // Look up user by name
          try {
            const user = await User.findOne({ 
              name: { $regex: new RegExp(userName, 'i') }
            }).lean();
            if (user) {
              entities.assignedUserId = user._id;
              entities.assignedUserName = user.name;
            }
          } catch (error) {
    // console.error('Error resolving user reference:', error);
          }
        }
        break;
      }
    }
  }

  // Resolve bug references from context
  async resolveBugReferences(message, entities, userContext) {
    const bugReferencePatterns = [
      /bug #(\d+)/i,
      /issue #(\d+)/i,
      /that bug/i,
      /this bug/i,
      /the bug/i,
      /previous bug/i,
      /last bug/i
    ];

    for (const pattern of bugReferencePatterns) {
      const match = message.match(pattern);
      if (match) {
        if (match[1]) {
          // Specific bug ID
          entities.bugId = match[1];
        } else if (userContext.recentBugs && userContext.recentBugs.length > 0) {
          // Reference to recent bug
          entities.bugId = userContext.recentBugs[0]._id;
        }
        break;
      }
    }
  }

  // Extract temporal references
  extractTemporalReferences(message, entities) {
    const timePatterns = [
      { pattern: /today/i, days: 0 },
      { pattern: /yesterday/i, days: 1 },
      { pattern: /this week/i, days: 7 },
      { pattern: /last week/i, days: 14 },
      { pattern: /this month/i, days: 30 },
      { pattern: /last month/i, days: 60 }
    ];

    for (const timePattern of timePatterns) {
      if (timePattern.pattern.test(message)) {
        const date = new Date();
        date.setDate(date.getDate() - timePattern.days);
        entities.timeFilter = {
          type: 'since',
          date: date
        };
        break;
      }
    }
  }

  // Extract comparative references
  extractComparativeReferences(message, entities) {
    if (message.toLowerCase().includes('more than') || message.toLowerCase().includes('greater than')) {
      entities.comparison = 'greater';
    } else if (message.toLowerCase().includes('less than') || message.toLowerCase().includes('fewer than')) {
      entities.comparison = 'less';
    } else if (message.toLowerCase().includes('equal to') || message.toLowerCase().includes('exactly')) {
      entities.comparison = 'equal';
    }
  }

  // Generate advanced suggestions for complex queries
  generateAdvancedSuggestions(result) {
    const suggestions = [];
    
    if (result.success) {
      suggestions.push('Would you like to see more details about any of these items?');
      suggestions.push('Do you want to filter these results further?');
      suggestions.push('Would you like to export this data?');
    } else {
      suggestions.push('Try simplifying your query');
      suggestions.push('Ask for help with specific commands');
      suggestions.push('Use more specific keywords');
    }
    
    return suggestions;
  }

  // Enhanced execute intent using comprehensive handlers
  async executeIntent(userId, intent, entities, originalMessage) {
    console.log('⚡ Executing intent:', { intent, userId, entities, originalMessage });
    try {
      switch (intent) {
        // Enhanced Bug-related intents
        case 'bug_list':
          console.log('📋 Executing bug_list intent');
          const filters = this.buildBugFilters(entities, originalMessage);
          const options = { includeAnalytics: this.shouldIncludeAnalytics(originalMessage) };
          console.log('🔧 Bug filters and options:', { filters, options });
          const bugListResult = await BugIntents.getAllBugs(userId, filters, options);
          console.log('✅ Bug list result:', { success: bugListResult.success, count: bugListResult.data?.count });
          return bugListResult;
          
        case 'bug_create':
          console.log('🐛 Executing bug_create intent');
          if (entities.title) {
            const bugData = {
              title: entities.title,
              description: entities.description || '',
              priority: entities.priority || 'medium',
              status: entities.status || 'open',
              teamId: entities.teamId,
              assignedTo: entities.assignedUserId ? [entities.assignedUserId] : [],
              tags: entities.tags || [],
              startDate: entities.startDate,
              dueDate: entities.dueDate
            };
            console.log('📝 Bug data:', bugData);
            const createResult = await BugIntents.createBug(bugData, userId);
            console.log('✅ Bug create result:', { success: createResult.success });
            return createResult;
          } else {
            return { 
              success: false, 
              message: 'Please provide a bug title to create a new bug.',
              text: 'Please provide a bug title to create a new bug.',
              suggestions: ['Try: "Create a bug for login issue"', 'Try: "Report a bug about navigation"']
            };
          }
          
        case 'bug_search':
        case 'search':
          return await BugIntents.searchBugs(userId, originalMessage);
          
        case 'bug_details':
          if (entities.bugId) {
            return await BugIntents.getBugDetails(userId, entities.bugId);
          } else {
            return { 
              success: false, 
              message: 'Please specify which bug you want details for.',
              text: 'Please specify which bug you want details for.',
              suggestions: ['Try: "Show bug #123"', 'Try: "Details for the login bug"']
            };
          }
          
        case 'bug_assign':
          if (entities.bugId && entities.assignedUserId) {
            return await BugIntents.assignBug(entities.bugId, [entities.assignedUserId], userId);
          } else {
            return { 
              success: false, 
              message: 'Please specify the bug and who to assign it to.',
              text: 'Please specify the bug and who to assign it to.',
              suggestions: ['Try: "Assign bug #123 to John"', 'Try: "Assign the login bug to me"']
            };
          }
          
        case 'bug_update':
          if (entities.bugId) {
            const newStatus = entities.status;
            if (newStatus) {
              return await BugIntents.updateBugStatus(entities.bugId, newStatus, userId);
            } else {
              return { 
                success: false, 
                message: 'Please specify what to update.',
                text: 'Please specify what to update.',
                suggestions: ['Try: "Update bug #123 status to closed"', 'Try: "Change status to resolved"']
              };
            }
          } else {
            return { 
              success: false, 
              message: 'Please specify which bug to update.',
              text: 'Please specify which bug to update.',
              suggestions: ['Try: "Update bug #123 status to closed"', 'Try: "Change priority of login bug to high"']
            };
          }
          
        case 'bug_delete':
          if (entities.bugId) {
            return await BugIntents.deleteBug(entities.bugId, userId);
          } else {
            return { 
              success: false, 
              message: 'Please specify which bug to delete.',
              text: 'Please specify which bug to delete.',
              suggestions: ['Try: "Delete bug #123"', 'Try: "Remove the login bug"']
            };
          }
          
        case 'bug_analytics':
        case 'bug_stats':
        case 'bug_metrics':
          return await BugIntents.getBugStats(userId);
          
        // Enhanced Team-related intents
        case 'team_list':
        case 'my_teams':
          return await TeamIntents.getAllTeams(userId);
          
        case 'team_create':
          if (entities.teamName) {
            const teamData = {
              name: entities.teamName,
              description: entities.description || ''
            };
            return await TeamIntents.createTeam(teamData, userId);
          } else {
            return { 
              success: false, 
              message: 'Please provide a team name to create a new team.',
              text: 'Please provide a team name to create a new team.',
              suggestions: ['Try: "Create team Development"', 'Try: "Make a new team called QA"']
            };
          }
          
        case 'team_members':
        case 'team_details':
          if (entities.teamId) {
            return await TeamIntents.getTeamDetails(userId, entities.teamId);
          } else {
            return { 
              success: false, 
              message: 'Please specify which team you want to see details for.',
              text: 'Please specify which team you want to see details for.',
              suggestions: ['Try: "Show my team details"', 'Try: "List Development team details"']
            };
          }
          
        case 'team_add_member':
          if (entities.teamId && entities.memberIdentifier) {
            const role = entities.role || 'member';
            return await TeamIntents.addMemberToTeam(entities.teamId, entities.memberIdentifier, role, userId);
          } else {
            return { 
              success: false, 
              message: 'Please specify the team and member to add.',
              text: 'Please specify the team and member to add.',
              suggestions: ['Try: "Add john@example.com to Development team"', 'Try: "Add John to my team as admin"']
            };
          }
          
        case 'team_search':
          return await TeamIntents.searchTeams(userId, originalMessage);
          
        case 'team_analytics':
        case 'team_stats':
          return await TeamIntents.getTeamStats(userId);
          
        // General queries that should provide detailed responses
        case 'general_query':
          console.log('❓ Executing general_query intent');
          const generalResult = await this.handleGeneralQuery(userId, originalMessage, entities);
          console.log('✅ General query result:', { success: generalResult.success });
          return generalResult;
          
        // Bug status queries
        case 'bug_status_open':
          return await BugIntents.getBugsByStatus(userId, 'open');
        case 'bug_status_closed':
          return await BugIntents.getBugsByStatus(userId, 'closed');
        case 'bug_status_progress':
          return await BugIntents.getBugsByStatus(userId, 'in progress');
        case 'bug_status_resolved':
          return await BugIntents.getBugsByStatus(userId, 'resolved');
          
        // Bug priority queries
        case 'bug_priority_high':
          return await BugIntents.getBugsByPriority(userId, 'high');
        case 'bug_priority_critical':
          return await BugIntents.getBugsByPriority(userId, 'critical');
        case 'bug_priority_medium':
          return await BugIntents.getBugsByPriority(userId, 'medium');
        case 'bug_priority_low':
          return await BugIntents.getBugsByPriority(userId, 'low');
          
        // User assignment queries
        case 'my_bugs':
          return await BugIntents.getMyAssignedBugs(userId);
          
        // User-related intents (using existing handlers)
        case 'people_list':
        case 'user_list':
          if (entities.teamId) {
            return await UserIntents.getTeamMembers(userId, entities.teamId);
          } else {
            return await UserIntents.searchUsers(userId, entities.search || '', {});
          }
          
        case 'user_profile':
        case 'my_profile':
          const targetUserId = entities.targetUserId || userId;
          return await UserIntents.getUserProfile(userId, targetUserId);
          
        case 'user_activity':
          const targetUser = entities.targetUserId || userId;
          return await UserIntents.getUserActivity(userId, targetUser, entities.timeRange);
          
        case 'user_workload':
          const workloadUser = entities.targetUserId || userId;
          return await UserIntents.getUserWorkload(userId, workloadUser);
          
        // Comment-related intents (using existing handlers)
        case 'comment_list':
        case 'show_comments':
          if (entities.bugId) {
            return await CommentIntents.getBugComments(userId, entities.bugId);
          } else {
            return { 
              success: false, 
              message: 'Please specify which bug to show comments for.',
              suggestions: ['Try: "Show comments for bug #123"', 'Try: "Get comments on login bug"']
            };
          }
          
        case 'comment_add':
        case 'add_comment':
          if (entities.bugId && entities.content) {
            return await CommentIntents.addComment(userId, entities.bugId, {
              content: entities.content
            });
          } else {
            return { 
              success: false, 
              message: 'Please specify the bug and comment content.',
              suggestions: ['Try: "Add comment to bug #123: This is fixed"', 'Try: "Comment on login bug: Still reproducing"']
            };
          }
          
        // File-related intents (using existing handlers)
        case 'file_list':
        case 'show_files':
          if (entities.bugId) {
            return await FileIntents.getBugFiles(userId, entities.bugId);
          } else {
            return await FileIntents.searchFiles(userId, entities.search || '', {});
          }
          
        // Complex queries
        case 'complex_query':
          return await this.queryProcessor.processQuery(originalMessage, userId, { entities });
          
        // Advanced search across all entities
        case 'global_search':
        case 'advanced_search':
          return await this.performAdvancedSearch(userId, originalMessage, entities);
          
        // Dashboard and overview
        case 'dashboard':
        case 'overview':
        case 'status_check':
          return await this.getDashboardOverview(userId);
          
        // Analytics and reporting
        case 'analytics':
        case 'metrics':
        case 'insights':
          return await this.getComprehensiveAnalytics(userId, entities);
          
        // Default responses for simple intents
        case 'greeting':
        case 'help':
        case 'goodbye':
          return {
            success: true,
            message: this.getResponse(intent),
            type: 'info',
            suggestions: this.generateContextualSuggestions(intent, userId)
          };

        // Handle general queries with intelligent search and processing
        case 'general_query':
          return await this.handleGeneralQuery(originalMessage, userId, entities);
          
        // Fallback for unhandled intents
        default:
          return await this.handleUnknownIntent(originalMessage, userId, entities);
      }
    } catch (error) {
    // console.error('Error executing intent:', error);
      return {
        success: false,
        message: 'I encountered an error processing your request. Please try rephrasing or contact support.',
        error: error.message,
        canRetry: true
      };
    }
  }

  // Handle general queries with intelligent processing
  async handleGeneralQuery(message, userId, entities) {
    try {
      // Try to understand what the user is asking about
      const messageWords = message.toLowerCase().split(' ');
      
      // Check if it's asking about bugs
      if (messageWords.some(word => ['bug', 'bugs', 'issue', 'issues', 'problem', 'problems'].includes(word))) {
        // Try to get bug-related information
        if (messageWords.some(word => ['count', 'how many', 'number'].includes(word))) {
          return await EnhancedBugIntents.getBugCounts(userId, 'status');
        } else if (messageWords.some(word => ['high', 'urgent', 'critical', 'priority'].includes(word))) {
          const filters = { priority: ['high', 'critical'] };
          return await EnhancedBugIntents.getAllBugs(userId, filters, {});
        } else {
          return await EnhancedBugIntents.getAllBugs(userId, {}, {});
        }
      }
      
      // Check if it's asking about teams
      if (messageWords.some(word => ['team', 'teams', 'group', 'groups'].includes(word))) {
        return await EnhancedTeamIntents.getAllTeams(userId);
      }
      
      // Check if it's asking about people
      if (messageWords.some(word => ['people', 'members', 'users', 'who', 'member'].includes(word))) {
        return await UserIntents.getAllUsers(userId, {});
      }
      
      // Check if it's asking about status/overview
      if (messageWords.some(word => ['status', 'overview', 'summary', 'dashboard'].includes(word))) {
        // Get comprehensive overview
        const bugStats = await EnhancedBugIntents.getBugCounts(userId, 'status');
        const teams = await EnhancedTeamIntents.getAllTeams(userId);
        
        return {
          success: true,
          message: 'Here\'s your project overview:',
          data: {
            bugStats: bugStats.data || {},
            teams: teams.data || [],
            overview: true
          },
          suggestions: [
            'Show me high priority bugs',
            'List all team members',
            'Create a new bug',
            'Show recent activity'
          ]
        };
      }
      
      // For any other general question, try to provide helpful information
      return {
        success: true,
        message: 'I understand you have a question. Here are some things I can help you with:',
        data: {
          capabilities: [
            '🐛 Bug Management - Create, view, update, and assign bugs',
            '👥 Team Management - Manage teams and members',
            '📊 Project Overview - Get insights and statistics',
            '🔍 Search & Filter - Find specific bugs or information'
          ]
        },
        suggestions: [
          'Show me all bugs',
          'List my teams',
          'Create a new bug',
          'Show project overview'
        ]
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'I had trouble understanding your question. Could you please be more specific?',
        suggestions: [
          'Try: "Show me all bugs"',
          'Try: "List my teams"',
          'Try: "What is my project status?"',
          'Type "help" to see what I can do'
        ]
      };
    }
  }

  // Helper method for global search across all entities
  async performGlobalSearch(userId, query, entities) {
    try {
      const results = {
        bugs: [],
        users: [],
        teams: [],
        comments: [],
        files: []
      };
      
      // Search bugs
      const bugResults = await BugIntents.searchBugs(userId, query);
      if (bugResults.success) {
        results.bugs = bugResults.data || [];
      }
      
      // Search users
      const userResults = await UserIntents.searchUsers(userId, query, {});
      if (userResults.success) {
        results.users = userResults.data || [];
      }
      
      // Search comments
      const commentResults = await CommentIntents.searchComments(userId, query);
      if (commentResults.success) {
        results.comments = commentResults.data || [];
      }
      
      // Search files
      const fileResults = await FileIntents.searchFiles(userId, query, {});
      if (fileResults.success) {
        results.files = fileResults.data || [];
      }
      
      const totalResults = results.bugs.length + results.users.length + 
                          results.teams.length + results.comments.length + results.files.length;
      
      return {
        success: true,
        message: `Found ${totalResults} results for "${query}"`,
        data: results,
        type: 'search_results'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error performing search',
        error: error.message
      };
    }
  }
  
  // Helper method for dashboard overview
  async getDashboardOverview(userId) {
    try {
      const overview = {
        bugs: {},
        user: {},
        teams: []
      };
      
      // Get bug analytics
      const bugAnalytics = await BugIntents.getBugAnalytics(userId, {});
      if (bugAnalytics.success) {
        overview.bugs = bugAnalytics.data || {};
      }
      
      // Get user profile and activity
      const userProfile = await UserIntents.getUserProfile(userId);
      if (userProfile.success) {
        overview.user = userProfile.data || {};
      }
      
      // Get user teams
      const userTeams = await TeamIntents.getUserTeams(userId);
      if (userTeams.success) {
        overview.teams = userTeams.data || [];
      }
      
      return {
        success: true,
        message: 'Here\'s your current dashboard overview',
        data: overview,
        type: 'dashboard_overview'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error getting dashboard overview',
        error: error.message
      };
    }
  }
  
  // Helper method for advanced search
  async performAdvancedSearch(userId, entities) {
    try {
      let results = {};
      
      // Use appropriate query system based on entities
      if (entities.bugFilters) {
        const bugResults = await BugQueries.advancedSearch(userId, entities.bugFilters);
        results.bugs = bugResults;
      }
      
      if (entities.userFilters) {
        const userResults = await UserQueries.getUserAnalytics(userId, entities.userFilters);
        results.users = userResults;
      }
      
      if (entities.teamFilters) {
        const teamResults = await TeamQueries.compareTeams(userId, entities.teamFilters);
        results.teams = teamResults;
      }
      
      return {
        success: true,
        message: 'Advanced search completed',
        data: results,
        type: 'advanced_search_results'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error performing advanced search',
        error: error.message
      };
    }
  }

  // Process natural language queries with enhanced understanding
  async processNaturalLanguageQuery(userId, message) {
    try {
      // Parse the natural language query
      const parsedQuery = this.parseNaturalQuery(message);
      
      // Build query parameters
      const queryParams = this.buildQueryParameters(parsedQuery, userId);
      
      let results = [];
      let resultType = 'general';
      
      // Execute query based on entity type
      switch (parsedQuery.entityType) {
        case 'bug':
          if (parsedQuery.action === 'search') {
            const bugResults = await BugIntents.searchBugs(userId, message);
            if (bugResults.success) {
              results = bugResults.data || [];
              resultType = 'bugs';
            }
          }
          break;
          
        case 'user':
          if (parsedQuery.action === 'search') {
            const userResults = await UserIntents.searchUsers(userId, message, queryParams.filters);
            if (userResults.success) {
              results = userResults.data || [];
              resultType = 'users';
            }
          }
          break;
          
        case 'team':
          if (parsedQuery.action === 'search') {
            const teamResults = await TeamIntents.getUserTeams(userId);
            if (teamResults.success) {
              results = teamResults.data || [];
              resultType = 'teams';
            }
          }
          break;
          
        case 'comment':
          if (parsedQuery.action === 'search') {
            const commentResults = await CommentIntents.searchComments(userId, message);
            if (commentResults.success) {
              results = commentResults.data || [];
              resultType = 'comments';
            }
          }
          break;
          
        case 'file':
          if (parsedQuery.action === 'search') {
            const fileResults = await FileIntents.searchFiles(userId, message, queryParams.filters);
            if (fileResults.success) {
              results = fileResults.data || [];
              resultType = 'files';
            }
          }
          break;
          
        default:
          // Perform global search if entity type is unclear
          const globalSearch = await this.performGlobalSearch(userId, message, {});
          if (globalSearch.success) {
            results = globalSearch.data;
            resultType = 'global';
          }
      }
      
      return {
        success: true,
        message: `Found ${Array.isArray(results) ? results.length : Object.keys(results).length} result(s) for "${message}"`,
        data: results,
        type: `natural_query_${resultType}`,
        queryAnalysis: {
          entityType: parsedQuery.entityType,
          action: parsedQuery.action,
          filters: parsedQuery.filters,
          parameters: queryParams
        },
        executionTime: Date.now()
      };
      
    } catch (error) {
    // console.error('Error processing natural language query:', error);
      return {
        success: false,
        message: 'Error processing your query. Please try rephrasing it.',
        error: error.message
      };
    }
  }

  // Determine what action should be taken based on intent
  getActionForIntent(intent, entities) {
    const actions = {
      bug_create: { type: 'form', form: 'bug_create', prefill: entities },
      bug_list: { type: 'api_call', endpoint: '/bug/all', params: entities },
      team_create: { type: 'form', form: 'team_create', prefill: entities },
      team_list: { type: 'api_call', endpoint: '/team/allTeam' },
      people_list: { type: 'api_call', endpoint: '/people/getAllPeople' },
      status_check: { type: 'dashboard', view: 'overview' },
      search: { type: 'search', query: 'general' },
      assign_bug: { type: 'form', form: 'bug_assign' },
      priority_bugs: { type: 'api_call', endpoint: '/bug/all', params: { priority: 'high,critical' } },
      help: { type: 'display', content: 'help_menu' },
      greeting: { type: 'display', content: 'welcome' },
      goodbye: { type: 'display', content: 'farewell' }
    };
    
    return actions[intent] || { type: 'display', content: 'default' };
  }

  // Generate suggestions based on intent and entities
  generateSuggestions(intent, entities) {
    const suggestions = [];
    
    switch (intent) {
      case 'greeting':
        suggestions.push(
          'Show me my bugs',
          'Create a new team',
          'List my team members',
          'Show project overview'
        );
        break;
        
      case 'bug_list':
        suggestions.push(
          'Create a new bug',
          'Show high priority bugs',
          'Show bugs assigned to me',
          'Show bug analytics'
        );
        break;
        
      case 'bug_details':
        suggestions.push(
          'Add a comment',
          'Update bug status',
          'Assign to team member',
          'Upload a file'
        );
        break;
        
      case 'team_list':
        suggestions.push(
          'Create a new team',
          'Add members to team',
          'Show team analytics',
          'Compare teams'
        );
        break;
        
      case 'people_list':
        suggestions.push(
          'Show user profile',
          'Check user workload',
          'View user activity',
          'Assign a bug'
        );
        break;
        
      case 'search':
        suggestions.push(
          'Search in bugs',
          'Search users',
          'Search comments',
          'Advanced search'
        );
        break;
        
      default:
        suggestions.push(
          'Show me my bugs',
          'List my teams',
          'Create something new',
          'What can you help me with?'
        );
    }
    
    return suggestions;
  }

  // Get contextual suggestions based on current state
  getSuggestions(userId, userInfo = null) {
    const context = this.getContext(userId);
    const suggestions = [];
    
    // Base suggestions
    const baseSuggestions = [
      'Show me my bugs',
      'Create a new team',
      'List my team members',
      'What can you help me with?'
    ];
    
    // Context-aware suggestions
    if (context.lastIntent === 'greeting') {
      suggestions.push(
        'Show me project overview',
        'Create a new bug',
        'List my teams'
      );
    } else if (context.lastIntent === 'bug_list') {
      suggestions.push(
        'Create a new bug',
        'Show high priority bugs',
        'Show bugs assigned to me'
      );
    } else if (context.lastIntent === 'team_list') {
      suggestions.push(
        'Create a new team',
        'Add members to team',
        'Show team members'
      );
    }
    
    return suggestions.length > 0 ? suggestions : baseSuggestions;
  }

  // Main method to process user messages
  async processMessage(userId, message, userInfo = null) {
    try {
      // Store user context
      this.updateContext(userId, { lastMessage: message });
      
      // Analyze the message to determine intent
      const analysis = this.analyzeIntent(message);
      const entities = this.extractEntities(message, analysis.intent);
      
      // Execute the appropriate action based on intent
      const actionResult = await this.executeAction(analysis.intent, entities, userId, message);
      
      // Generate contextual suggestions
      const suggestions = this.generateSuggestions(analysis.intent, entities);
      
      // Update context with the result
      this.updateContext(userId, { 
        lastIntent: analysis.intent,
        lastEntities: entities
      });
      
      return {
        intent: analysis.intent,
        confidence: analysis.confidence,
        sentiment: analysis.sentiment,
        entities: entities,
        message: actionResult.message || this.getResponse(analysis.intent),
        actionResult: actionResult,
        suggestions: suggestions,
        timestamp: new Date().toISOString(),
        user: {
          id: userId,
          name: userInfo?.name || 'User'
        }
      };
      
    } catch (error) {
    // console.error('Error processing message:', error);
      return {
        intent: 'error',
        confidence: 1.0,
        sentiment: 'neutral',
        entities: {},
        message: 'Sorry, I encountered an error processing your request.',
        actionResult: { success: false, error: error.message },
        suggestions: ['Try again', 'Show me my bugs', 'What can you help me with?'],
        timestamp: new Date().toISOString(),
        user: {
          id: userId,
          name: 'User'
        }
      };
    }
  }

  // Execute actions based on determined intent
  async executeAction(intent, entities, userId, originalMessage) {
    try {
      switch (intent) {
        case 'bug_create':
          return await this.handleBugCreation(userId, entities, originalMessage);
          
        case 'bug_list':
          return await BugIntents.getAllBugs(userId, {
            priority: entities.priority,
            status: entities.status,
            assignee: entities.assignedToMe ? userId : entities.assignee
          });
          
        case 'bug_details':
          if (entities.bugId) {
            return await BugIntents.getBugDetails(userId, entities.bugId);
          } else {
            return { success: false, message: 'Please specify which bug you want details for.' };
          }
          
        case 'team_create':
          return await this.handleTeamCreation(userId, entities, originalMessage);
          
        case 'team_list':
          return await TeamIntents.getUserTeams(userId);
          
        case 'people_list':
          return await UserIntents.getAllUsers(userId, {});
          
        case 'search':
          return await this.performGlobalSearch(userId, originalMessage, entities);
          
        case 'status_check':
          return await this.getDashboardOverview(userId);
          
        case 'greeting':
          return {
            success: true,
            message: 'Hello! I\'m your BugSnap assistant. How can I help you today?',
            type: 'greeting'
          };
          
        case 'help':
          return {
            success: true,
            message: `I can help you with:
🐛 **Bug Management**: Create, view, update, and assign bugs
👥 **Team Management**: Create teams, add members, manage roles  
👤 **People Management**: View team members, send invites
📊 **Project Overview**: Get insights about your projects

Just ask me naturally! For example:
- "Create a new bug for login issue"
- "Show me all high priority bugs"
- "List my team members"`,
            type: 'help'
          };
          
        default:
          return {
            success: true,
            message: 'I understand you want to ' + intent.replace('_', ' ') + '. Can you provide more details?',
            type: 'clarification'
          };
      }
    } catch (error) {
    // console.error('Error executing action:', error);
      return {
        success: false,
        message: 'Sorry, I encountered an error while processing your request.',
        error: error.message
      };
    }
  }

  // Handle bug creation with improved entity extraction
  async handleBugCreation(userId, entities, originalMessage) {
    try {
      // Extract title from the message if not already extracted
      let title = entities.title;
      if (!title) {
        // Try different patterns to extract title
        const patterns = [
          /(?:create|new|add).*?bug.*?["']([^"']+)["']/i,
          /(?:create|new|add).*?bug.*?(?:called|named|titled)\s+(.+?)(?:\.|$)/i,
          /(?:bug|issue|problem).*?["']([^"']+)["']/i,
          /(?:bug|issue|problem)\s+(?:for|about|with)\s+(.+?)(?:\.|$)/i
        ];
        
        for (const pattern of patterns) {
          const match = originalMessage.match(pattern);
          if (match) {
            title = match[1].trim();
            break;
          }
        }
      }
      
      if (!title) {
        return {
          success: false,
          message: 'Please provide a bug title to create a new bug.'
        };
      }
      
      // Find user's first team for now (in a real app, you might ask which team)
      const teams = await Team.find({
        'members.user': userId
      });
      
      if (teams.length === 0) {
        return {
          success: false,
          message: 'You need to be a member of a team to create bugs. Please join a team first.'
        };
      }
      
      // Use the first team available
      const teamId = teams[0]._id;
      
      // Extract description from the message
      let description = '';
      const descPatterns = [
        /(?:description|desc|details?):\s*(.+?)(?:\.|$)/i,
        /(?:about|regarding|concerning)\s+(.+?)(?:\.|$)/i
      ];
      
      for (const pattern of descPatterns) {
        const match = originalMessage.match(pattern);
        if (match) {
          description = match[1].trim();
          break;
        }
      }
      
      // Create the bug using the Bug model directly
      const Bug = require('../../model/bug');
      
      const bugData = {
        title: title,
        description: description || `Bug created via AI Assistant: ${title}`,
        teamId: teamId,
        createdBy: userId,
        priority: entities.priority || 'medium',
        status: entities.status || 'open',
        tags: [],
        assignedTo: entities.assignee ? [entities.assignee] : []
      };
      
      const newBug = new Bug(bugData);
      await newBug.save();
      
      // Populate the created bug for response
      await newBug.populate([
        { path: 'createdBy', select: 'name email' },
        { path: 'teamId', select: 'name' },
        { path: 'assignedTo', select: 'name email' }
      ]);
      
      return {
        success: true,
        bug: newBug,
        message: `Bug "${title}" created successfully in team ${teams[0].name}!`
      };
      
    } catch (error) {
    // console.error('Error creating bug:', error);
      return {
        success: false,
        message: 'Failed to create bug. Please try again.',
        error: error.message
      };
    }
  }

  // Handle team creation
  async handleTeamCreation(userId, entities, originalMessage) {
    try {
      let teamName = entities.teamName;
      
      if (!teamName) {
        // Try to extract team name from message
        const patterns = [
          /(?:create|new|add).*?team.*?["']([^"']+)["']/i,
          /(?:create|new|add).*?team.*?(?:called|named)\s+(.+?)(?:\.|$)/i,
          /team.*?["']([^"']+)["']/i
        ];
        
        for (const pattern of patterns) {
          const match = originalMessage.match(pattern);
          if (match) {
            teamName = match[1].trim();
            break;
          }
        }
      }
      
      if (!teamName) {
        return {
          success: false,
          message: 'Please provide a team name to create a new team.'
        };
      }
      
      const Team = require('../../model/team');
      
      // Create the team
      const teamData = {
        name: teamName,
        description: entities.description || `Team created via AI Assistant`,
        createdBy: userId,
        members: [{
          user: userId,
          role: 'admin'
        }]
      };
      
      const newTeam = new Team(teamData);
      await newTeam.save();
      
      return {
        success: true,
        team: newTeam,
        message: `Team "${teamName}" created successfully! You are now the admin.`
      };
      
    } catch (error) {
    // console.error('Error creating team:', error);
      return {
        success: false,
        message: 'Failed to create team. Please try again.',
        error: error.message
      };
    }
  }

  // Get dashboard overview
  async getDashboardOverview(userId) {
    try {
      // Get user's teams
      const teams = await Team.find({
        'members.user': userId
      });
      
      if (teams.length === 0) {
        return {
          success: true,
          message: 'Welcome! You\'re not part of any teams yet. Would you like to create one?',
          overview: {
            teams: 0,
            totalBugs: 0,
            myBugs: 0
          }
        };
      }
      
      const teamIds = teams.map(t => t._id);
      const Bug = require('../../model/bug');
      
      // Get bug statistics
      const [totalBugs, myAssignedBugs, myCreatedBugs] = await Promise.all([
        Bug.countDocuments({ teamId: { $in: teamIds }, deleted: false }),
        Bug.countDocuments({ teamId: { $in: teamIds }, assignedTo: userId, deleted: false }),
        Bug.countDocuments({ teamId: { $in: teamIds }, createdBy: userId, deleted: false })
      ]);
      
      return {
        success: true,
        message: `You're a member of ${teams.length} team(s) with ${totalBugs} total bugs.`,
        overview: {
          teams: teams.length,
          totalBugs: totalBugs,
          myAssignedBugs: myAssignedBugs,
          myCreatedBugs: myCreatedBugs,
          teamNames: teams.map(t => t.name)
        }
      };
      
    } catch (error) {
    // console.error('Error getting dashboard overview:', error);
      return {
        success: false,
        message: 'Failed to get overview. Please try again.',
        error: error.message
      };
    }
  }

  // Build comprehensive bug filters from entities and message
  buildBugFilters(entities, message) {
    const filters = {};
    
    // Status filters
    if (entities.status) filters.status = entities.status;
    
    // Priority filters  
    if (entities.priority) filters.priority = entities.priority;
    
    // Assignment filters
    if (entities.assignedToMe || message.toLowerCase().includes('my bugs') || message.toLowerCase().includes('assigned to me')) {
      filters.assignedToMe = true;
    }
    
    if (entities.createdByMe || message.toLowerCase().includes('created by me') || message.toLowerCase().includes('i created')) {
      filters.createdByMe = true;
    }
    
    // Team filters
    if (entities.teamId) filters.teamId = entities.teamId;
    
    // Search terms
    if (entities.search) filters.search = entities.search;
    
    // Time filters
    if (entities.timeFilter) {
      if (entities.timeFilter.type === 'since') {
        filters.startDate = entities.timeFilter.date;
      }
    }
    
    // Tag filters
    if (entities.tags) filters.tags = entities.tags;
    
    return filters;
  }

  // Determine if analytics should be included
  shouldIncludeAnalytics(message) {
    const analyticsKeywords = [
      'analytics', 'statistics', 'stats', 'metrics', 'insights', 
      'overview', 'summary', 'dashboard', 'performance', 'trends'
    ];
    return analyticsKeywords.some(keyword => message.toLowerCase().includes(keyword));
  }

  // Perform advanced search across multiple entities
  async performAdvancedSearchAcrossEntities(userId, query, entities) {
    try {
      const results = {
        bugs: [],
        teams: [],
        users: [],
        totalResults: 0
      };
      
      // Search bugs with enhanced filters
      const bugResults = await EnhancedBugIntents.searchBugs(userId, query);
      if (bugResults.success && bugResults.data) {
        results.bugs = bugResults.data;
        results.totalResults += bugResults.data.length;
      }
      
      // Search teams
      const teamResults = await EnhancedTeamIntents.searchTeams(userId, { name: query });
      if (teamResults.success && teamResults.data) {
        results.teams = teamResults.data;
        results.totalResults += teamResults.data.length;
      }
      
      // Search users if available
      try {
        const userResults = await UserIntents.searchUsers(userId, query, {});
        if (userResults.success && userResults.data) {
          results.users = userResults.data;
          results.totalResults += userResults.data.length;
        }
      } catch (error) {
    // console.log('User search not available:', error.message);
      }
      
      return {
        success: true,
        message: `Found ${results.totalResults} result${results.totalResults === 1 ? '' : 's'} for "${query}"`,
        data: results,
        query
      };
      
    } catch (error) {
    // console.error('Error in advanced search:', error);
      return {
        success: false,
        message: 'Error performing search. Please try again.',
        error: error.message
      };
    }
  }

  // Get comprehensive analytics
  async getComprehensiveAnalytics(userId, entities) {
    try {
      const analytics = {};
      
      // Get bug analytics
      const timeframe = entities.timeframe || 'month';
      const bugAnalytics = await EnhancedBugIntents.getBugStatistics(userId, timeframe);
      if (bugAnalytics.success) {
        analytics.bugs = bugAnalytics.data;
      }
      
      // Get team analytics for each team
      const teamsResult = await EnhancedTeamIntents.getUserTeams(userId, false);
      if (teamsResult.success && teamsResult.data) {
        analytics.teams = await Promise.all(
          teamsResult.data.map(async (team) => {
            const teamMetrics = await EnhancedTeamIntents.getTeamPerformanceMetrics(team._id, timeframe);
            return {
              team: team,
              metrics: teamMetrics.success ? teamMetrics.data : null
            };
          })
        );
      }
      
      return {
        success: true,
        message: `Analytics overview for the last ${timeframe}:`,
        data: analytics,
        timeframe,
        type: 'analytics'
      };
      
    } catch (error) {
    // console.error('Error getting comprehensive analytics:', error);
      return {
        success: false,
        message: 'Error retrieving analytics.',
        error: error.message
      };
    }
  }

  // Generate contextual suggestions
  generateContextualSuggestions(intent, userId) {
    const suggestions = [];
    
    switch (intent) {
      case 'greeting':
        suggestions.push(
          'Show my bugs',
          'Create a new bug',
          'Show my teams',
          'Get dashboard overview'
        );
        break;
      case 'help':
        suggestions.push(
          'Show all commands',
          'How to create a bug',
          'How to manage teams',
          'Show analytics'
        );
        break;
      default:
        suggestions.push(
          'Show my recent bugs',
          'Get team overview',
          'Show dashboard'
        );
    }
    
    return suggestions;
  }

  // Handle unknown intents with smart suggestions
  async handleUnknownIntent(message, userId, entities) {
    // Try to extract actionable information from the message
    const lowerMessage = message.toLowerCase();
    
    let suggestions = [];
    let suggestedAction = null;
    
    // Smart suggestions based on keywords
    if (lowerMessage.includes('bug') || lowerMessage.includes('issue')) {
      suggestions = [
        'Show my bugs',
        'Create a new bug',
        'Search bugs',
        'Show high priority bugs'
      ];
      suggestedAction = 'bug_related';
    } else if (lowerMessage.includes('team') || lowerMessage.includes('member')) {
      suggestions = [
        'Show my teams',
        'Create a new team',
        'Show team members',
        'Get team analytics'
      ];
      suggestedAction = 'team_related';
    } else if (lowerMessage.includes('stat') || lowerMessage.includes('analytic') || lowerMessage.includes('report')) {
      suggestions = [
        'Get dashboard overview',
        'Show bug statistics',
        'Get team analytics',
        'Show my activity'
      ];
      suggestedAction = 'analytics_related';
    } else {
      suggestions = [
        'Show my bugs',
        'Show my teams', 
        'Get dashboard overview',
        'Help - see all commands'
      ];
    }
    
    return {
      success: false,
      message: 'I\'m not sure what you\'re asking for. Here are some things I can help you with:',
      suggestions,
      suggestedAction,
      originalMessage: message,
      type: 'clarification'
    };
  }

  // Context management
  updateContext(userId, context) {
    if (!this.context.has(userId)) {
      this.context.set(userId, {});
    }
    Object.assign(this.context.get(userId), context);
  }

  getContext(userId) {
    return this.context.get(userId) || {};
  }

  // Handle general queries with intelligent routing
  async handleGeneralQuery(userId, originalMessage, entities) {
    const message = originalMessage.toLowerCase();
    
    // Check for bug-related queries
    if (message.includes('bug') || message.includes('issue') || message.includes('problem')) {
      if (message.includes('all') || message.includes('show') || message.includes('list')) {
        return await BugIntents.getAllBugs(userId);
      } else if (message.includes('create') || message.includes('report') || message.includes('new')) {
        return {
          success: false,
          message: '🐛 I can help you create a bug! Please provide the title for the new bug.',
          text: '🐛 I can help you create a bug! Please provide the title for the new bug.',
          suggestions: [
            'Try: "Create bug: Login page not working"',
            'Try: "Report bug: Dashboard crashes"',
            'Give me the bug title and I\'ll guide you through the rest'
          ]
        };
      } else if (message.includes('stats') || message.includes('count') || message.includes('how many')) {
        return await BugIntents.getBugStats(userId);
      } else if (message.includes('high priority') || message.includes('urgent')) {
        return await BugIntents.getBugsByPriority(userId, 'high');
      } else if (message.includes('open')) {
        return await BugIntents.getBugsByStatus(userId, 'open');
      }
    }
    
    // Check for team-related queries
    if (message.includes('team') || message.includes('group') || message.includes('member')) {
      if (message.includes('all') || message.includes('show') || message.includes('list') || message.includes('my teams')) {
        return await TeamIntents.getAllTeams(userId);
      } else if (message.includes('create') || message.includes('new') || message.includes('make')) {
        return {
          success: false,
          message: '🏢 I can help you create a team! Please provide the team name.',
          text: '🏢 I can help you create a team! Please provide the team name.',
          suggestions: [
            'Try: "Create team: Development Team"',
            'Try: "New team called QA Squad"',
            'Give me the team name and I\'ll set it up'
          ]
        };
      } else if (message.includes('stats') || message.includes('count')) {
        return await TeamIntents.getTeamStats(userId);
      }
    }
    
    // Default response for unclear queries
    return {
      success: true,
      message: `🤔 I'm not sure exactly what you're looking for. Here are some things I can help you with:

🐛 **Bug Management:**
• Show all bugs
• Create a new bug
• Show bug statistics
• Filter bugs by status or priority

🏢 **Team Management:**
• Show my teams
• Create a new team
• Show team details
• Add members to teams

📊 **Analytics:**
• Bug statistics and counts
• Team performance metrics
• Project overviews

Ask me something like "show all bugs" or "create a team" and I'll help you out!`,
      text: `🤔 I'm not sure exactly what you're looking for. Here are some things I can help you with:

🐛 **Bug Management:**
• Show all bugs
• Create a new bug
• Show bug statistics
• Filter bugs by status or priority

🏢 **Team Management:**
• Show my teams
• Create a new team
• Show team details
• Add members to teams

📊 **Analytics:**
• Bug statistics and counts
• Team performance metrics
• Project overviews

Ask me something like "show all bugs" or "create a team" and I'll help you out!`,
      suggestions: [
        'Show all bugs',
        'Show my teams',
        'Create a new bug',
        'Bug statistics',
        'Create a team'
      ]
    };
  }

  // Get response for intent
  getResponse(intent) {
    const intentConfig = this.intents[intent];
    if (intentConfig && intentConfig.responses) {
      const responses = intentConfig.responses;
      return responses[Math.floor(Math.random() * responses.length)];
    }
    return 'I understand what you\'re looking for. Let me help you with that.';
  }
}

module.exports = new AIAgentService();
