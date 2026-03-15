import { getUser, isUserSetup } from '../../db/models/user.js';
import { getUnusedDrafts } from '../../db/models/draft.js';
import { generateExpand } from '../../ai/provider.js';

export async function expandCommand(ctx) {
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

  // Check if user has AI configured
  if (!user.ai_provider || user.ai_provider === 'none') {
    await ctx.reply('Настройте AI через /setai');
    return;
  }

  // Parse numbers from args
  const args = ctx.message?.text?.split(/\s+/).slice(1);
  const indices = args?.map(Number).filter(n => Number.isInteger(n) && n > 0);

  if (!indices?.length) {
    return ctx.reply('Использование: /expand 1 или /expand 3 5 7\nНомера берите из списка /drafts');
  }

  const allDrafts = await getUnusedDrafts(user.id);
  if (!allDrafts.length) {
    return ctx.reply('У вас нет черновиков. Создайте их, отправив текст боту.');
  }

  // Resolve 1-based indices (same order as /drafts shows)
  const selected = indices
    .map(i => allDrafts[i - 1])
    .filter(Boolean);

  if (!selected.length) {
    return ctx.reply(`Нет черновиков с такими номерами. Доступно: 1–${allDrafts.length}`);
  }

  const statusMsg = await ctx.reply('Анализирую черновики...');

  try {
    const draftsForAI = selected.map((d, idx) => ({ index: indices[idx], text: d.text }));
    const result = await generateExpand(draftsForAI, user);

    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, result);
  } catch (err) {
    console.error('Expand error:', err);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `Ошибка при генерации предложений: ${err.message}`
    );
  }
}
