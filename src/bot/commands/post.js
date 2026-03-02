import { getUser, isUserSetup } from '../../db/models/user.js';
import { getLatestDraftPost, publishPost } from '../../db/models/post.js';
import { markDraftsAsUsed } from '../../db/models/draft.js';
import { upsertDailyStats } from '../../db/models/dailyStats.js';
import { redis } from '../../redis/client.js';

export async function postCommand(ctx) {
  const userId = ctx.from.id;

  // Only in private chat
  if (ctx.chat.type !== 'private') {
    await ctx.reply('Эта команда доступна только в личном чате.');
    return;
  }

  // Check setup
  const setup = await isUserSetup(userId);
  if (!setup) {
    await ctx.reply('Сначала выполни /start для настройки каналов.');
    return;
  }

  const user = await getUser(userId);

  // Try to get pending post from Redis
  const pendingPostId = await redis.get(`pending_post:${user.id}`);
  let post = null;

  if (pendingPostId) {
    // For now, we'll store the post ID directly
    // In a real implementation, we'd fetch from DB
    post = { id: parseInt(pendingPostId, 10) };
  }

  // Try to get from DB if not in Redis
  if (!post) {
    post = await getLatestDraftPost(user.id);
  }

  if (!post) {
    await ctx.reply('Нет готового поста. Используй /combine.');
    return;
  }

  // We need to fetch the full post from DB
  const { query } = await import('../../db/index.js');
  const result = await query('SELECT * FROM posts WHERE id = $1', [post.id]);
  post = result.rows[0];

  if (!post) {
    await ctx.reply('Пост не найден.');
    return;
  }

  // Show post with publish/cancel buttons
  const truncated = post.text.substring(0, 500) + (post.text.length > 500 ? '...' : '');
  await ctx.reply(
    `Опубликовать этот пост?\n\n${truncated}`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Опубликовать', callback_data: `publish_post:${post.id}` },
            { text: '❌ Отмена', callback_data: `cancel_post:${post.id}` },
          ],
        ],
      },
    }
  );
}
