import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { bot } from './bot/index.js';
import { startScheduler } from './scheduler/reminders.js';
import { runMigrations } from './db/index.js';
import { setupAnalyticsRoutes } from './routes/analytics.js';

const server = Fastify({ logger: true });
const __dir = dirname(fileURLToPath(import.meta.url));

await runMigrations();
startScheduler();
await setupAnalyticsRoutes(server);

let botStarted = false;

if (process.env.NODE_ENV === 'production') {
  server.post('/ws-webhook', async (req, reply) => {
    const updateId = req.body?.update_id;
    console.log(`[WEBHOOK] Received update ${updateId}:`, JSON.stringify(req.body).substring(0, 200));
    // Fire-and-forget: return 200 immediately so Telegram doesn't retry
    setImmediate(() => {
      bot.handleUpdate(req.body).catch(err => {
        console.error(`[WEBHOOK] Error processing update ${updateId}:`, err);
      });
    });
    return { ok: true };
  });
  await server.listen({ port: Number(process.env.PORT || 3001), host: '0.0.0.0' });
  await bot.telegram.setWebhook(process.env.BOT_WEBHOOK_URL);
  console.log('Webhook set:', process.env.BOT_WEBHOOK_URL);
  console.log('Analytics available at: http://localhost:3001/analytics.html');
} else {
  await server.listen({ port: Number(process.env.PORT || 3001), host: '0.0.0.0' });
  await bot.launch();
  botStarted = true;
  console.log('Bot started in polling mode');
  console.log('Analytics available at http://localhost:3001/analytics');
}

process.once('SIGINT', () => {
  if (botStarted) bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  if (botStarted) bot.stop('SIGTERM');
});
