import { getUser, isUserSetup } from '../../db/models/user.js';
import { getUnusedDrafts, getDraftsByIds } from '../../db/models/draft.js';
import { createDraftPost } from '../../db/models/post.js';
import { redis } from '../../redis/client.js';

export async function combineCommand(ctx) {
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
    await ctx.reply('Черновиков нет. Напиши что-нибудь в группе черновиков!');
    return;
  }

  // Show drafts list and ask for selection
  let draftsList = '📝 Черновики (последние 20):\n\n';
  const recentDrafts = drafts.slice(0, 20);
  recentDrafts.forEach((draft, i) => {
    const date = new Date(draft.created_at);
    const dateStr = date.toLocaleDateString('ru-RU', { month: '2-digit', day: '2-digit' });
    const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false });
    const preview = draft.text.substring(0, 60).replace(/\n/g, ' ');
    const truncated = draft.text.length > 60 ? preview + '...' : preview;
    draftsList += `${i + 1}. [${dateStr}, ${timeStr}] — ${draft.char_count} зн.\n   «${truncated}»\n`;
  });

  draftsList += '\nВведи номера через пробел (например: 1 3 5) или напиши «все».';

  if (!ctx.session) ctx.session = {};
  ctx.session.combineStep = 'selecting';
  ctx.session.combineAvailableDrafts = recentDrafts.map(d => d.id);
  await ctx.reply(draftsList);
}

// This is called from the message handler when combining
export async function handleCombineSelection(ctx, text) {
  const userId = ctx.from.id;
  if (!ctx.session) ctx.session = {};
  const availableIds = ctx.session.combineAvailableDrafts || [];

  let selectedIds = [];

  if (text.toLowerCase() === 'все') {
    selectedIds = availableIds;
  } else {
    const numbers = text.match(/\d+/g) || [];
    selectedIds = numbers
      .map(n => parseInt(n, 10))
      .filter(n => n > 0 && n <= availableIds.length)
      .map(n => availableIds[n - 1]);
  }

  if (selectedIds.length === 0) {
    await ctx.reply('Не найдены выбранные номера. Повтори /combine.');
    ctx.session.combineStep = null;
    return;
  }

  // Get selected drafts in chronological order
  const selectedDrafts = await getDraftsByIds(selectedIds);
  const postText = selectedDrafts.map(d => d.text).join('\n\n');
  const charCount = postText.length;

  // Create draft post
  const user = await getUser(userId);
  const post = await createDraftPost(user.id, postText, selectedIds);

  // Store pending post in Redis
  await redis.set(`pending_post:${user.id}`, post.id.toString(), 86400);

  // Show preview
  const preview = postText.substring(0, 500) + (postText.length > 500 ? '...' : '');
  const message = `📄 Предпросмотр поста (${charCount} знаков):\n\n${preview}\n\n─────\nОпубликовать: /post`;

  ctx.session.combineStep = null;
  ctx.session.combineAvailableDrafts = null;
  await ctx.reply(message);
}
