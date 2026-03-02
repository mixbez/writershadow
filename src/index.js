import Fastify from 'fastify';
import { bot } from './bot/index.js';
import { startScheduler } from './scheduler/reminders.js';
import { runMigrations } from './db/index.js';

const server = Fastify({ logger: true });

await runMigrations();
startScheduler();

let botStarted = false;

if (process.env.NODE_ENV === 'production') {
  server.post('/ws-webhook', async (req, reply) => {
    try {
      console.log('Webhook received update:', req.body.message?.text || req.body.callback_query?.data || 'unknown');
      await bot.handleUpdate(req.body);
      return { ok: true };
    } catch (error) {
      console.error('Webhook error:', error);
      return { ok: false, error: error.message };
    }
  });
  await server.listen({ port: Number(process.env.PORT || 3001), host: '0.0.0.0' });
  await bot.telegram.setWebhook(process.env.BOT_WEBHOOK_URL);
  console.log('Webhook set:', process.env.BOT_WEBHOOK_URL);
} else {
  await bot.launch();
  botStarted = true;
  console.log('Bot started in polling mode');
}

process.once('SIGINT', () => {
  if (botStarted) bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  if (botStarted) bot.stop('SIGTERM');
});
