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

  // Check AI provider
  if (user.ai_provider === 'none') {
    await ctx.reply('Сначала настрой AI-ассистента: /setai');
    return;
  }

  // Check paid subscription if needed
  if (user.ai_provider === 'paid') {
    if (user.subscription_status !== 'active' || !user.subscription_expires_at) {
      await ctx.reply('Подписка не активна. /subscribe');
      return;
    }
    const expiresAt = new Date(user.subscription_expires_at);
    if (expiresAt < new Date()) {
      await ctx.reply('Подписка истекла. /subscribe');
      return;
    }
  }

  // Send status message
  const statusMsg = await ctx.reply('⏳ Анализирую твои тексты...');

  try {
    // Get recent published posts
    const posts = await getRecentPublishedPosts(user.id, 15);

    // Check minimum
    if (posts.length < 3) {
      await ctx.editMessageText(statusMsg.message_id,
        'Пока мало публикаций (нужно минимум 3). Напиши и опубликуй несколько постов.',
        { chat_id: userId }
      );
      return;
    }

    // Generate suggestion
    const suggestion = await generateSuggestion(posts, user);

    await ctx.editMessageText(statusMsg.message_id,
      `💡 Идея для следующего поста:\n\n${suggestion}`,
      { chat_id: userId }
    );
  } catch (err) {
    console.error('Suggestion error:', err);
    await ctx.editMessageText(statusMsg.message_id,
      `Ошибка при генерации идеи: ${err.message}`,
      { chat_id: userId }
    );
  }
}
