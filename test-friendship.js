// Quick test script to check friendship bidirectionality
const axios = require('axios');

const backendUrl = 'http://localhost:8019';

async function testFriendships() {
  try {
    console.log('Testing friendship endpoint...');
    
    // This endpoint doesn't require authentication for testing
    const response = await axios.get(`${backendUrl}/people/test-friendships`);
    
    console.log('Response:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testFriendships();