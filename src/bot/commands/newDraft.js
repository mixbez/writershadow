import { getUser, isUserSetup } from '../../db/models/user.js';
import { createDraft } from '../../db/models/draft.js';
import { upsertDailyStats } from '../../db/models/dailyStats.js';

// /new <text> — saves text as a draft directly from private chat
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
    await ctx.reply('Напиши текст черновика после команды:\n/new Сегодня думал о том, что...');
    return;
  }

  const user = await getUser(userId);
  await createDraft(user.id, ctx.message.message_id, ctx.chat.id, text);

  const today = new Date().toISOString().slice(0, 10);
  await upsertDailyStats(user.id, today, {
    chars_written: text.length,
    drafts_count: 1,
  });

  await ctx.reply(`✅ Черновик сохранён (${text.length} зн.). Используй /combine чтобы собрать пост.`);
}
