const axios = require('axios');

// Test script to verify bug update functionality
async function testBugUpdate() {
  const backendUrl = 'http://localhost:8019';
  
  try {
    // First, let's try to get all bugs to see if any exist
    console.log('Testing bug endpoints...');
    
    // This will likely fail without authentication, but we can see the error
    const response = await axios.get(`${backendUrl}/bug/all`, {
      params: { teamId: '507f1f77bcf86cd799439011' }, // dummy team ID
      timeout: 5000
    });
    
    console.log('Response:', response.data);
  } catch (error) {
    console.log('Expected error (authentication required):', {
      status: error.response?.status,
      message: error.response?.data?.message || error.message
    });
  }
  
  // Test if server is responding
  try {
    const healthCheck = await axios.get(`${backendUrl}/health`, { timeout: 5000 });
    console.log('Health check:', healthCheck.data);
  } catch (error) {
    console.log('Health check failed (expected - no health endpoint):', error.message);
  }
}

testBugUpdate();