import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createMockCtx, mockProUser } from '../helpers/mockCtx.js';

const savedDrafts = [];

mock.module('../../src/db/models/user.js', {
  namedExports: {
    getUser: async () => mockProUser,
    isUserSetup: async () => true,
    isProUser: () => true,
  },
});

mock.module('../../src/db/models/draft.js', {
  namedExports: {
    createDraft: async (userId, msgId, chatId, text) => {
      const draft = { id: savedDrafts.length + 1, text, user_id: userId };
      savedDrafts.push(draft);
      return draft;
    },
  },
});

mock.module('../../src/db/models/dailyStats.js', {
  namedExports: {
    upsertDailyStats: async () => {},
  },
});

mock.module('../../src/db/index.js', {
  namedExports: {
    query: async () => ({ rows: [] }),
    runMigrations: async () => {},
  },
});

mock.module('../../src/ai/provider.js', {
  namedExports: {
    generateTags: async () => ['тег1', 'тег2'],
    generateSuggestion: async () => '',
    generateBridge: async () => '',
  },
});

const { newDraftCommand } = await import('../../src/bot/commands/newDraft.js');

test('/new с текстом сохраняет черновик', async () => {
  const ctx = createMockCtx({ text: '/new Это мой тестовый черновик' });
  await newDraftCommand(ctx);

  assert.ok(ctx.lastReply().includes('Черновик сохранён'));
});

test('/new без текста просит ввести текст', async () => {
  const ctx = createMockCtx({ text: '/new' });
  await newDraftCommand(ctx);

  assert.ok(ctx.lastReply().includes('Напиши текст'));
  assert.equal(ctx.session.pendingNewDraft, true);
});

test('/new не работает в группе', async () => {
  const ctx = createMockCtx({ text: '/new тест', chatType: 'group' });
  await newDraftCommand(ctx);

  assert.equal(ctx._replies.length, 0, 'не должен отвечать в группе');
});
