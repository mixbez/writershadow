import { createClient } from 'redis';

const PREFIX = process.env.REDIS_KEY_PREFIX || 'writershadow:';

let client = null;
let connecting = false;

async function getClient() {
  if (client && client.isOpen) {
    return client;
  }

  if (connecting) {
    // Wait for ongoing connection
    while (!client || !client.isOpen) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return client;
  }

  connecting = true;
  try {
    client = createClient({
      url: process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD || undefined,
    });
    await client.connect();
  } catch (error) {
    console.warn('Redis connection failed:', error.message);
    client = null;
  }
  connecting = false;
  return client;
}

export const redis = {
  get: async (key) => {
    const c = await getClient();
    if (!c) return null;
    return c.get(`${PREFIX}${key}`);
  },
  set: async (key, value, ttlSeconds) => {
    const c = await getClient();
    if (!c) return;
    return ttlSeconds
      ? c.setEx(`${PREFIX}${key}`, ttlSeconds, value)
      : c.set(`${PREFIX}${key}`, value);
  },
  del: async (key) => {
    const c = await getClient();
    if (!c) return;
    return c.del(`${PREFIX}${key}`);
  },
};
