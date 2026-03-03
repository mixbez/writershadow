import { Telegraf } from 'telegraf';
import { redisSessionMiddleware } from './middleware/redisSession.js';
import { commandLoggerMiddleware } from './middleware/commandLogger.js';
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
import { newDraftCommand } from './commands/newDraft.js';
import { deleteCommand } from './commands/delete.js';
import { handleDraftMessage } from './handlers/draftMessage.js';
import { handleCallbackQuery } from './handlers/callbackQuery.js';
import { handleChannelDraftPost } from './handlers/channelDraft.js';

export const bot = new Telegraf(process.env.BOT_TOKEN);

// Use Redis for session storage (persists across webhook calls)
bot.use(redisSessionMiddleware());

// Log all commands
bot.use(commandLoggerMiddleware());

bot.command('start', startCommand);
bot.command('settings', settingsCommand);
bot.command('setai', setaiCommand);
bot.command('subscribe', subscribeCommand);
bot.command('stats', statsCommand);
bot.command('drafts', draftsCommand);
bot.command('delete', deleteCommand);
bot.command('combine', combineCommand);
bot.command('post', postCommand);
bot.command('suggest', suggestCommand);
bot.command('admin', adminCommand);
bot.command('new', newDraftCommand);

bot.on('message', handleDraftMessage);
// channel_post is a separate update type for messages in channels where the bot is admin
bot.on('channel_post', handleChannelDraftPost);
bot.on('callback_query', handleCallbackQuery);
