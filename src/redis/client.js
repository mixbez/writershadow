import { createClient } from 'redis';

const PREFIX = process.env.REDIS_KEY_PREFIX || 'writershadow:';

const client = createClient({
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD || undefined,
});

await client.connect();

export const redis = {
  get: (key) => client.get(`${PREFIX}${key}`),
  set: (key, value, ttlSeconds) =>
    ttlSeconds
      ? client.setEx(`${PREFIX}${key}`, ttlSeconds, value)
      : client.set(`${PREFIX}${key}`, value),
  del: (key) => client.del(`${PREFIX}${key}`),
};
