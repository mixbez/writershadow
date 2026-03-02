import { getUser } from '../../db/models/user.js';

export async function subscribeCommand(ctx) {
  const userId = ctx.from.id;

  // Only in private chat
  if (ctx.chat.type !== 'private') {
    await ctx.reply('Эта команда доступна только в личном чате.');
    return;
  }

  const user = await getUser(userId);
  const ownerContact = process.env.OWNER_CONTACT || '@writershadow';

  let statusText = 'Твой статус: не активна';
  if (user?.subscription_status === 'active' && user?.subscription_expires_at) {
    const expiresDate = new Date(user.subscription_expires_at);
    const dateStr = expiresDate.toLocaleDateString('ru-RU');
    statusText = `Твой статус: ✅ активна до ${dateStr}`;
  }

  const text = `⭐ WriterShadow Pro

AI-ассистент на базе Claude без необходимости иметь свой ключ.

Стоимость: 9€/месяц

Как подписаться:
1. Напиши ${ownerContact} с темой "WriterShadow Pro"
2. Переведи оплату по реквизитам
3. После подтверждения AI станет доступен

${statusText}`;

  await ctx.reply(text);
}
