import { getUser, isUserSetup } from '../../db/models/user.js';
import { deleteDraft, getUnusedDrafts } from '../../db/models/draft.js';
import { upsertDailyStats } from '../../db/models/dailyStats.js';
import { query } from '../../db/index.js';

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

  // Check for /delete all argument
  const args = ctx.message.text.split(' ').slice(1).join(' ').trim();

  if (args === 'all') {
    // Delete all drafts
    await handleDeleteAllDrafts(ctx, user);
    return;
  }

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

  message += `\nВсего: ${drafts.length} черновиков\n\nИли используй /delete all для удаления всех`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: buttons,
    },
  });
}

async function handleDeleteAllDrafts(ctx, user) {
  const drafts = await getUnusedDrafts(user.id);

  if (drafts.length === 0) {
    await ctx.reply('Черновиков нет.');
    return;
  }

  // Show confirmation with count
  const count = drafts.length;
  await ctx.reply(`Удалить все ${count} черновиков?`, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Да, удалить все', callback_data: 'confirm_delete_all' },
          { text: '❌ Отмена', callback_data: 'cancel_delete_all' },
        ],
      ],
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

export async function handleConfirmDeleteAll(ctx) {
  const userId = ctx.from.id;
  const user = await getUser(userId);

  if (!user) {
    await ctx.answerCbQuery('Пользователь не найден');
    return;
  }

  try {
    // Get all drafts before deleting
    const drafts = await getUnusedDrafts(user.id);
    const count = drafts.length;

    if (count === 0) {
      await ctx.editMessageText('Черновиков нет.');
      await ctx.answerCbQuery('', false);
      return;
    }

    // Delete all drafts
    await query(
      'DELETE FROM drafts WHERE user_id = $1 AND is_used = FALSE',
      [user.id]
    );

    // Update daily stats
    const today = new Date().toISOString().slice(0, 10);
    await upsertDailyStats(user.id, today, {
      drafts_deleted: count,
    });

    await ctx.editMessageText(`✅ Удалено ${count} черновиков!`);
    await ctx.answerCbQuery('Черновики удалены', false);
  } catch (err) {
    console.error('Delete all error:', err);
    await ctx.answerCbQuery('Ошибка при удалении: ' + err.message);
  }
}

export async function handleCancelDeleteAll(ctx) {
  await ctx.editMessageText('❌ Отменено');
  await ctx.answerCbQuery('', false);
}
