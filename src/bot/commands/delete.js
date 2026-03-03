import { getUser, isUserSetup } from '../../db/models/user.js';
import { deleteDraft, getUnusedDrafts } from '../../db/models/draft.js';
import { upsertDailyStats } from '../../db/models/dailyStats.js';

export async function deleteCommand(ctx) {
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
    await ctx.reply('Черновиков нет.');
    return;
  }

  // Show last 20 drafts with delete buttons
  const recentDrafts = drafts.slice(0, 20);

  let message = '❌ Удалить черновики (последние 20):\n\n';
  const buttons = [];

  recentDrafts.forEach((draft, i) => {
    const date = new Date(draft.created_at);
    const dateStr = date.toLocaleDateString('ru-RU', { month: '2-digit', day: '2-digit' });
    const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false });
    const preview = draft.text.substring(0, 50).replace(/\n/g, ' ');
    const truncated = draft.text.length > 50 ? preview + '...' : preview;

    message += `${i + 1}. [${dateStr}, ${timeStr}] — «${truncated}»\n`;

    buttons.push([
      {
        text: `❌ ${i + 1}`,
        callback_data: `delete_draft:${draft.id}`
      }
    ]);
  });

  message += `\nВсего: ${drafts.length} черновиков`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: buttons,
    },
  });
}

export async function handleDeleteDraftCallback(ctx, draftId) {
  const userId = ctx.from.id;
  const user = await getUser(userId);

  if (!user) {
    await ctx.answerCbQuery('Пользователь не найден');
    return;
  }

  try {
    await deleteDraft(draftId);

    // Update daily stats
    const today = new Date().toISOString().slice(0, 10);
    await upsertDailyStats(user.id, today, {
      drafts_deleted: 1,
    });

    // Edit message to show confirmation
    await ctx.editMessageText('✅ Черновик удален!');
    await ctx.answerCbQuery('Черновик удален', false);
  } catch (err) {
    console.error('Delete error:', err);
    await ctx.answerCbQuery('Ошибка при удалении: ' + err.message);
  }
}
