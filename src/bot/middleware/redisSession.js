import { redis } from '../../redis/client.js';

/**
 * Redis-based session middleware for telegraf
 * Persists session data across webhook calls
 */
export function redisSessionMiddleware() {
  return async (ctx, next) => {
    const userId = ctx.from?.id || ctx.chat?.id;

    if (!userId) {
      return next();
    }

    const sessionKey = `telegram:session:${userId}`;

    // Load session from Redis
    try {
      const sessionData = await redis.get(sessionKey);
      ctx.session = sessionData ? JSON.parse(sessionData) : {};
    } catch (err) {
      console.error(`Failed to load session for user ${userId}:`, err);
      ctx.session = {};
    }

    // Wrap next() to save session after handling
    const originalNext = next;
    return originalNext().then(async () => {
      // Save session back to Redis (7 days TTL)
      if (ctx.session && Object.keys(ctx.session).length > 0) {
        try {
          await redis.set(sessionKey, JSON.stringify(ctx.session), 86400 * 7);
        } catch (err) {
          console.error(`Failed to save session for user ${userId}:`, err);
        }
      }
    });
  };
}
