// Bot utility functions for enhanced integration
const axios = require('axios');

class BotIntegrationService {
  constructor() {
    this.baseURL = process.env.BACKEND_URL_MAIN || 'http://localhost:8019';
  }

  // Enhanced bug creation with AI assistance
  async createBugWithAI(req, bugData) {
    try {
      const { title, description, priority = 'Medium', assignee = null } = bugData;
      
      // Get active team
      const teamId = await this.getActiveTeamId(req);
      if (!teamId) {
        throw new Error('User must be part of a team to create bugs');
      }

      // Analyze description for potential categorization
      const analysis = this.analyzeBugDescription(description);
      
      const bugPayload = {
        title,
        description,
        priority,
        assignee,
        teamId,
        tags: analysis.suggestedTags,
        category: analysis.category,
        estimatedComplexity: analysis.complexity
      };

      const response = await axios.post(`${this.baseURL}/bug/create`, bugPayload, {
        headers: {
          'Cookie': req.headers.cookie || '',
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        bug: response.data,
        analysis: analysis
      };

    } catch (error) {
      console.error('Bug creation error:', error);
      throw error;
    }
  }

  // Analyze bug description for insights
  analyzeBugDescription(description) {
    const analysis = {
      suggestedTags: [],
      category: 'General',
      complexity: 'Medium'
    };

    const lowerDesc = description.toLowerCase();

    // Detect bug categories
    const categories = {
      'UI/UX': ['ui', 'ux', 'interface', 'design', 'layout', 'css', 'styling'],
      'Backend': ['api', 'server', 'database', 'endpoint', 'response', 'backend'],
      'Authentication': ['login', 'auth', 'password', 'token', 'session', 'permission'],
      'Performance': ['slow', 'performance', 'speed', 'loading', 'timeout', 'lag'],
      'Security': ['security', 'vulnerability', 'xss', 'sql injection', 'csrf'],
      'Integration': ['integration', 'third party', 'api', 'webhook', 'external']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerDesc.includes(keyword))) {
        analysis.category = category;
        break;
      }
    }

    // Detect complexity indicators
    const complexityIndicators = {
      'High': ['complex', 'multiple', 'integration', 'architecture', 'refactor', 'major'],
      'Low': ['simple', 'minor', 'typo', 'text', 'color', 'small']
    };

    for (const [complexity, keywords] of Object.entries(complexityIndicators)) {
      if (keywords.some(keyword => lowerDesc.includes(keyword))) {
        analysis.complexity = complexity;
        break;
      }
    }

    // Suggest tags based on content
    const tagKeywords = {
      'urgent': ['urgent', 'critical', 'asap', 'immediately'],
      'frontend': ['frontend', 'ui', 'ux', 'css', 'html', 'javascript'],
      'backend': ['backend', 'api', 'server', 'database'],
      'mobile': ['mobile', 'responsive', 'phone', 'tablet'],
      'browser': ['chrome', 'firefox', 'safari', 'edge', 'browser']
    };

    for (const [tag, keywords] of Object.entries(tagKeywords)) {
      if (keywords.some(keyword => lowerDesc.includes(keyword))) {
        analysis.suggestedTags.push(tag);
      }
    }

    return analysis;
  }

  // Get enhanced project statistics
  async getProjectStats(req) {
    try {
      const promises = [
        this.makeInternalAPICall(req, '/team/allTeam'),
        this.makeInternalAPICall(req, '/people/getAllPeople')
      ];

      // Try to get bugs if user has a team
      const teamId = await this.getActiveTeamId(req);
      if (teamId) {
        promises.push(this.makeInternalAPICall(req, `/bug/all?teamId=${teamId}`));
      }

      const results = await Promise.allSettled(promises);
      
      const teamsResult = results[0].status === 'fulfilled' ? results[0].value : null;
      const peopleResult = results[1].status === 'fulfilled' ? results[1].value : null;
      const bugsResult = results[2]?.status === 'fulfilled' ? results[2].value : null;

      const stats = {
        teams: {
          total: teamsResult?.data?.teams?.length || 0,
          active: teamsResult?.data?.teams?.filter(t => t.members?.length > 1).length || 0
        },
        people: {
          total: peopleResult?.data?.people?.length || 0
        },
        bugs: {
          total: bugsResult?.data?.length || 0,
          byPriority: this.groupBugsByPriority(bugsResult?.data || []),
          byStatus: this.groupBugsByStatus(bugsResult?.data || [])
        }
      };

      return stats;

    } catch (error) {
      console.error('Project stats error:', error);
      throw error;
    }
  }

  // Group bugs by priority for statistics
  groupBugsByPriority(bugs) {
    return bugs.reduce((acc, bug) => {
      const priority = bug.priority || 'Medium';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {});
  }

  // Group bugs by status for statistics
  groupBugsByStatus(bugs) {
    return bugs.reduce((acc, bug) => {
      const status = bug.status || 'Open';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
  }

  // Make internal API calls
  async makeInternalAPICall(req, endpoint) {
    try {
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        headers: {
          'Cookie': req.headers.cookie || '',
          'Content-Type': 'application/json'
        }
      });
      return response;
    } catch (error) {
      console.error(`Internal API call error for ${endpoint}:`, error.message);
      throw error;
    }
  }

  // Get active team ID helper
  async getActiveTeamId(req) {
    try {
      const teamsResponse = await this.makeInternalAPICall(req, '/team/allTeam');
      const teams = teamsResponse.data.teams || [];
      return teams.length > 0 ? teams[0]._id : null;
    } catch (error) {
      console.error('Error getting active team:', error);
      return null;
    }
  }

  // Smart search across project entities
  async smartSearch(req, query) {
    try {
      const searchResults = {
        bugs: [],
        teams: [],
        people: []
      };

      // Search in bugs
      const teamId = await this.getActiveTeamId(req);
      if (teamId) {
        const bugsResponse = await this.makeInternalAPICall(req, `/bug/all?teamId=${teamId}`);
        const bugs = bugsResponse.data || [];
        
        searchResults.bugs = bugs.filter(bug => 
          bug.title?.toLowerCase().includes(query.toLowerCase()) ||
          bug.description?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
      }

      // Search in teams
      const teamsResponse = await this.makeInternalAPICall(req, '/team/allTeam');
      const teams = teamsResponse.data.teams || [];
      
      searchResults.teams = teams.filter(team =>
        team.name?.toLowerCase().includes(query.toLowerCase()) ||
        team.description?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 3);

      // Search in people
      const peopleResponse = await this.makeInternalAPICall(req, '/people/getAllPeople');
      const people = peopleResponse.data.people || [];
      
      searchResults.people = people.filter(person =>
        person.name?.toLowerCase().includes(query.toLowerCase()) ||
        person.email?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5);

      return searchResults;

    } catch (error) {
      console.error('Smart search error:', error);
      throw error;
    }
  }
}

module.exports = new BotIntegrationService();