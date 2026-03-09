import { getUser, isUserSetup } from '../../db/models/user.js';
import { importPostsForUser } from '../../db/models/post.js';

// Extracts plain text from Telegram JSON export message.text
// Can be a string or an array of text entities
function extractText(raw) {
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw)) {
    return raw
      .map((part) => (typeof part === 'string' ? part : part.text || ''))
      .join('')
      .trim();
  }
  return '';
}

export async function handleJsonImport(ctx) {
  const userId = ctx.from.id;

  const setup = await isUserSetup(userId);
  if (!setup) {
    await ctx.reply('Сначала выполни /start для настройки.');
    return;
  }

  const user = await getUser(userId);
  const doc = ctx.message.document;

  if (!doc.file_name?.endsWith('.json')) {
    await ctx.reply('Ожидаю JSON-файл (result.json из экспорта Telegram).');
    return;
  }

  // 20 MB limit — Telegram Bot API max download size
  if (doc.file_size > 20 * 1024 * 1024) {
    await ctx.reply('Файл слишком большой (лимит 20 МБ).');
    return;
  }

  const statusMsg = await ctx.reply('⏳ Обрабатываю экспорт...');

  try {
    // Download file content
    const file = await ctx.telegram.getFile(doc.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Не удалось скачать файл: ${response.status}`);

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Файл не является валидным JSON.');
    }

    if (!Array.isArray(data?.messages)) {
      throw new Error('Не похоже на экспорт Telegram (нет поля messages).');
    }

    // Extract text posts, skip service messages and empty texts
    const texts = data.messages
      .filter((m) => m.type === 'message')
      .map((m) => extractText(m.text))
      .filter((t) => t.length >= 20) // ignore very short/empty items
      .slice(-15); // take last 15

    if (texts.length === 0) {
      await ctx.telegram.editMessageText(
        userId,
        statusMsg.message_id,
        undefined,
        'В файле не нашлось текстовых постов. Убедись, что экспортируешь историю канала, а не чата.'
      );
      return;
    }

    const count = await importPostsForUser(user.id, texts);

    await ctx.telegram.editMessageText(
      userId,
      statusMsg.message_id,
      undefined,
      `✅ Импортировано ${count} постов. Теперь запусти /suggest — я проанализирую твой стиль.`
    );
  } catch (err) {
    console.error('JSON import error:', err);
    try {
      await ctx.telegram.editMessageText(
        userId,
        statusMsg.message_id,
        undefined,
        `Ошибка при импорте: ${err.message}`
      );
    } catch {
      await ctx.reply(`Ошибка при импорте: ${err.message}`);
    }
  }
}
