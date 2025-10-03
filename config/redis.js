const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Test Redis connection and functionality
const testRedis = async () => {
  try {
    // Test basic connectivity
    await redis.ping();
    // console.log('✅ Redis connection successful');
    
    // Test set/get functionality
    const testKey = 'test:connection';
    const testData = { message: 'test', timestamp: Date.now() };
    
    await redis.set(testKey, JSON.stringify(testData), { ex: 60 });
    const retrieved = await redis.get(testKey);
    
    if (retrieved) {
      // console.log('✅ Redis set/get test successful');
      // Clean up test data
      await redis.del(testKey);
    } else {
      // console.log('⚠️ Redis set/get test failed');
    }
  } catch (error) {
    // console.error('❌ Redis connection/test failed:', error.message);
  }
};

// Run test on startup
testRedis();

module.exports = redis;
