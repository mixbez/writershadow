import { getUser, isUserSetup, isProUser } from '../../db/models/user.js';
import { createDraft } from '../../db/models/draft.js';
import { upsertDailyStats } from '../../db/models/dailyStats.js';
import { query } from '../../db/index.js';
import { generateTags } from '../../ai/provider.js';
import { appendTags } from '../../utils/tags.js';

// /new <text> — saves text as a draft directly from private chat
// /new (without text) — prompts user to enter text
export async function newDraftCommand(ctx) {
  if (ctx.chat.type !== 'private') return;

  const userId = ctx.from.id;
  const setup = await isUserSetup(userId);
  if (!setup) {
    await ctx.reply('Сначала выполни /start для настройки.');
    return;
  }

  const text = ctx.message.text.replace(/^\/new\s*/i, '').trim();

  if (!text) {
    // No text provided - ask user to enter it in next message
    if (!ctx.session) ctx.session = {};
    ctx.session.pendingNewDraft = true;
    await ctx.reply('Напиши текст черновика:');
    return;
  }

  // Text provided - save it directly
  await saveDraft(userId, text);
  await ctx.reply(`✅ Черновик сохранён (${text.length} зн.). Используй /combine чтобы собрать пост.`);
}

async function saveDraft(userId, text) {
  const user = await getUser(userId);
  const draft = await createDraft(user.id, null, null, text);

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

  const today = new Date().toISOString().slice(0, 10);
  await upsertDailyStats(user.id, today, {
    chars_written: text.length,
    drafts_count: 1,
  });
}

export async function saveDraftFromNewCommand(ctx, text) {
  const userId = ctx.from.id;
  await saveDraft(userId, text);
  await ctx.reply(`✅ Черновик сохранён (${text.length} зн.). Используй /combine чтобы собрать пост.`);
}
