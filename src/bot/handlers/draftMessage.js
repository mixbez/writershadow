import { getUser, updateUser, isProUser } from '../../db/models/user.js';
import { createDraft } from '../../db/models/draft.js';
import { upsertDailyStats } from '../../db/models/dailyStats.js';
import { redis } from '../../redis/client.js';
import { query } from '../../db/index.js';
import { generateTags } from '../../ai/provider.js';
import { appendTags } from '../../utils/tags.js';
import { schedulePost } from '../../db/models/post.js';
import { localDateToUTC, isValidDateTimeFormat } from '../../utils/timezone.js';

// This handler is used in both private chat (for setup) and draft group (for tracking)
export async function handleDraftMessage(ctx) {
  // Skip if no text
  const text = ctx.message.text || ctx.message.caption || '';
  if (!text) return;

  console.log(`[MSG] User ${ctx.from.id}: "${text}" | setupStep=${ctx.session.setupStep}`);

  // Skip commands - let command handlers process them
  if (text.startsWith('/')) {
    console.log(`[CMD] Skipping command, letting handler process it`);
    return;
  }

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
  const settingsStep = ctx.session.settingsStep;
  const scheduleStep = ctx.session.scheduleStep;

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

  if (settingsStep === 'time') {
    const { handleSettingsTimeInput } = await import('../commands/settings.js');
    try {
      await handleSettingsTimeInput(ctx, text);
    } catch (err) {
      console.error('Settings error:', err);
      await ctx.reply('Ошибка при настройке: ' + err.message);
    }
    return;
  }

  if (settingsStep === 'timezone') {
    const { handleSettingsTimezoneInput } = await import('../commands/settings.js');
    try {
      await handleSettingsTimezoneInput(ctx, text);
    } catch (err) {
      console.error('Settings error:', err);
      await ctx.reply('Ошибка при настройке: ' + err.message);
    }
    return;
  }

  if (scheduleStep === 'date') {
    await handleScheduleDate(ctx, text);
    return;
  }

  if (scheduleStep === 'time') {
    await handleScheduleTime(ctx, text);
    return;
  }

  if (ctx.session.pendingNewDraft) {
    const { saveDraftFromNewCommand } = await import('../commands/newDraft.js');
    try {
      await saveDraftFromNewCommand(ctx, text);
    } catch (err) {
      console.error('New draft error:', err);
      await ctx.reply('Ошибка при создании черновика: ' + err.message);
    }
    ctx.session.pendingNewDraft = null;
    return;
  }

  if (!setupStep) return; // No setup in progress

  try {
    if (setupStep === 'channel') {
      await setupChannel(ctx, userId, text);
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
  let channelUsername = null;

  // Check if forwarded message - try multiple APIs
  console.log(`[SETUP] Checking forward fields:`, {
    forward_origin: ctx.message.forward_origin,
    forward_from_chat: ctx.message.forward_from_chat,
    forward_from: ctx.message.forward_from,
  });

  // New API (v7.0+)
  if (ctx.message.forward_origin?.type === 'channel') {
    channelId = ctx.message.forward_origin.chat?.id;
    console.log(`[SETUP] Got channel from forward_origin (new API):`, channelId);
  }
  // Old API - forward_from_chat
  else if (ctx.message.forward_from_chat?.id) {
    channelId = ctx.message.forward_from_chat.id;
    console.log(`[SETUP] Got channel from forward_from_chat (old API):`, channelId);
  }
  // Manual @username
  else if (text.startsWith('@')) {
    // Parse @username - need to get ID first
    channelUsername = text;
    channelId = text;
    console.log(`[SETUP] Got channel from @username:`, channelId);
  } else {
    await ctx.reply('Пожалуйста, пришли сообщение из канала или напиши @username.');
    return;
  }

  // If we have @username, try to get the actual chat ID first
  if (channelUsername) {
    try {
      console.log(`[SETUP] Resolving channel username ${channelUsername} to ID`);
      const chat = await ctx.telegram.getChat(channelUsername);
      channelId = chat.id;
      console.log(`[SETUP] Resolved ${channelUsername} to ID ${channelId}`);
    } catch (err) {
      console.error(`[SETUP] Failed to resolve ${channelUsername}:`, err.message);
      await ctx.reply(`Не получилось найти канал ${channelUsername}. Проверь, что username правильный.`);
      return;
    }
  }

  // Check if bot is admin in channel
  try {
    const botId = ctx.botInfo?.id || 8692716874; // Fallback to hardcoded bot ID
    console.log(`[SETUP] Checking admin in channelId=${channelId}, botId=${botId}`);
    const member = await ctx.telegram.getChatMember(channelId, botId);
    console.log(`[SETUP] getChatMember result:`, JSON.stringify(member, null, 2));

    // For channels: check status === 'administrator'
    // For groups: check is_administrator
    const isAdmin = member?.status === 'administrator' || member?.is_administrator;

    if (!member || !isAdmin) {
      console.log(`[SETUP] Bot not admin in ${channelId}. Member status: ${member?.status}, is_administrator: ${member?.is_administrator}`);
      await ctx.reply(
        '❌ Я не администратор в этом канале.\n\n' +
        'Пожалуйста:\n' +
        '1. Открой канал → Управление → Администраторы\n' +
        '2. Добавь @WriterShadowBot с правом "Публикация сообщений"\n' +
        '3. Пришли мне сообщение из канала или повтори @username'
      );
      return;
    }
    console.log(`[SETUP] Bot is admin in ${channelId}`);
  } catch (err) {
    console.error(`[SETUP] Error checking admin in ${channelId}:`, err.message);
    await ctx.reply(
      '⚠️ Не получилось проверить права. Возможные причины:\n' +
      '• Неверный username канала (напишите без пробелов, с @)\n' +
      '• Бота удалили из администраторов\n' +
      '• Проблема с доступом\n\n' +
      'Добавь меня админом в канал и повтори.'
    );
    return;
  }

  // Validate channelId before saving
  if (!channelId) {
    console.error(`[SETUP] ERROR: channelId is null/undefined after parsing! forward_origin=${ctx.message.forward_origin}, forward_from_chat=${ctx.message.forward_from_chat}, text="${text}"`);
    await ctx.reply(
      '❌ Не удалось определить ID канала. Попробуй отправить пересланное сообщение из канала еще раз.'
    );
    return;
  }

  // Save channel and finish setup
  try {
    const updated = await updateUser(userId, { blog_channel_id: channelId });
    if (!updated || !updated.blog_channel_id) {
      throw new Error('Failed to save channel to database');
    }
    console.log(`[SETUP] Successfully saved channel ${channelId} for user ${userId}`);
    ctx.session.setupStep = null;
    await ctx.reply(
      '✅ Готово! Канал настроен.\n\n' +
      'Теперь используй:\n' +
      '• /drafts — управление черновиками\n' +
      '• /combine — сборка постов\n' +
      '• /post — публикация\n' +
      '• /info — все команды'
    );
  } catch (err) {
    console.error(`[SETUP] Error saving channel for user ${userId}:`, err);
    await ctx.reply(
      '❌ Не удалось сохранить канал в базу данных. Попробуй еще раз или обратись в поддержку.'
    );
  }
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

async function handleScheduleDate(ctx, text) {
  const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
  if (!dateRegex.test(text)) {
    await ctx.reply('Формат: DD.MM.YYYY (например: 15.03.2026)');
    return;
  }

  ctx.session.scheduleDateStr = text;
  ctx.session.scheduleStep = 'time';
  await ctx.reply('Введи время публикации (HH:MM):');
}

async function handleScheduleTime(ctx, text) {
  const timeRegex = /^\d{2}:\d{2}$/;
  if (!timeRegex.test(text)) {
    await ctx.reply('Формат: HH:MM (например: 14:30)');
    return;
  }

  const postId = ctx.session.schedulePostId;
  const dateStr = ctx.session.scheduleDateStr;
  const user = await getUser(ctx.from.id);

  try {
    const scheduledAt = localDateToUTC(dateStr, text, user.timezone);

    // Check if time is in the past
    if (scheduledAt < new Date()) {
      await ctx.reply('Время в прошлом. Выбери будущую дату/время.');
      return;
    }

    await schedulePost(postId, scheduledAt);

    ctx.session.schedulePostId = null;
    ctx.session.scheduleStep = null;
    ctx.session.scheduleDateStr = null;

    const displayDate = `${dateStr} ${text}`;
    await ctx.reply(`✅ Пост запланирован на ${displayDate} (${user.timezone})`);
  } catch (err) {
    console.error('Schedule error:', err);
    await ctx.reply('Ошибка при планировании: ' + err.message);
  }
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
  const draft = await createDraft(user.id, ctx.message.message_id, chatId, text);

  // Generate tags if enabled and user has Pro access (Features 3 & 4)
  if (isProUser(user) && user.ai_tags_enabled && user.ai_provider !== 'none') {
    try {
      const tags = await generateTags(text, user);
      if (tags && tags.length > 0) {
        const taggedText = appendTags(text, tags);
        // Update draft with tags
        await query(
          'UPDATE drafts SET text = $1, char_count = $2 WHERE id = $3',
          [taggedText, taggedText.length, draft.id]
        );
      }
    } catch (err) {
      // Silently fail - draft already saved
      console.error('Tag generation error:', err);
    }
  }

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
