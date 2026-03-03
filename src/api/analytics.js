import { query } from '../db/index.js';

export async function getAnalyticsData(dateFrom, dateTo) {
  const result = await query(`
    SELECT
      u.id,
      u.telegram_user_id,
      u.username,
      u.blog_channel_id,
      u.draft_group_id,
      SUM(ds.chars_written) as total_chars,
      SUM(ds.drafts_count) as total_drafts,
      SUM(ds.posts_published) as total_posts,
      COUNT(DISTINCT ds.date) as active_days
    FROM users u
    LEFT JOIN daily_stats ds ON u.id = ds.user_id
      AND ds.date >= $1 AND ds.date <= $2
    WHERE u.is_active = TRUE
    GROUP BY u.id, u.telegram_user_id, u.username, u.blog_channel_id, u.draft_group_id
    ORDER BY total_chars DESC NULLS LAST
  `, [dateFrom, dateTo]);

  return result.rows;
}

export async function getDailyStats(userId, dateFrom, dateTo) {
  const result = await query(`
    SELECT
      date,
      chars_written,
      drafts_count,
      posts_published
    FROM daily_stats
    WHERE user_id = $1 AND date >= $2 AND date <= $3
    ORDER BY date ASC
  `, [userId, dateFrom, dateTo]);

  return result.rows;
}

export async function getGlobalStats(dateFrom, dateTo) {
  const result = await query(`
    SELECT
      SUM(chars_written) as total_chars,
      SUM(drafts_count) as total_drafts,
      SUM(posts_published) as total_posts,
      COUNT(DISTINCT user_id) as active_users,
      COUNT(DISTINCT date) as activity_days
    FROM daily_stats
    WHERE date >= $1 AND date <= $2
  `, [dateFrom, dateTo]);

  const row = result.rows[0];
  return {
    total_chars: parseInt(row.total_chars || 0, 10),
    total_drafts: parseInt(row.total_drafts || 0, 10),
    total_posts: parseInt(row.total_posts || 0, 10),
    active_users: parseInt(row.active_users || 0, 10),
    activity_days: parseInt(row.activity_days || 0, 10),
  };
}
