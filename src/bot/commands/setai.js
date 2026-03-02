import { getUser, updateUser } from '../../db/models/user.js';
import { encryptKey } from '../../crypto/keys.js';

export async function setaiCommand(ctx) {
  const userId = ctx.from.id;

  // Only in private chat
  if (ctx.chat.type !== 'private') {
    await ctx.reply('Эта команда доступна только в личном чате.');
    return;
  }

  const user = await getUser(userId);
  const currentProvider = user?.ai_provider || 'не настроен';

  const text = `🤖 AI-ассистент

Текущий провайдер: ${currentProvider}

Выбери режим:`;

  await ctx.reply(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Groq — бесплатно', callback_data: 'setai_groq' }],
        [{ text: 'Anthropic — свой ключ', callback_data: 'setai_anthropic' }],
        [{ text: 'WriterShadow Pro — 9€/мес', callback_data: 'setai_paid' }],
        [{ text: 'Отключить AI', callback_data: 'setai_none' }],
      ],
    },
  });
}

export async function handleSetAiProvider(ctx, provider) {
  const userId = ctx.from.id;

  if (provider === 'none') {
    await updateUser(userId, {
      ai_provider: 'none',
      ai_key_encrypted: null,
    });
    await ctx.editMessageText('AI-ассистент отключён.');
    return;
  }

  if (provider === 'paid') {
    await ctx.editMessageText('Подписка WriterShadow Pro', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Перейти к подписке', callback_data: 'subscribe' }],
        ],
      },
    });
    return;
  }

  if (provider === 'groq') {
    await ctx.editMessageText(
      'Groq предоставляет бесплатный API для языковых моделей.\n\n' +
      '1. Зайди на console.groq.com/keys\n' +
      '2. Создай API key\n' +
      '3. Пришли его сюда:'
    );
    ctx.session.aiSetupProvider = 'groq';
    ctx.session.aiSetupStep = 'key';
    return;
  }

  if (provider === 'anthropic') {
    await ctx.editMessageText(
      'Anthropic — создатель Claude. Ключ на console.anthropic.com\n\n' +
      '1. Зайди на console.anthropic.com\n' +
      '2. Создай API key в разделе API Keys\n' +
      '3. Пришли его сюда:'
    );
    ctx.session.aiSetupProvider = 'anthropic';
    ctx.session.aiSetupStep = 'key';
    return;
  }
}

export async function handleAiKeyInput(ctx, text) {
  const userId = ctx.from.id;
  const provider = ctx.session.aiSetupProvider;

  if (!provider) {
    await ctx.reply('Сначала выбери провайдер через /setai');
    return;
  }

  // Validate key format
  let isValid = false;
  if (provider === 'groq' && text.startsWith('gsk_')) {
    isValid = true;
  } else if (provider === 'anthropic' && text.startsWith('sk-ant-')) {
    isValid = true;
  }

  if (!isValid) {
    await ctx.reply(`Ключ ${provider} должен начинаться с ${provider === 'groq' ? 'gsk_' : 'sk-ant-'}`);
    return;
  }

  // Encrypt and store
  const encrypted = encryptKey(text);
  await updateUser(userId, {
    ai_provider: provider,
    ai_key_encrypted: encrypted,
  });

  // Delete the message with the key for security
  try {
    await ctx.deleteMessage(ctx.message.message_id);
  } catch (err) {
    // Ignore if can't delete
  }

  ctx.session.aiSetupProvider = null;
  ctx.session.aiSetupStep = null;
  await ctx.reply(`Готово! Теперь /suggest будет использовать ${provider === 'groq' ? 'Groq (бесплатно)' : 'Anthropic'}.`);
}
