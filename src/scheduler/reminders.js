import cron from 'node-cron';
import { bot } from '../bot/index.js';
import { query } from '../db/index.js';
import { getTodayStats, getStatsForPeriod } from '../db/models/dailyStats.js';
import { redis } from '../redis/client.js';
import { generateSuggestion } from '../ai/provider.js';
import { getRecentPublishedPosts } from '../db/models/post.js';

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

function roundToFiveMinutes(timeStr) {
  // Accepts "HH:MM" or "HH:MM:SS", rounds minutes to nearest 5-min slot
  const [hh, mm] = timeStr.split(':').map(Number);
  const slot = Math.floor(mm / 5) * 5;
  return `${String(hh).padStart(2, '0')}:${String(slot).padStart(2, '0')}`;
}

async function checkReminders() {
  try {
    const { rows: users } = await query(`
      SELECT * FROM users
      WHERE is_active = TRUE AND reminder_enabled = TRUE
      AND blog_channel_id IS NOT NULL
    `);

    console.log(`[Reminder] Found ${users.length} user(s) with reminders enabled`);
    if (users.length === 0) return;

    const today = new Date().toISOString().slice(0, 10);

    for (const user of users) {
      const currentSlot = getUserLocalTime(user.timezone);
      if (!currentSlot) {
        console.warn(`[Reminder] Invalid timezone "${user.timezone}" for user ${user.id}`);
        continue;
      }

      const reminderSlot = roundToFiveMinutes(user.reminder_time);
      console.log(`[Reminder] user ${user.id}: currentSlot=${currentSlot} reminderSlot=${reminderSlot} tz=${user.timezone}`);

      if (currentSlot === reminderSlot) {
        const lockKey = `reminder:${user.id}:${today}`;
        const sent = await redis.get(lockKey);
        if (!sent) {
          console.log(`[Reminder] Lock acquired for user ${user.id}, calling sendDailyReminder`);
          await redis.set(lockKey, '1', 86400);
          await sendDailyReminder(user);
        } else {
          console.log(`[Reminder] Already sent for user ${user.id} today (lock exists)`);
        }
      }

      // Evening nudge (separate block — doesn't skip with continue)
      if (user.evening_nudge_enabled) {
        const nudgeSlot = roundToFiveMinutes(user.evening_nudge_time);
        if (currentSlot === nudgeSlot) {
          const nudgeLock = `nudge:${user.id}:${today}`;
          const nudgeSent = await redis.get(nudgeLock);
          if (!nudgeSent) {
            const stats = await getTodayStats(user.id);
            if (!stats || stats.chars_written === 0) {
              await redis.set(nudgeLock, '1', 86400);
              await sendNudge(user);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Reminder check error:', err);
  }
}

async function sendDailyReminder(user) {
  try {
    console.log(`[Reminder] Starting reminder for user ${user.id}, provider: ${user.ai_provider}`);

    const stats = await getTodayStats(user.id);
    let text = '✍️ Время писать!\n\n';
    if (stats?.chars_written > 0) {
      text += `Уже написано сегодня: ${stats.chars_written} зн. · ${stats.drafts_count} черновика`;
    } else {
      text += 'Сегодня ещё ничего не написано. Начни с одного предложения.';
    }

    // Add AI suggestion or prompt to set up AI
    if (user.ai_provider !== 'none') {
      console.log(`[Reminder] AI enabled for user ${user.id}, fetching posts...`);
      // User has AI configured
      try {
        const posts = await getRecentPublishedPosts(user.id, 15);
        console.log(`[Reminder] Got ${posts.length} posts for user ${user.id}`);
        if (posts.length >= 3) {
          console.log(`[Reminder] Generating suggestion for user ${user.id}...`);
          const suggestion = await generateSuggestion(posts, user);
          text += `\n\n💡 Идея для поста:\n${suggestion}\n\n📝 Напиши черновик: /new`;
          console.log(`[Reminder] Suggestion generated for user ${user.id}`);
        }
      } catch (err) {
        console.warn(`[Reminder] Failed to generate suggestion for user ${user.id}:`, err.message);
        // Don't include suggestion if generation fails, just send base message
      }
    } else {
      // AI not configured
      text += '\n\nЕсли нет идей о чем писать, настрой AI-ассистента, чтобы он подсказал новую тему, основываясь на твоих имеющихся текстах: /setai';
    }

    console.log(`[Reminder] Sending message to user ${user.id} (tg: ${user.telegram_user_id})`);
    await bot.telegram.sendMessage(user.telegram_user_id, text);
    console.log(`[Reminder] Reminder sent to user ${user.id} (tg: ${user.telegram_user_id})`);
  } catch (err) {
    console.error(`[Reminder] Reminder failed for user ${user.id} (tg: ${user.telegram_user_id}):`, err.message, err.stack);
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
      await redis.set(lockKey, '1', 86400);

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
