import { getUser, updateUser } from '../../db/models/user.js';
import { createDraft } from '../../db/models/draft.js';
import { upsertDailyStats } from '../../db/models/dailyStats.js';
import { redis } from '../../redis/client.js';

// This handler is used in both private chat (for setup) and draft group (for tracking)
export async function handleDraftMessage(ctx) {
  // Skip if no text
  const text = ctx.message.text || ctx.message.caption || '';
  if (!text) return;

  // Check if in private chat (setup flow)
  if (ctx.chat.type === 'private') {
    return handleSetupMessage(ctx, text);
  }

  // Otherwise, track as draft in group
  await handleDraftInGroup(ctx, text);
}

async function handleSetupMessage(ctx, text) {
  const userId = ctx.from.id;
  const setupStep = ctx.session.setupStep;
  const combineStep = ctx.session.combineStep;
  const aiSetupStep = ctx.session.aiSetupStep;

  if (combineStep === 'selecting') {
    // Import here to avoid circular dependency
    const { handleCombineSelection } = await import('../commands/combine.js');
    try {
      await handleCombineSelection(ctx, text);
    } catch (err) {
      console.error('Combine error:', err);
      await ctx.reply('Ошибка при сборке поста: ' + err.message);
    }
    return;
  }

  if (aiSetupStep === 'key') {
    const { handleAiKeyInput } = await import('../commands/setai.js');
    try {
      await handleAiKeyInput(ctx, text);
    } catch (err) {
      console.error('AI setup error:', err);
      await ctx.reply('Ошибка при настройке AI: ' + err.message);
    }
    return;
  }

  if (!setupStep) return; // No setup in progress

  try {
    if (setupStep === 'channel') {
      await setupChannel(ctx, userId, text);
    } else if (setupStep === 'group') {
      await setupGroup(ctx, userId, text);
    } else if (setupStep === 'time') {
      await setupReminderTime(ctx, userId, text);
    } else if (setupStep === 'timezone') {
      await setupTimezone(ctx, userId, text);
    }
  } catch (err) {
    console.error('Setup error:', err);
    await ctx.reply('Ошибка: ' + err.message);
  }
}

async function setupChannel(ctx, userId, text) {
  let channelId = null;

  // Check if forwarded message
  if (ctx.message.forward_origin && ctx.message.forward_origin.type === 'channel') {
    channelId = ctx.message.forward_origin.chat.id;
  } else if (text.startsWith('@')) {
    // Parse @username
    channelId = text;
  } else {
    await ctx.reply('Пожалуйста, пришли сообщение из канала или напиши @username.');
    return;
  }

  // Check if bot is admin in channel
  try {
    const member = await ctx.telegram.getChatMember(channelId, ctx.botInfo.id);
    if (!member || !member.is_administrator) {
      await ctx.reply(
        'Добавь меня как администратора в канал (нужно право "Публикация сообщений"), затем повтори.'
      );
      return;
    }
  } catch (err) {
    await ctx.reply('Не могу проверить права в канале. Добавь меня админом и повтори.');
    return;
  }

  // Save channel and move to next step
  await updateUser(userId, { blog_channel_id: channelId });
  ctx.session.setupStep = 'group';
  await ctx.reply(
    'Спасибо! Канал настроен.\n\n' +
    'Теперь пришли @username или перешли сообщение из группы, где ведёшь черновики.'
  );
}

async function setupGroup(ctx, userId, text) {
  let groupId = null;

  // Check if forwarded message
  if (ctx.message.forward_origin && ctx.message.forward_origin.type === 'supergroup') {
    groupId = ctx.message.forward_origin.chat.id;
  } else if (text.startsWith('@')) {
    // Parse @username
    groupId = text;
  } else {
    await ctx.reply('Пожалуйста, пришли сообщение из группы или напиши @username.');
    return;
  }

  // Check if bot is member in group
  try {
    await ctx.telegram.getChatMember(groupId, ctx.botInfo.id);
  } catch (err) {
    await ctx.reply('Добавь меня в группу черновиков, затем повтори.');
    return;
  }

  // Save group and finish setup
  await updateUser(userId, { draft_group_id: groupId });
  ctx.session.setupStep = null;
  await ctx.reply(
    'Готово! Настройки сохранены.\n\n' +
    'Напоминание о написании: каждый день в 09:00 (Europe/Moscow).\n' +
    'Поменять время и другие настройки: /settings\n' +
    'Настроить AI-ассистента: /setai'
  );
}

async function setupReminderTime(ctx, userId, text) {
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    await ctx.reply('Введи время в формате HH:MM (например: 09:00)');
    return;
  }

  ctx.session.pendingReminderTime = text;
  ctx.session.settingsStep = 'timezone';
  await ctx.reply('Твой часовой пояс? (например: Europe/Moscow, или пришли геолокацию)');
}

async function setupTimezone(ctx, userId, text) {
  const reminderTime = ctx.session.pendingReminderTime;

  if (!reminderTime) {
    await ctx.reply('Что-то пошло не так. Используй /settings чтобы переделать.');
    ctx.session.settingsStep = null;
    return;
  }

  // For now, just accept timezone as text (validation can be improved)
  const timezone = text.trim() || 'Europe/Moscow';

  await updateUser(userId, {
    reminder_time: reminderTime,
    timezone,
  });

  ctx.session.settingsStep = null;
  ctx.session.pendingReminderTime = null;
  await ctx.reply(`Настройки сохранены! Напоминание: каждый день в ${reminderTime} (${timezone}).`);
}

async function handleDraftInGroup(ctx, text) {
  const chatId = ctx.chat.id;
  const senderUserId = ctx.from.id;

  // Find user whose draft_group_id matches this chat
  const user = await getUser(senderUserId);
  if (!user || user.draft_group_id !== chatId) {
    return; // Not our user or not their draft group
  }

  const charCount = text.length;

  // Save draft
  await createDraft(user.id, ctx.message.message_id, chatId, text);

  // Update daily stats
  const today = new Date().toISOString().slice(0, 10);
  await upsertDailyStats(user.id, today, {
    chars_written: charCount,
    drafts_count: 1,
  });

  // React to first draft of the day
  const today2 = new Date().toISOString().slice(0, 10);
  const lockKey = `first_draft_today:${user.id}:${today2}`;
  const sent = await redis.get(lockKey);
  if (!sent) {
    await redis.set(lockKey, '1', 86400);
    try {
      await ctx.react('✍️');
    } catch (err) {
      // Reaction not supported, continue silently
    }
  }
}
