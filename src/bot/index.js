import { Telegraf, session } from 'telegraf';
import { startCommand } from './commands/start.js';
import { settingsCommand } from './commands/settings.js';
import { setaiCommand } from './commands/setai.js';
import { subscribeCommand } from './commands/subscribe.js';
import { statsCommand } from './commands/stats.js';
import { draftsCommand, draftsfullCommand } from './commands/drafts.js';
import { combineCommand } from './commands/combine.js';
import { postCommand } from './commands/post.js';
import { suggestCommand } from './commands/suggest.js';
import { adminCommand } from './commands/admin.js';
import { handleDraftMessage } from './handlers/draftMessage.js';
import { handleCallbackQuery } from './handlers/callbackQuery.js';

export const bot = new Telegraf(process.env.BOT_TOKEN);

bot.use(session());

bot.use((ctx, next) => {
  // Ensure session exists
  if (!ctx.session) {
    ctx.session = {};
  }
  if (ctx.message) {
    console.log(`[UPDATE] User ${ctx.from.id}: ${ctx.message.text || '[no text]'}`);
  }
  if (ctx.callbackQuery) {
    console.log(`[CALLBACK] User ${ctx.from.id}: ${ctx.callbackQuery.data}`);
  }
  return next();
});

bot.command('start', startCommand);
bot.command('settings', settingsCommand);
bot.command('setai', setaiCommand);
bot.command('subscribe', subscribeCommand);
bot.command('stats', statsCommand);
bot.command('drafts', draftsCommand);
bot.command('drafts_full', draftsfullCommand);
bot.command('combine', combineCommand);
bot.command('post', postCommand);
bot.command('suggest', suggestCommand);
bot.command('admin', adminCommand);

bot.on('message', handleDraftMessage);
bot.on('callback_query', handleCallbackQuery);
