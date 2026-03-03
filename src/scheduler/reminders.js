import cron from 'node-cron';
import { bot } from '../bot/index.js';
import { query } from '../db/index.js';
import { getTodayStats, getStatsForPeriod } from '../db/models/dailyStats.js';
import { redis } from '../redis/client.js';

export function startScheduler() {
  // Every 5 minutes: daily reminders + evening nudge
  cron.schedule('*/5 * * * *', () => checkReminders());

  // Every 5 minutes on Mondays: weekly summary
  cron.schedule('*/5 * * * 1', () => checkWeeklySummary());

  // Every hour: check for expired subscriptions
  cron.schedule('0 * * * *', () => expireSubscriptions());

  console.log('Scheduler started');
}

function getUserLocalTime(timezone) {
  try {
    const now = new Date();
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    const [hh, mm] = formatted.split(':').map(Number);
    const slot = Math.floor(mm / 5) * 5;
    return `${String(hh).padStart(2, '0')}:${String(slot).padStart(2, '0')}`;
  } catch {
    return null; // invalid timezone — skip this user
  }
}

async function checkReminders() {
  try {
    const { rows: users } = await query(`
      SELECT * FROM users
      WHERE is_active = TRUE AND reminder_enabled = TRUE
      AND blog_channel_id IS NOT NULL AND draft_group_id IS NOT NULL
    `);

    const today = new Date().toISOString().slice(0, 10);

    for (const user of users) {
      const currentSlot = getUserLocalTime(user.timezone);
      if (!currentSlot) continue; // invalid timezone in DB
      const reminderSlot = user.reminder_time.slice(0, 5);

      if (currentSlot === reminderSlot) {
        const lockKey = `reminder:${user.id}:${today}`;
        const sent = await redis.get(lockKey);
        if (sent) continue;
        await redis.set(lockKey, '1', { EX: 86400 });
        await sendDailyReminder(user);
      }

      // Evening nudge
      if (user.evening_nudge_enabled) {
        const nudgeSlot = user.evening_nudge_time.slice(0, 5);
        if (currentSlot === nudgeSlot) {
          const nudgeLock = `nudge:${user.id}:${today}`;
          const nudgeSent = await redis.get(nudgeLock);
          if (nudgeSent) continue;
          const stats = await getTodayStats(user.id);
          if (!stats || stats.chars_written === 0) {
            await redis.set(nudgeLock, '1', { EX: 86400 });
            await sendNudge(user);
          }
        }
      }
    }
  } catch (err) {
    console.error('Reminder check error:', err);
  }
}

async function sendDailyReminder(user) {
  const stats = await getTodayStats(user.id);
  let text = '✍️ Время писать!\n\n';
  if (stats?.chars_written > 0) {
    text += `Уже написано сегодня: ${stats.chars_written} зн. · ${stats.drafts_count} черновика`;
  } else {
    text += 'Сегодня ещё ничего не написано. Начни с одного предложения.';
  }
  try {
    await bot.telegram.sendMessage(user.telegram_user_id, text);
  } catch (err) {
    console.error(`Reminder failed for ${user.telegram_user_id}:`, err.message);
  }
}

async function sendNudge(user) {
  try {
    await bot.telegram.sendMessage(
      user.telegram_user_id,
      '🌙 Вечер, а слов ещё нет. Одно предложение — уже победа.'
    );
  } catch (err) {
    console.error(`Nudge failed for ${user.telegram_user_id}:`, err.message);
  }
}

async function checkWeeklySummary() {
  try {
    const { rows: users } = await query(`
      SELECT * FROM users
      WHERE is_active = TRUE AND weekly_summary_enabled = TRUE
    `);

    const today = new Date().toISOString().slice(0, 10);

    for (const user of users) {
      // Check if it's Monday at 10:00 in user's timezone
      const localTime = getUserLocalTime(user.timezone);
      if (localTime !== '10:00') continue;

      const localDay = new Intl.DateTimeFormat('en-GB', {
        timeZone: user.timezone,
        weekday: 'short',
      }).format(new Date());
      if (localDay !== 'Mon') continue;

      const lockKey = `weekly:${user.id}:${today}`;
      const sent = await redis.get(lockKey);
      if (sent) continue;
      await redis.set(lockKey, '1', { EX: 86400 });

      // Get stats for last 7 days (excluding today)
      const end = new Date();
      end.setDate(end.getDate() - 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      const stats = await getStatsForPeriod(
        user.id,
        start.toISOString().slice(0, 10),
        end.toISOString().slice(0, 10)
      );

      const text =
        `📅 Итоги недели\n\n` +
        `Знаков написано: ${stats.chars || 0}\n` +
        `Черновиков: ${stats.drafts || 0}\n` +
        `Постов опубликовано: ${stats.posts || 0}`;

      try {
        await bot.telegram.sendMessage(user.telegram_user_id, text);
      } catch (err) {
        console.error(`Weekly summary failed for ${user.telegram_user_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Weekly summary check error:', err);
  }
}

async function expireSubscriptions() {
  try {
    await query(`
      UPDATE users
      SET subscription_status = 'expired', ai_provider = 'none'
      WHERE subscription_status = 'active'
      AND subscription_expires_at < NOW()
    `);
  } catch (err) {
    console.error('Subscription expiry check error:', err);
  }
}
