import { getUser, isUserSetup, updateUser } from '../../db/models/user.js';

export async function settingsCommand(ctx) {
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

  const text = `⚙️ Настройки WriterShadow

Канал: ${user.blog_channel_id || 'не настроен'}
Группа черновиков: ${user.draft_group_id || 'не настроена'}

── Напоминания ──
Ежедневное: ${user.reminder_time} ${user.timezone}
Вечерний пинок: ${user.evening_nudge_enabled ? 'Вкл' : 'Выкл'}
Еженедельная сводка: ${user.weekly_summary_enabled ? 'Вкл' : 'Выкл'}`;

  const buttons = [
    [{ text: 'Изменить время напоминания', callback_data: 'settings_time' }],
    [
      { text: `Вечерний пинок: ${user.evening_nudge_enabled ? 'Вкл' : 'Выкл'}`, callback_data: 'toggle_evening_nudge' },
    ],
    [
      { text: `Еженедельная сводка: ${user.weekly_summary_enabled ? 'Вкл' : 'Выкл'}`, callback_data: 'toggle_weekly_summary' },
    ],
    [{ text: 'Изменить канал / группу', callback_data: 'settings_reconfigure' }],
  ];

  await ctx.reply(text, {
    reply_markup: {
      inline_keyboard: buttons,
    },
  });
}

export async function handleSettingsCallback(ctx, action) {
  const userId = ctx.from.id;

  if (action === 'time') {
    ctx.session.settingsStep = 'time';
    await ctx.editMessageText('Введи время в формате HH:MM (например: 09:00)');
  } else if (action === 'reconfigure') {
    ctx.session.setupStep = 'channel';
    await ctx.editMessageText(
      'Давай переделаем настройку.\n\n' +
      'Напиши @username канала или перешли любое сообщение из канала, где публикуешь посты.'
    );
  }
}

export async function handleSettingsTimeInput(ctx, text) {
  const userId = ctx.from.id;
  const match = text.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    await ctx.reply('Введи время в формате HH:MM (например: 09:00)');
    return;
  }

  ctx.session.pendingReminderTime = text;
  ctx.session.settingsStep = 'timezone';
  await ctx.reply('Твой часовой пояс? (например: Europe/Moscow, или пришли геолокацию)');
}

export async function handleSettingsTimezoneInput(ctx, text) {
  const userId = ctx.from.id;
  const reminderTime = ctx.session.pendingReminderTime;

  if (!reminderTime) {
    await ctx.reply('Что-то пошло не так. Используй /settings чтобы переделать.');
    ctx.session.settingsStep = null;
    return;
  }

  const timezone = text.trim() || 'Europe/Moscow';

  await updateUser(userId, {
    reminder_time: reminderTime,
    timezone,
  });

  ctx.session.settingsStep = null;
  ctx.session.pendingReminderTime = null;
  await ctx.reply(`Настройки сохранены! Напоминание: каждый день в ${reminderTime} (${timezone}).`);
}
