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

export async function getCommandStats(dateFrom, dateTo) {
  const result = await query(`
    SELECT
      command,
      COUNT(*) as total_calls,
      COUNT(DISTINCT telegram_user_id) as unique_users,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
      MAX(created_at) as last_called
    FROM command_logs
    WHERE created_at >= $1 AND created_at <= $2
    GROUP BY command
    ORDER BY total_calls DESC
  `, [dateFrom, dateTo]);

  return result.rows.map(row => ({
    command: row.command,
    total_calls: parseInt(row.total_calls, 10),
    unique_users: parseInt(row.unique_users, 10),
    error_count: parseInt(row.error_count, 10),
    error_rate: parseFloat(((parseInt(row.error_count, 10) / parseInt(row.total_calls, 10)) * 100).toFixed(2)),
    last_called: row.last_called
  }));
}

export async function getDailyActiveUsers(dateFrom, dateTo) {
  const result = await query(`
    SELECT
      DATE(created_at) as date,
      COUNT(DISTINCT telegram_user_id) as active_users,
      COUNT(DISTINCT command) as unique_commands,
      COUNT(*) as total_calls
    FROM command_logs
    WHERE created_at >= $1 AND created_at <= $2
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `, [dateFrom, dateTo]);

  return result.rows.map(row => ({
    date: row.date.toISOString().split('T')[0],
    active_users: parseInt(row.active_users, 10),
    unique_commands: parseInt(row.unique_commands, 10),
    total_calls: parseInt(row.total_calls, 10)
  }));
}

export async function getRecentLogs(limit = 100) {
  const result = await query(`
    SELECT
      id,
      telegram_user_id,
      username,
      command,
      status,
      error_message,
      created_at
    FROM command_logs
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);

  return result.rows.map(row => ({
    id: row.id,
    telegram_user_id: row.telegram_user_id,
    username: row.username,
    command: row.command,
    status: row.status,
    error_message: row.error_message,
    created_at: row.created_at
  }));
}

export async function getConversionFunnel(dateFrom, dateTo) {
  const result = await query(`
    SELECT
      COUNT(DISTINCT CASE WHEN command IN ('start', 'settings') THEN telegram_user_id END) as registered,
      COUNT(DISTINCT CASE WHEN command = 'new' THEN telegram_user_id END) as wrote_draft,
      COUNT(DISTINCT CASE WHEN command = 'combine' THEN telegram_user_id END) as combined,
      COUNT(DISTINCT CASE WHEN command = 'post' THEN telegram_user_id END) as published
    FROM command_logs
    WHERE created_at >= $1 AND created_at <= $2
  `, [dateFrom, dateTo]);

  const row = result.rows[0];
  return {
    registered: parseInt(row.registered || 0, 10),
    wrote_draft: parseInt(row.wrote_draft || 0, 10),
    combined: parseInt(row.combined || 0, 10),
    published: parseInt(row.published || 0, 10)
  };
}

export async function getTopUsers(dateFrom, dateTo, limit = 20) {
  const result = await query(`
    SELECT
      telegram_user_id,
      username,
      COUNT(*) as total_commands,
      COUNT(DISTINCT command) as unique_commands,
      COUNT(DISTINCT DATE(created_at)) as active_days,
      MAX(created_at) as last_active
    FROM command_logs
    WHERE created_at >= $1 AND created_at <= $2
    GROUP BY telegram_user_id, username
    ORDER BY total_commands DESC
    LIMIT $3
  `, [dateFrom, dateTo, limit]);

  return result.rows.map(row => ({
    telegram_user_id: row.telegram_user_id,
    username: row.username,
    total_commands: parseInt(row.total_commands, 10),
    unique_commands: parseInt(row.unique_commands, 10),
    active_days: parseInt(row.active_days, 10),
    last_active: row.last_active
  }));
}
