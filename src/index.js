import Fastify from 'fastify';
import { bot } from './bot/index.js';
import { startScheduler } from './scheduler/reminders.js';
import { runMigrations } from './db/index.js';

const server = Fastify({
  logger: true,
  bodyLimit: 1048576
});

await runMigrations();
startScheduler();

let botStarted = false;

if (process.env.NODE_ENV === 'production') {
  // Handle webhook POST requests
  server.post('/ws-webhook', async (req, reply) => {
    try {
      console.log('Webhook received update:', req.body.message?.text || req.body.callback_query?.data || 'unknown');
      await bot.handleUpdate(req.body);
      reply.code(200).send({ ok: true });
    } catch (error) {
      console.error('Webhook error:', error);
      reply.code(200).send({ ok: true }); // Always return 200 to avoid retries
    }
  });

  // Handle OPTIONS for CORS
  server.options('/ws-webhook', async (req, reply) => {
    reply.code(200).send();
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
