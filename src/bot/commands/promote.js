import { getUser, isUserSetup, updateUser, updateChannelMemberCount, getSimilarPromoteUsers } from '../../db/models/user.js';

export async function promoteCommand(ctx) {
  const userId = ctx.from.id;

  if (ctx.chat.type !== 'private') {
    await ctx.reply('Эта команда доступна только в личном чате.');
    return;
  }

  const setup = await isUserSetup(userId);
  if (!setup) {
    await ctx.reply('Сначала выполни /start для настройки каналов.');
    return;
  }

  const arg = ctx.message.text.split(' ')[1]?.toLowerCase();

  // /promote off
  if (arg === 'off') {
    await updateUser(userId, { promote_enabled: false });
    await ctx.reply('Ты скрыт из пула взаимопиара.');
    return;
  }

  let user = await getUser(userId);

  // Ensure we have a fresh member count
  if (user.channel_member_count == null) {
    try {
      const count = await ctx.telegram.getChatMembersCount(user.blog_channel_id);
      await updateChannelMemberCount(user.id, count);
      user = await getUser(userId);
    } catch (err) {
      // proceed with null
    }
  }

  // Enable promote
  await updateUser(userId, { promote_enabled: true });

  // Find similar authors
  const similar = await getSimilarPromoteUsers(user.id, user.channel_member_count);

  const myCount = user.channel_member_count != null
    ? ` (${user.channel_member_count} подп.)`
    : '';

  let reply = `✅ Ты добавлен в пул взаимопиара${myCount}.\n\n`;
  reply += '/promote off — чтобы скрыться.\n\n';

  if (similar.length === 0) {
    reply += 'Пока нет других авторов в пуле. Возвращайся позже.';
  } else {
    reply += 'Похожие авторы:\n\n';
    for (const u of similar) {
      const count = u.channel_member_count != null ? ` — ${u.channel_member_count} подп.` : '';
      reply += `@${u.username}${count}\n`;
    }
  }

  await ctx.reply(reply);
}
