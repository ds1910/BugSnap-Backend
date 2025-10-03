// Simple test script for bot functionality
const axios = require('axios');

const backendUrl = 'http://localhost:8019';

// Test messages
const testMessages = [
  'Hello',
  'What can you do?',
  'Show me all bugs',
  'How many bugs do I have?',
  'What is the status of my project?',
  'Create a new bug for login issue',
  'Help me'
];

async function testBotChat() {
  console.log('🤖 Testing Bot Chat Functionality...\n');
  
  for (const message of testMessages) {
    try {
      console.log(`👤 User: ${message}`);
      
      const response = await axios.post(`${backendUrl}/bot/chat`, {
        message: message,
        context: {
          category: 'general',
          userContext: { testing: true }
        }
      }, {
        // Note: In real scenario, you'd need authentication cookies
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data.success) {
        console.log(`🤖 Bot: ${response.data.data.response}`);
        if (response.data.data.suggestions && response.data.data.suggestions.length > 0) {
          console.log(`💡 Suggestions: ${response.data.data.suggestions.slice(0, 2).join(', ')}`);
        }
      } else {
        console.log(`❌ Error: ${response.data.error}`);
      }
      
    } catch (error) {
      if (error.response?.status === 401) {
        console.log(`🔒 Bot: Authentication required - this is expected for protected endpoints`);
      } else {
        console.log(`❌ Request failed: ${error.message}`);
      }
    }
    
    console.log(''); // Empty line for readability
  }
}

async function testBotContext() {
  console.log('🔍 Testing Bot Context Endpoint...\n');
  
  try {
    const response = await axios.get(`${backendUrl}/bot/context`, {
      timeout: 5000
    });
    
    if (response.data.success) {
      console.log('✅ Context endpoint is working');
      console.log('📊 Context data:', JSON.stringify(response.data.data, null, 2));
    } else {
      console.log('❌ Context endpoint failed:', response.data.error);
    }
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('🔒 Context endpoint requires authentication - this is expected');
    } else {
      console.log('❌ Context request failed:', error.message);
    }
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Bot API Tests...\n');
  
  await testBotContext();
  console.log('\n' + '='.repeat(50) + '\n');
  await testBotChat();
  
  console.log('✨ Tests completed!');
}

runTests().catch(console.error);