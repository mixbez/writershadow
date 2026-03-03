import { createOrGetUser, updateUser, isUserSetup } from '../../db/models/user.js';

export async function startCommand(ctx) {
  const userId = ctx.from.id;
  const username = ctx.from.username;

  // Create or get user
  await createOrGetUser(userId, username);

  // Check if already setup
  const setup = await isUserSetup(userId);
  if (setup) {
    await ctx.reply('Ты уже настроен. Используй /settings для изменений.');
    return;
  }

  // Initialize setup session
  if (!ctx.session) ctx.session = {};
  ctx.session.setupStep = 'channel';
  await ctx.reply(
    'Привет! Я WriterShadow — помогаю писать регулярно. Давай настроим.\n\n' +
    '1️⃣ Добавь меня как администратора в канал, где публикуешь посты (нужно право «Публикация сообщений»).\n\n' +
    'Затем напиши @username этого канала или перешли из него любое сообщение.\n\n' +
    'По умолчанию:\n' +
    '• Ежедневное напоминание: 09:00 (Europe/Moscow)\n' +
    '• Вечерний пинок: включен\n' +
    '• Еженедельная сводка: включена'
  );
}
