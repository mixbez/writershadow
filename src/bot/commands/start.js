import { createOrGetUser, updateUser, isUserSetup } from '../../db/models/user.js';

export async function startCommand(ctx) {
  const userId = ctx.from.id;
  const username = ctx.from.username;

  console.log(`[START] User ${userId} (${username}) called /start`);

  try {
    // Create or get user
    await createOrGetUser(userId, username);
    console.log(`[START] User created/got for ${userId}`);

    // Check if already setup
    const setup = await isUserSetup(userId);
    if (setup) {
      console.log(`[START] User ${userId} already setup`);
      await ctx.reply('Ты уже настроен.\n\nКоманды:\n• /info — полный список команд и советы\n• /settings — изменить настройки');
      return;
    }

    // Initialize setup session
    ctx.session.setupStep = 'channel';
    console.log(`[START] Starting setup for user ${userId}`);
    await ctx.reply(
      'Привет! Я WriterShadow — помогаю писать регулярно.\n\n' +
      'Напиши @username канала или перешли сообщение из канала, где публикуешь посты.'
    );
    console.log(`[START] Reply sent to user ${userId}`);
  } catch (err) {
    console.error(`[START] Error for user ${userId}:`, err.message);
    await ctx.reply('Ошибка при инициализации. Попробуй позже.');
  }
}
