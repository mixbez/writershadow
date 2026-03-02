import { getUser } from '../../db/models/user.js';
import { getPost, publishPost } from '../../db/models/post.js';
import { markDraftsAsUsed, getDraftsByIds } from '../../db/models/draft.js';
import { upsertDailyStats } from '../../db/models/dailyStats.js';
import { redis } from '../../redis/client.js';
import { query } from '../../db/index.js';

export async function handleCallbackQuery(ctx) {
  const data = ctx.callbackQuery.data;

  try {
    if (data.startsWith('publish_post:')) {
      await handlePublishPost(ctx, data);
    } else if (data.startsWith('cancel_post:')) {
      await handleCancelPost(ctx, data);
    } else if (data.startsWith('toggle_')) {
      await handleToggleSetting(ctx, data);
    }
  } catch (err) {
    console.error('Callback error:', err);
    await ctx.answerCbQuery('Ошибка при обработке действия');
  }
}

async function handlePublishPost(ctx, data) {
  const postId = parseInt(data.split(':')[1], 10);
  const userId = ctx.from.id;
  const user = await getUser(userId);

  if (!user) {
    await ctx.answerCbQuery('Пользователь не найден');
    return;
  }

  const post = await getPost(postId);
  if (!post || post.user_id !== user.id) {
    await ctx.answerCbQuery('Пост не найден или не ваш');
    return;
  }

  try {
    // Send to channel
    const messageResult = await ctx.telegram.sendMessage(user.blog_channel_id, post.text);
    const channelMessageId = messageResult.message_id;

    // Update post in DB
    await publishPost(postId, channelMessageId);

    // Get drafts used for this post
    const result = await query(
      'SELECT id FROM drafts WHERE post_id = $1',
      [postId]
    );
    const draftIds = result.rows.map(r => r.id);

    // Mark drafts as used
    if (draftIds.length > 0) {
      await markDraftsAsUsed(draftIds, postId);
    }

    // Update daily stats
    const today = new Date().toISOString().slice(0, 10);
    await upsertDailyStats(user.id, today, {
      posts_published: 1,
    });

    // Remove from Redis
    await redis.del(`pending_post:${user.id}`);

    // Edit message to show confirmation
    await ctx.editMessageText('✅ Опубликовано!');
    await ctx.answerCbQuery('Пост отправлен в канал', false);
  } catch (err) {
    console.error('Publish error:', err);
    await ctx.answerCbQuery('Ошибка при публикации: ' + err.message);
  }
}

async function handleCancelPost(ctx, data) {
  const postId = parseInt(data.split(':')[1], 10);

  // Just edit message and acknowledge
  await ctx.editMessageText('❌ Отменено. Пост сохранён, вернись позже.');
  await ctx.answerCbQuery('Публикация отменена', false);
}

async function handleToggleSetting(ctx, data) {
  const setting = data.split('_')[1]; // e.g., 'toggle_evening_nudge'
  const userId = ctx.from.id;
  const user = await getUser(userId);

  if (!user) {
    await ctx.answerCbQuery('Пользователь не найден');
    return;
  }

  // Toggle the setting
  let field = '';
  let labelOn = '';
  let labelOff = '';

  if (setting === 'evening_nudge') {
    field = 'evening_nudge_enabled';
    labelOn = 'Вечерний пинок: Вкл';
    labelOff = 'Вечерний пинок: Выкл';
  } else if (setting === 'weekly_summary') {
    field = 'weekly_summary_enabled';
    labelOn = 'Еженедельная сводка: Вкл';
    labelOff = 'Еженедельная сводка: Выкл';
  }

  if (!field) return;

  const newValue = !user[field];
  const result = await query(
    `UPDATE users SET ${field} = $1 WHERE telegram_user_id = $2 RETURNING *`,
    [newValue, userId]
  );
  const updatedUser = result.rows[0];

  // Update button text
  const newLabel = updatedUser[field] ? labelOn : labelOff;
  const callbackData = data.split('_').slice(0, 2).join('_');

  await ctx.editMessageReplyMarkup({
    inline_keyboard: [
      [
        { text: newLabel, callback_data: `${callbackData}_${setting}` },
      ],
    ],
  });

  await ctx.answerCbQuery(`${newLabel}`, false);
}
