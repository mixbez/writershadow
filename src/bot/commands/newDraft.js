import { getUser, isUserSetup } from '../../db/models/user.js';
import { createDraft } from '../../db/models/draft.js';
import { upsertDailyStats } from '../../db/models/dailyStats.js';

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
  await createDraft(user.id, null, null, text);

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
