import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createMockCtx, mockProUser, mockFreeUser } from '../helpers/mockCtx.js';

mock.module('../../src/db/models/user.js', {
  namedExports: {
    getUser: async (userId) => userId === mockFreeUser.telegram_user_id ? mockFreeUser : mockProUser,
    isUserSetup: async () => true,
    updateUser: async () => {},
    isProUser: (user) => user.subscription_status === 'active' ||
      (user.demo_expires_at && new Date(user.demo_expires_at) > new Date()),
  },
});

const { settingsCommand } = await import('../../src/bot/commands/settings.js');

test('/settings показывает кнопки AI-тегов и Связок', async () => {
  const ctx = createMockCtx();
  await settingsCommand(ctx);

  const keyboard = ctx.lastReplyOpts()?.reply_markup?.inline_keyboard;
  assert.ok(keyboard, 'должен быть inline_keyboard');

  const allCallbacks = keyboard.flat().map(b => b.callback_data);
  assert.ok(allCallbacks.includes('toggle_ai_tags'), 'должна быть кнопка toggle_ai_tags');
  assert.ok(allCallbacks.includes('toggle_bridge'), 'должна быть кнопка toggle_bridge');
});

test('/settings показывает кнопку изменить время напоминания', async () => {
  const ctx = createMockCtx();
  await settingsCommand(ctx);

  const keyboard = ctx.lastReplyOpts()?.reply_markup?.inline_keyboard;
  const allCallbacks = keyboard.flat().map(b => b.callback_data);
  assert.ok(allCallbacks.includes('settings_time'), 'должна быть кнопка settings_time');
});

test('/settings не работает вне личного чата', async () => {
  const ctx = createMockCtx({ chatType: 'group' });
  await settingsCommand(ctx);

  assert.ok(ctx.lastReply().includes('только в личном чате'));
});

test('/settings отвечает для free-пользователя с демо', async () => {
  const ctx = createMockCtx({ userId: mockFreeUser.telegram_user_id });
  await settingsCommand(ctx);

  assert.ok(ctx._replies.length > 0, 'должен ответить');
  const keyboard = ctx.lastReplyOpts()?.reply_markup?.inline_keyboard;
  assert.ok(keyboard, 'должен быть inline_keyboard');
});
