import { getUser, isUserSetup } from '../../db/models/user.js';
import { getRecentPublishedPosts } from '../../db/models/post.js';
import { generateAsk } from '../../ai/provider.js';

export async function askCommand(ctx) {
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

  // Check if user has AI configured
  if (!user.ai_provider || user.ai_provider === 'none') {
    await ctx.reply('Сначала настрой AI-ассистента: /setai');
    return;
  }

  // Send status message
  const statusMsg = await ctx.reply('⏳ Читаю твои тексты...');

  try {
    const posts = await getRecentPublishedPosts(user.id, 15);

    if (posts.length < 3) {
      await ctx.telegram.editMessageText(
        userId,
        statusMsg.message_id,
        undefined,
        'Мало постов для анализа (нужно минимум 3).\n\nИз-за технических ограничений мне недоступна история канала напрямую, но ты можешь экспортировать её сам:\n\n1. Открой свой канал в Telegram Desktop\n2. Меню → Экспорт истории чата\n3. Формат: JSON, снять галочки с медиафайлов\n4. Отправь мне файл result.json в этот чат\n\nПосле этого /ask будет работать.'
      );
      return;
    }

    // Generate questions
    const questions = await generateAsk(posts, user);

    await ctx.telegram.editMessageText(
      userId,
      statusMsg.message_id,
      undefined,
      `🤔 Вопросы от любопытного читателя:\n\n${questions}`
    );
  } catch (err) {
    console.error('Ask error:', err);
    await ctx.telegram.editMessageText(
      userId,
      statusMsg.message_id,
      undefined,
      `Ошибка при генерации вопросов: ${err.message}`
    );
  }
}
