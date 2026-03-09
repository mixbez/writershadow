import { getUser, isUserSetup } from '../../db/models/user.js';
import { getRecentPublishedPosts } from '../../db/models/post.js';
import { generateSuggestion } from '../../ai/provider.js';

export async function suggestCommand(ctx) {
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

  // Check if user has Pro access (paid subscription OR active demo)
  const isPro = user?.subscription_status === 'active' ||
                (user?.demo_expires_at && new Date(user.demo_expires_at) > new Date());

  if (!isPro) {
    await ctx.reply('Команда /suggest доступна только для WriterShadow Pro.\n\nПри подписке тебе открывается Claude для генерации идей.\n\nПиши /subscribe');
    return;
  }

  // Check if user has AI configured
  if (!user.ai_provider || user.ai_provider === 'none') {
    await ctx.reply('Сначала настрой AI-ассистента: /setai');
    return;
  }

  // Send status message
  const statusMsg = await ctx.reply('⏳ Анализирую твои тексты...');

  try {
    // Get recent published posts
    const posts = await getRecentPublishedPosts(user.id, 15);

    // Check minimum
    if (posts.length < 3) {
      await ctx.telegram.editMessageText(
        userId,
        statusMsg.message_id,
        undefined,
        'Пока мало публикаций (нужно минимум 3). Напиши и опубликуй несколько постов.'
      );
      return;
    }

    // Generate suggestion
    const suggestion = await generateSuggestion(posts, user);

    await ctx.telegram.editMessageText(
      userId,
      statusMsg.message_id,
      undefined,
      `💡 Идея для следующего поста:\n\n${suggestion}`
    );
  } catch (err) {
    console.error('Suggestion error:', err);
    await ctx.telegram.editMessageText(
      userId,
      statusMsg.message_id,
      undefined,
      `Ошибка при генерации идеи: ${err.message}`
    );
  }
}
