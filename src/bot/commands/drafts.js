import { getUser, isUserSetup } from '../../db/models/user.js';
import { getUnusedDrafts, getUnusedDraftsByTag } from '../../db/models/draft.js';
import { splitText } from '../../utils/splitText.js';

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

  // Parse tag argument: /drafts tagname
  const args = ctx.message.text.split(' ').slice(1).join(' ').trim();
  let drafts;

  if (args) {
    drafts = await getUnusedDraftsByTag(user.id, args);
    if (drafts.length === 0) {
      await ctx.reply(`Черновиков с тегом «${args}» не найдено.`);
      return;
    }
  } else {
    drafts = await getUnusedDrafts(user.id);
    if (drafts.length === 0) {
      await ctx.reply('Черновиков нет. Используй /new чтобы написать черновик.');
      return;
    }
  }

  // Format drafts list (last 20)
  const recentDrafts = drafts.slice(0, 20);
  const totalChars = drafts.reduce((sum, d) => sum + d.char_count, 0);

  let title = args ? `📝 Черновики с тегом «${args}»` : '📝 Черновики';
  let draftsList = `${title} (последние 20):\n\n`;
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
  draftsList += 'Собери пост: /combine';

  await ctx.reply(draftsList);
}

export async function draftsfullCommand(ctx) {
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
    await ctx.reply('Черновиков нет. Используй /new чтобы написать черновик.');
    return;
  }

  // Show full text for each draft, split if needed
  const recentDrafts = drafts.slice(0, 20);

  for (let i = 0; i < recentDrafts.length; i++) {
    const draft = recentDrafts[i];
    const date = new Date(draft.created_at);
    const dateStr = date.toLocaleDateString('ru-RU', { month: '2-digit', day: '2-digit' });
    const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false });

    const header = `📝 Черновик ${i + 1} из ${recentDrafts.length}\n[${dateStr}, ${timeStr}] — ${draft.char_count} зн.\n\n`;

    // Split long text
    const textChunks = splitText(draft.text);

    // Send header + first chunk
    let firstMessage = header + textChunks[0];
    await ctx.reply(firstMessage);

    // Send remaining chunks
    for (let j = 1; j < textChunks.length; j++) {
      await ctx.reply(textChunks[j]);
    }
  }
}
