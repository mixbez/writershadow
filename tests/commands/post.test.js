import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createMockCtx, mockProUser } from '../helpers/mockCtx.js';

const mockPost = {
  id: 42,
  text: 'Это тестовый пост для публикации',
  status: 'draft',
  user_id: 1,
};

let postToReturn = mockPost;

mock.module('../../src/db/models/user.js', {
  namedExports: {
    getUser: async () => mockProUser,
    isUserSetup: async () => true,
  },
});

mock.module('../../src/db/models/post.js', {
  namedExports: {
    getLatestDraftPost: async () => postToReturn,
    publishPost: async () => {},
  },
});

mock.module('../../src/redis/client.js', {
  namedExports: {
    redis: {
      get: async () => null,
      set: async () => {},
      del: async () => {},
    },
  },
});

mock.module('../../src/db/index.js', {
  namedExports: {
    query: async () => ({ rows: [postToReturn] }),
    runMigrations: async () => {},
  },
});

const { postCommand } = await import('../../src/bot/commands/post.js');

test('/post показывает кнопку "⏰ Отложить"', async () => {
  postToReturn = mockPost;

  const ctx = createMockCtx();
  await postCommand(ctx);

  const keyboard = ctx.lastReplyOpts()?.reply_markup?.inline_keyboard;
  assert.ok(keyboard, 'должен быть inline_keyboard');
  const allTexts = keyboard.flat().map(b => b.text);
  assert.ok(allTexts.some(t => t.includes('Отложить')), 'должна быть кнопка Отложить');
});

test('/post показывает кнопки Опубликовать и Отмена', async () => {
  postToReturn = mockPost;

  const ctx = createMockCtx();
  await postCommand(ctx);

  const keyboard = ctx.lastReplyOpts()?.reply_markup?.inline_keyboard;
  const allTexts = keyboard.flat().map(b => b.text);
  assert.ok(allTexts.some(t => t.includes('Опубликовать')));
  assert.ok(allTexts.some(t => t.includes('Отмена')));
});

test('/post говорит "нет поста" если нечего публиковать', async () => {
  postToReturn = null;

  const ctx = createMockCtx();
  await postCommand(ctx);

  assert.ok(ctx.lastReply().includes('Нет готового поста'));
});
