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

  const isProActive = user?.subscription_status === 'active' ||
                      (user?.demo_expires_at && new Date(user.demo_expires_at) > new Date());

  const text = `🤖 AI-ассистент

Текущий провайдер: ${currentProvider}
${isProActive ? '✅ Pro режим включен (Claude)' : '📌 Базовый режим (Groq)'}

Выбери режим:`;

  await ctx.reply(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Groq — всегда бесплатно', callback_data: 'setai_groq' }],
        [{ text: 'WriterShadow Pro — 9€/мес (Claude)', callback_data: 'setai_paid' }],
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
    await ctx.telegram.editMessageText(userId, ctx.callbackQuery.message.message_id, undefined, 'AI-ассистент отключён.');
    return;
  }

  if (provider === 'paid') {
    await ctx.telegram.editMessageText(userId, ctx.callbackQuery.message.message_id, undefined, 'Подписка WriterShadow Pro', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Перейти к подписке', callback_data: 'subscribe' }],
        ],
      },
    });
    return;
  }

  if (provider === 'groq') {
    // Groq uses public key - no need to enter anything
    await updateUser(userId, {
      ai_provider: 'groq',
      ai_key_encrypted: null,
    });
    await ctx.telegram.editMessageText(userId, ctx.callbackQuery.message.message_id, undefined,
      '✅ Groq активирован!\n\nТы получаешь бесплатный доступ к AI (Groq).\n\nДоступные функции:\n• AI-теги для постов\n• Связки между черновиками\n• Рекомендации для постов (в Pro)'
    );
    ctx.session.aiSetupProvider = null;
    ctx.session.aiSetupStep = null;
    return;
  }
}

export async function handleAiKeyInput(ctx, text) {
  // Keys are no longer accepted - all users get public Groq key
  await ctx.reply('Пользовательские ключи больше не принимаются.\n\nТеперь все используют общий Groq (бесплатно) или переходят на WriterShadow Pro с Claude.\n\nПиши /setai для выбора режима.');
  ctx.session.aiSetupProvider = null;
  ctx.session.aiSetupStep = null;
}
