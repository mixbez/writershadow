import { query } from '../../db/index.js';

export async function announceCommand(ctx) {
  const userId = ctx.from.id;
  const adminId = parseInt(process.env.ADMIN_USER_ID, 10);

  // Only admin can use this
  if (userId !== adminId) {
    await ctx.reply('Эта команда доступна только администратору.');
    return;
  }

  // Only in private chat
  if (ctx.chat.type !== 'private') {
    await ctx.reply('Команда работает только в личном чате.');
    return;
  }

  // Get message text (everything after /announce)
  const text = ctx.message.text.replace(/^\/announce\s*/i, '').trim();

  if (!text) {
    await ctx.reply('Использование: /announce <сообщение>');
    return;
  }

  // Get all active users
  const result = await query(
    'SELECT DISTINCT telegram_user_id FROM users WHERE is_active = TRUE'
  );
  const users = result.rows;

  if (users.length === 0) {
    await ctx.reply('Нет активных пользователей для отправки.');
    return;
  }

  let sent = 0;
  let failed = 0;

  // Send message to all users
  for (const user of users) {
    try {
      await ctx.telegram.sendMessage(user.telegram_user_id, text);
      sent++;
    } catch (err) {
      console.error(`Failed to send announce to ${user.telegram_user_id}:`, err.message);
      failed++;
    }
  }

  await ctx.reply(`✅ Объявление отправлено.\n\nУспешно: ${sent}\nОшибок: ${failed}`);
}
