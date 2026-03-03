import { getUserByDraftGroupId } from '../../db/models/user.js';
import { createDraft } from '../../db/models/draft.js';
import { upsertDailyStats } from '../../db/models/dailyStats.js';
import { redis } from '../../redis/client.js';

// Handles posts published in a channel that is set as a user's draft channel.
// Telegram delivers these as 'channel_post' updates, not 'message' updates,
// so ctx.from is not available — we identify the user by ctx.chat.id.
export async function handleChannelDraftPost(ctx) {
  const chatId = ctx.chat.id;
  const text = ctx.channelPost?.text || ctx.channelPost?.caption || '';
  if (!text) return;

  const user = await getUserByDraftGroupId(chatId);
  if (!user) return;

  const charCount = text.length;

  await createDraft(user.id, ctx.channelPost.message_id, chatId, text);

  const today = new Date().toISOString().slice(0, 10);
  await upsertDailyStats(user.id, today, {
    chars_written: charCount,
    drafts_count: 1,
  });

  // React to first draft of the day
  const lockKey = `first_draft_today:${user.id}:${today}`;
  const sent = await redis.get(lockKey);
  if (!sent) {
    await redis.set(lockKey, '1', 86400);
    try {
      await ctx.telegram.setMessageReaction(chatId, ctx.channelPost.message_id, [
        { type: 'emoji', emoji: '✍' },
      ]);
    } catch {
      // Reactions may not be supported — ignore silently
    }
  }
}
