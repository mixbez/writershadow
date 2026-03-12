/**
 * Smoke test — проверяет что бот стартует и не падает на базовых командах.
 * Мокает DB и Redis, поднимает реальный Telegraf и шлёт ему апдейты.
 */

// Нужно до любых импортов — crypto/keys.js читает эту переменную на уровне модуля
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.BOT_TOKEN = '0:test_token';

import { test, mock, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Мокаем всю инфраструктуру до импорта бота
mock.module('../src/redis/client.js', {
  namedExports: {
    redis: { get: async () => null, set: async () => {}, del: async () => {} },
  },
});

mock.module('../src/db/index.js', {
  namedExports: {
    query: async () => ({ rows: [] }),
    pool: { query: async () => ({ rows: [] }) },
    runMigrations: async () => {},
  },
});

const mockUser = {
  id: 1, telegram_user_id: 1847504, username: 'test',
  ai_provider: 'paid', subscription_status: 'active',
  demo_expires_at: null, ai_tags_enabled: true, bridge_enabled: false,
  reminder_time: '09:00', timezone: 'Europe/Moscow',
  evening_nudge_enabled: false, evening_nudge_time: '21:00',
  weekly_summary_enabled: false, blog_channel_id: '@testchannel',
  draft_group_id: null, reminder_enabled: true,
};

mock.module('../src/db/models/user.js', {
  namedExports: {
    getUser: async () => mockUser,
    createOrGetUser: async () => mockUser,
    getUserById: async () => mockUser,
    getUserByUsername: async () => mockUser,
    getAllActiveUsers: async () => [mockUser],
    getUserByDraftGroupId: async () => null,
    isUserSetup: async () => true,
    updateUser: async () => {},
    isProUser: () => true,
  },
});

mock.module('../src/db/models/post.js', {
  namedExports: {
    createDraftPost: async () => ({ id: 1, text: 'test', status: 'draft' }),
    publishPost: async () => {},
    getPost: async () => null,
    getLatestDraftPost: async () => null,
    getRecentPublishedPosts: async () => [],
    getPostsByUserId: async () => [],
    deletePost: async () => {},
    schedulePost: async () => {},
    getDueScheduledPosts: async () => [],
    getScheduledPostsByUser: async () => [],
    importPostsForUser: async () => 0,
  },
});

mock.module('../src/db/models/draft.js', {
  namedExports: {
    createDraft: async () => ({ id: 1, text: 'test' }),
    getUnusedDrafts: async () => [],
    getUnusedDraftsByTag: async () => [],
    getDraftsByIds: async () => [],
    getDraft: async () => null,
    getDraftCount: async () => 0,
    markDraftsAsUsed: async () => {},
    deleteDraft: async () => {},
    deleteDraftsByPostId: async () => {},
  },
});

mock.module('../src/db/models/dailyStats.js', {
  namedExports: {
    upsertDailyStats: async () => {},
    getTodayStats: async () => ({}),
    getStatsForPeriod: async () => [],
    getStatsByDate: async () => ({}),
    getStatsRange: async () => [],
  },
});

mock.module('../src/db/models/commandLog.js', {
  namedExports: { logCommand: async () => {} },
});

mock.module('../src/ai/provider.js', {
  namedExports: {
    generateSuggestion: async () => 'Идея для поста',
    generateTags: async () => ['тег'],
    generateBridge: async () => 'Связка',
  },
});

mock.module('../src/scheduler/reminders.js', {
  namedExports: { startScheduler: () => {} },
});

// Импортируем бота ПОСЛЕ всех моков
const { bot } = await import('../src/bot/index.js');

// Установить botInfo чтобы не было вызова getMe к реальному Telegram
bot.botInfo = { id: 123456, is_bot: true, first_name: 'WriterShadow', username: 'writershadow_bot' };

// Хелпер — создаёт фейковый Telegram update
// entities обязателен чтобы Telegraf распознал команду (бот парсит entities, а не просто '/')
function makeUpdate(text, updateId = 1) {
  const isCommand = text.startsWith('/');
  const cmdLength = isCommand ? text.split(' ')[0].length : 0;
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      from: { id: 1847504, is_bot: false, first_name: 'Test', username: 'test' },
      chat: { id: 1847504, type: 'private' },
      date: Math.floor(Date.now() / 1000),
      text,
      ...(isCommand ? {
        entities: [{ offset: 0, length: cmdLength, type: 'bot_command' }],
      } : {}),
    },
  };
}

// Перехватываем ответы бота вместо реальных Telegram API вызовов
const sentMessages = [];
// Мокаем на уровне прототипа — ctx.telegram это отдельный объект от bot.telegram,
// поэтому нужно патчить класс а не экземпляр
const TelegramProto = Object.getPrototypeOf(bot.telegram);
const originalCallApi = TelegramProto.callApi;

before(() => {
  TelegramProto.callApi = async function(method, payload) {
    if (method === 'sendMessage') {
      sentMessages.push({ chatId: payload.chat_id, text: payload.text, opts: payload });
      return { message_id: sentMessages.length, chat: { id: payload.chat_id } };
    }
    if (method === 'editMessageText') return { message_id: 1 };
    if (method === 'getFile') return { file_id: 'test', file_path: 'test/file.json' };
    // Всё остальное — просто успех
    return {};
  };
});

after(() => {
  TelegramProto.callApi = originalCallApi;
});


test('/settings — бот отвечает и не падает', async () => {
  const before = sentMessages.length;
  await bot.handleUpdate(makeUpdate('/settings', 1));
  assert.ok(sentMessages.length > before, 'бот должен ответить на /settings');
});

test('/new текст — бот отвечает и не падает', async () => {
  const before = sentMessages.length;
  await bot.handleUpdate(makeUpdate('/new Тестовый черновик', 2));
  assert.ok(sentMessages.length > before, 'бот должен ответить на /new');
});

test('/drafts — бот отвечает и не падает', async () => {
  const before = sentMessages.length;
  await bot.handleUpdate(makeUpdate('/drafts', 3));
  assert.ok(sentMessages.length > before, 'бот должен ответить на /drafts');
});

test('/post — бот отвечает и не падает', async () => {
  const before = sentMessages.length;
  await bot.handleUpdate(makeUpdate('/post', 4));
  assert.ok(sentMessages.length > before, 'бот должен ответить на /post');
});

test('/suggest — бот отвечает и не падает', async () => {
  const before = sentMessages.length;
  await bot.handleUpdate(makeUpdate('/suggest', 5));
  assert.ok(sentMessages.length > before, 'бот должен ответить на /suggest');
});

test('/stats — бот отвечает и не падает', async () => {
  const before = sentMessages.length;
  await bot.handleUpdate(makeUpdate('/stats', 6));
  assert.ok(sentMessages.length > before, 'бот должен ответить на /stats');
});
