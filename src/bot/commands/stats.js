import { getUser, isUserSetup } from '../../db/models/user.js';
import { getTodayStats, getStatsForPeriod } from '../../db/models/dailyStats.js';

export async function statsCommand(ctx) {
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
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Get today stats
  const todayStats = await getTodayStats(user.id);

  // Get this week stats (last 7 days)
  const weekEndDate = new Date(today);
  weekEndDate.setDate(weekEndDate.getDate() - 1);
  const weekStartDate = new Date(weekEndDate);
  weekStartDate.setDate(weekStartDate.getDate() - 6);
  const thisWeekStats = await getStatsForPeriod(
    user.id,
    weekStartDate.toISOString().slice(0, 10),
    weekEndDate.toISOString().slice(0, 10)
  );

  // Get last week stats
  const lastWeekStartDate = new Date(weekStartDate);
  lastWeekStartDate.setDate(lastWeekStartDate.getDate() - 7);
  const lastWeekEndDate = new Date(lastWeekStartDate);
  lastWeekEndDate.setDate(lastWeekEndDate.getDate() + 6);
  const lastWeekStats = await getStatsForPeriod(
    user.id,
    lastWeekStartDate.toISOString().slice(0, 10),
    lastWeekEndDate.toISOString().slice(0, 10)
  );

  // Get this month stats
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today);
  const thisMonthStats = await getStatsForPeriod(
    user.id,
    monthStart.toISOString().slice(0, 10),
    monthEnd.toISOString().slice(0, 10)
  );

  // Get last month stats
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const lastMonthStats = await getStatsForPeriod(
    user.id,
    lastMonthStart.toISOString().slice(0, 10),
    lastMonthEnd.toISOString().slice(0, 10)
  );

  // Calculate dynamics
  const weekDynamic = thisWeekStats.chars > 0
    ? Math.round((thisWeekStats.chars / Math.max(lastWeekStats.chars, 1)) * 100 - 100)
    : 0;
  const monthDynamic = thisMonthStats.chars > 0
    ? Math.round((thisMonthStats.chars / Math.max(lastMonthStats.chars, 1)) * 100 - 100)
    : 0;

  const weekDynamicStr = weekDynamic > 0 ? `▲ ${weekDynamic}%` : `▼ ${Math.abs(weekDynamic)}%`;
  const monthDynamicStr = monthDynamic > 0 ? `▲ ${monthDynamic}%` : `▼ ${Math.abs(monthDynamic)}%`;

  const todayRow = todayStats
    ? `${todayStats.chars_written} зн. · ${todayStats.drafts_count} черновика · ${todayStats.posts_published} постов`
    : '0 зн. · 0 черновиков · 0 постов';

  const message = `📊 Статистика

Сегодня: ${todayRow}

Эта неделя:    ${thisWeekStats.chars} зн. · ${thisWeekStats.drafts} черновиков · ${thisWeekStats.posts} постов
Прошлая неделя: ${lastWeekStats.chars} зн. · ${lastWeekStats.drafts} черновиков · ${lastWeekStats.posts} постов
Динамика знаков: ${weekDynamicStr}

Этот месяц:    ${thisMonthStats.chars} зн. · ${thisMonthStats.drafts} черновиков · ${thisMonthStats.posts} постов
Прошлый месяц: ${lastMonthStats.chars} зн. · ${lastMonthStats.drafts} черновиков · ${lastMonthStats.posts} постов
Динамика знаков: ${monthDynamicStr}`;

  await ctx.reply(message);
}
