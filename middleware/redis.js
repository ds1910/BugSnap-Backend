const redis = require('../config/redis');


const cache = (ttl = 300) => {
  return async (req, res, next) => {
    // Create a more specific cache key that includes user ID and query params
    const userId = req.user?.id || 'anonymous';
    const queryString = new URLSearchParams(req.query).toString();
    const key = `cache:${req.originalUrl}:user:${userId}${queryString ? `:${queryString}` : ''}`;

    try {
      const cached = await redis.get(key);
      if (cached) {
        // console.log(`Cache HIT for key: ${key}`);
        // Upstash Redis returns objects directly, not JSON strings
        // So we don't need to parse if it's already an object
        if (typeof cached === 'string') {
          return res.json(JSON.parse(cached));  // Parse if it's a string
        } else {
          return res.json(cached);  // Return directly if it's already an object
        }
      }

      // console.log(`Cache MISS for key: ${key}`);
      const originalJson = res.json.bind(res);
      res.json = async (data) => {
        try {
          // Store as JSON string for consistency
          await redis.set(key, JSON.stringify(data), { ex: ttl });
          // console.log(`Cache SET for key: ${key}, TTL: ${ttl}s`);
        } catch (setError) {
          // console.error('Redis SET error:', setError);
        }
        originalJson(data);
      };

      next();
    } catch (err) {
      // console.error('Redis error:', err);
      next(); // Continue without caching if Redis fails
    }
  };
};

module.exports = cache;
