import { Telegraf } from 'telegraf';
import { redisSessionMiddleware } from './middleware/redisSession.js';
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
import { askCommand } from './commands/ask.js';
import { expandCommand } from './commands/expand.js';
import { promoteCommand } from './commands/promote.js';
import { infoCommand } from './commands/info.js';
import { deleteCommand } from './commands/delete.js';
import { announceCommand } from './commands/announce.js';
import { adminCommand } from './commands/admin.js';
import { handleDraftMessage } from './handlers/draftMessage.js';
import { handleCallbackQuery } from './handlers/callbackQuery.js';
import { handleJsonImport } from './handlers/importHandler.js';

export const bot = new Telegraf(process.env.BOT_TOKEN);

bot.use(redisSessionMiddleware());

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
bot.command('ask', askCommand);
bot.command('expand', expandCommand);
bot.command('promote', promoteCommand);
bot.command('info', infoCommand);
bot.command('delete', deleteCommand);
bot.command('announce', announceCommand);
bot.command('admin', adminCommand);

// Set bot commands menu
bot.telegram.setMyCommands([
  { command: 'info', description: '📖 Полный список команд и советы — начни отсюда!' },
  { command: 'start', description: '🚀 Первоначальная настройка канала для публикации' },
  { command: 'new', description: '✍️ Создать новый черновик (быстро или развёрнуто)' },
  { command: 'drafts', description: '📄 Список всех черновиков — бери номера для /expand' },
  { command: 'drafts_full', description: '📋 Полный текст всех черновиков' },
  { command: 'delete', description: '🗑️ Удалить черновики (один за раз или все сразу)' },
  { command: 'combine', description: '🔗 Объединить несколько черновиков в один пост' },
  { command: 'post', description: '📤 Опубликовать готовый пост или отложить на время' },
  { command: 'suggest', description: '💡 AI идея для нового поста (анализирует твои публикации)' },
  { command: 'ask', description: '🤔 AI вопросы читателя (как развить тему дальше)' },
  { command: 'expand', description: '🚀 AI развить черновики в полноценные посты' },
  { command: 'promote', description: '🤝 Найти похожих авторов для взаимопиара' },
  { command: 'setai', description: '🤖 Выбрать AI (Groq бесплатно или свой Anthropic ключ)' },
  { command: 'settings', description: '⚙️ Настройки напоминаний, часовой пояс, AI-теги' },
  { command: 'stats', description: '📊 Статистика письма (символы, посты, активность)' },
]).catch(err => console.error('Error setting commands:', err));

bot.on('document', handleJsonImport);
bot.on('message', handleDraftMessage);
bot.on('callback_query', handleCallbackQuery);
