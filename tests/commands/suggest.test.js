import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createMockCtx, mockProUser } from '../helpers/mockCtx.js';

const manyPosts = Array.from({ length: 5 }, (_, i) => ({
  id: i + 1,
  text: `Тестовый пост номер ${i + 1} с достаточным количеством текста.`,
}));

let postsToReturn = manyPosts;
let suggestionToReturn = 'Напиши о том, как преодолеть прокрастинацию.';
let shouldThrow = false;

mock.module('../../src/db/models/user.js', {
  namedExports: {
    getUser: async () => mockProUser,
    isUserSetup: async () => true,
    isProUser: () => true,
  },
});

mock.module('../../src/db/models/post.js', {
  namedExports: {
    getRecentPublishedPosts: async () => postsToReturn,
  },
});

mock.module('../../src/ai/provider.js', {
  namedExports: {
    generateSuggestion: async () => {
      if (shouldThrow) throw new Error('API недоступен');
      return suggestionToReturn;
    },
    generateTags: async () => ['тест'],
    generateBridge: async () => 'Связка.',
  },
});

const { suggestCommand } = await import('../../src/bot/commands/suggest.js');

test('/suggest возвращает идею и обновляет сообщение', async () => {
  postsToReturn = manyPosts;
  shouldThrow = false;

  const ctx = createMockCtx();
  await suggestCommand(ctx);

  assert.ok(ctx._replies[0].text.includes('Анализирую'), 'первое сообщение — статус');
  assert.ok(ctx._edits.length > 0, 'должен отредактировать сообщение');
  assert.ok(ctx._edits[0].includes('Идея'), 'результат содержит идею');
});

test('/suggest показывает ошибку если AI упал', async () => {
  postsToReturn = manyPosts;
  shouldThrow = true;

  const ctx = createMockCtx();
  await suggestCommand(ctx);

  assert.ok(ctx._edits.length > 0, 'должен отредактировать сообщение');
  assert.ok(ctx._edits[0].includes('Ошибка'), 'должен сообщить об ошибке');
});

test('/suggest требует минимум 3 поста', async () => {
  postsToReturn = [{ id: 1, text: 'Один пост' }];
  shouldThrow = false;

  const ctx = createMockCtx();
  await suggestCommand(ctx);

  assert.ok(ctx._edits[0].includes('Мало постов для анализа'));
});
