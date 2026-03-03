import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { bot } from './bot/index.js';
import { startScheduler } from './scheduler/reminders.js';
import { runMigrations } from './db/index.js';
import { getAnalyticsData, getGlobalStats } from './api/analytics.js';

const server = Fastify({ logger: true });
const __dir = dirname(fileURLToPath(import.meta.url));

await runMigrations();
startScheduler();
await setupAnalyticsRoutes(server);

// Register static file serving for public directory
server.register(fastifyStatic, {
  root: join(__dir, '..', 'public'),
  prefix: '/',
});

// Analytics API endpoint
server.get('/api/analytics', async (req, reply) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return reply.status(400).send({ error: 'Missing from or to date' });
    }

    const users = await getAnalyticsData(from, to);
    const global = await getGlobalStats(from, to);

    return { global, users };
  } catch (error) {
    server.log.error(error);
    return reply.status(500).send({ error: error.message });
  }
});

// Health check endpoint
server.get('/health', async (req, reply) => {
  return { status: 'ok' };
});

if (process.env.NODE_ENV === 'production') {
  server.post('/ws-webhook', async (req, reply) => {
    await bot.handleUpdate(req.body);
    return { ok: true };
  });
  await server.listen({ port: Number(process.env.PORT || 3001), host: '0.0.0.0' });
  await bot.telegram.setWebhook(process.env.BOT_WEBHOOK_URL);
  console.log('Webhook set:', process.env.BOT_WEBHOOK_URL);
  console.log('Analytics available at: http://localhost:3001/analytics.html');
} else {
  await server.listen({ port: Number(process.env.PORT || 3001), host: '0.0.0.0' });
  await bot.launch();
  console.log('Bot started in polling mode');
  console.log('Analytics available at http://localhost:3001/analytics');
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
