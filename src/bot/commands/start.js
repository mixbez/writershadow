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
  ctx.session.setupStep = 'channel';
  await ctx.reply(
    'Привет! Я WriterShadow — помогаю писать регулярно. Давай настроим.\n\n' +
    'Напиши @username канала или перешли любое сообщение из канала, где публикуешь посты.'
  );
}
