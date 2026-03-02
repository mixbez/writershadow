import { Telegraf } from 'telegraf';
import { redisSessionMiddleware } from './middleware/redisSession.js';
import { startCommand } from './commands/start.js';
import { settingsCommand } from './commands/settings.js';
import { setaiCommand } from './commands/setai.js';
import { subscribeCommand } from './commands/subscribe.js';
import { statsCommand } from './commands/stats.js';
import { draftsCommand } from './commands/drafts.js';
import { combineCommand } from './commands/combine.js';
import { postCommand } from './commands/post.js';
import { suggestCommand } from './commands/suggest.js';
import { adminCommand } from './commands/admin.js';
import { handleDraftMessage } from './handlers/draftMessage.js';
import { handleCallbackQuery } from './handlers/callbackQuery.js';

export const bot = new Telegraf(process.env.BOT_TOKEN);

// Use Redis for session storage (persists across webhook calls)
bot.use(redisSessionMiddleware());

bot.command('start', startCommand);
bot.command('settings', settingsCommand);
bot.command('setai', setaiCommand);
bot.command('subscribe', subscribeCommand);
bot.command('stats', statsCommand);
bot.command('drafts', draftsCommand);
bot.command('combine', combineCommand);
bot.command('post', postCommand);
bot.command('suggest', suggestCommand);
bot.command('admin', adminCommand);

bot.on('message', handleDraftMessage);
bot.on('callback_query', handleCallbackQuery);
