import { query } from '../index.js';

export async function upsertDailyStats(userId, date, updates = {}) {
  const result = await query(
    `INSERT INTO daily_stats (user_id, date, chars_written, drafts_count, posts_published)
     VALUES ($1, $2, COALESCE($3, 0), COALESCE($4, 0), COALESCE($5, 0))
     ON CONFLICT (user_id, date) DO UPDATE
     SET chars_written = daily_stats.chars_written + COALESCE(EXCLUDED.chars_written, 0),
         drafts_count = daily_stats.drafts_count + COALESCE(EXCLUDED.drafts_count, 0),
         posts_published = daily_stats.posts_published + COALESCE(EXCLUDED.posts_published, 0)
     RETURNING *`,
    [userId, date, updates.chars_written, updates.drafts_count, updates.posts_published]
  );
  return result.rows[0];
}

export async function getTodayStats(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const result = await query(
    `SELECT * FROM daily_stats
     WHERE user_id = $1 AND date = $2`,
    [userId, today]
  );
  return result.rows[0] || null;
}

export async function getStatsForPeriod(userId, dateFrom, dateTo) {
  const result = await query(
    `SELECT SUM(chars_written) as chars, SUM(drafts_count) as drafts, SUM(posts_published) as posts
     FROM daily_stats
     WHERE user_id = $1 AND date BETWEEN $2 AND $3`,
    [userId, dateFrom, dateTo]
  );
  const row = result.rows[0];
  return {
    chars: parseInt(row.chars || 0, 10),
    drafts: parseInt(row.drafts || 0, 10),
    posts: parseInt(row.posts || 0, 10),
  };
}

export async function getStatsByDate(userId, date) {
  const result = await query(
    `SELECT * FROM daily_stats
     WHERE user_id = $1 AND date = $2`,
    [userId, date]
  );
  return result.rows[0] || null;
}

export async function getStatsRange(userId, dateFrom, dateTo) {
  const result = await query(
    `SELECT * FROM daily_stats
     WHERE user_id = $1 AND date BETWEEN $2 AND $3
     ORDER BY date DESC`,
    [userId, dateFrom, dateTo]
  );
  return result.rows;
}
