import { Telegraf, session } from 'telegraf';
import { startCommand } from './commands/start.js';
import { settingsCommand } from './commands/settings.js';
import { setaiCommand } from './commands/setai.js';
import { subscribeCommand } from './commands/subscribe.js';
import { statsCommand } from './commands/stats.js';
import { draftsCommand, draftsfullCommand } from './commands/drafts.js';
import { newDraftCommand } from './commands/newDraft.js';
import { combineCommand } from './commands/combine.js';
import { postCommand } from './commands/post.js';
import { suggestCommand } from './commands/suggest.js';
import { infoCommand } from './commands/info.js';
import { deleteCommand } from './commands/delete.js';
import { announceCommand } from './commands/announce.js';
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
bot.command('new', newDraftCommand);
bot.command('combine', combineCommand);
bot.command('post', postCommand);
bot.command('suggest', suggestCommand);
bot.command('info', infoCommand);
bot.command('delete', deleteCommand);
bot.command('announce', announceCommand);
bot.command('admin', adminCommand);

// Set bot commands menu
bot.telegram.setMyCommands([
  { command: 'start', description: 'Настройка канала для публикации' },
  { command: 'new', description: 'Создать новый черновик' },
  { command: 'drafts', description: 'Список черновиков (или /drafts тег)' },
  { command: 'drafts_full', description: 'Полный текст черновиков' },
  { command: 'delete', description: 'Удалить черновики (или /delete all)' },
  { command: 'combine', description: 'Объединить черновики в пост' },
  { command: 'post', description: 'Опубликовать или отложить пост' },
  { command: 'suggest', description: 'Идея для следующего поста' },
  { command: 'setai', description: 'Выбрать AI-провайдера' },
  { command: 'settings', description: 'Настройки напоминаний и AI' },
  { command: 'stats', description: 'Статистика письма' },
  { command: 'info', description: 'Подробная инструкция по боту' },
]).catch(err => console.error('Error setting commands:', err));

bot.on('message', handleDraftMessage);
bot.on('callback_query', handleCallbackQuery);
