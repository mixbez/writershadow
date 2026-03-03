import { getUser, isUserSetup } from '../../db/models/user.js';
import { getUnusedDrafts } from '../../db/models/draft.js';

export async function draftsCommand(ctx) {
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
  const drafts = await getUnusedDrafts(user.id);

  if (drafts.length === 0) {
    await ctx.reply('Черновиков нет. Создай черновик через /new!');
    return;
  }

  // Format drafts list (last 20)
  const recentDrafts = drafts.slice(0, 20);
  const totalChars = drafts.reduce((sum, d) => sum + d.char_count, 0);

  let draftsList = '📝 Черновики (последние 20):\n\n';
  recentDrafts.forEach((draft, i) => {
    const date = new Date(draft.created_at);
    const dateStr = date.toLocaleDateString('ru-RU', { month: '2-digit', day: '2-digit' });
    const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false });
    const preview = draft.text.substring(0, 80).replace(/\n/g, ' ');
    const truncated = draft.text.length > 80 ? preview + '...' : preview;
    draftsList += `${i + 1}. [${dateStr}, ${timeStr}] — ${draft.char_count} зн.\n`;
    draftsList += `   «${truncated}»\n\n`;
  });

  draftsList += `Итого: ${drafts.length} черновиков · ${totalChars} знаков\n`;
  draftsList += 'Собери пост: /combine\n';
  draftsList += 'Удалить черновик: /delete';

  await ctx.reply(draftsList);
}
