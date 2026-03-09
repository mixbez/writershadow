import { query } from '../index.js';

export async function logCommand(telegramUserId, command, status = 'success', errorMessage = null, data = null) {
  try {
    const result = await query(
      `INSERT INTO command_logs (telegram_user_id, command, status, error_message, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [telegramUserId, command, status, errorMessage, data ? JSON.stringify(data) : null]
    );
    return result.rows[0];
  } catch (err) {
    console.error('Error logging command:', err);
  }
}

export async function getCommandLogs(filters = {}) {
  let sql = 'SELECT * FROM command_logs WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (filters.telegramUserId) {
    sql += ` AND telegram_user_id = $${paramIndex}`;
    params.push(filters.telegramUserId);
    paramIndex++;
  }

  if (filters.command) {
    sql += ` AND command = $${paramIndex}`;
    params.push(filters.command);
    paramIndex++;
  }

  if (filters.status) {
    sql += ` AND status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  if (filters.fromDate) {
    sql += ` AND created_at >= $${paramIndex}`;
    params.push(filters.fromDate);
    paramIndex++;
  }

  if (filters.toDate) {
    sql += ` AND created_at <= $${paramIndex}`;
    params.push(filters.toDate);
    paramIndex++;
  }

  sql += ' ORDER BY created_at DESC LIMIT 1000';

  const result = await query(sql, params);
  return result.rows;
}

export async function getCommandStats() {
  const result = await query(
    `SELECT
       command,
       status,
       COUNT(*) as count,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as count_24h
     FROM command_logs
     GROUP BY command, status
     ORDER BY count DESC`
  );
  return result.rows;
}

export async function getCommandStatsByUser(telegramUserId) {
  const result = await query(
    `SELECT
       command,
       COUNT(*) as count,
       COUNT(*) FILTER (WHERE status = 'success') as success_count,
       COUNT(*) FILTER (WHERE status = 'error') as error_count,
       MAX(created_at) as last_used
     FROM command_logs
     WHERE telegram_user_id = $1
     GROUP BY command
     ORDER BY count DESC`,
    [telegramUserId]
  );
  return result.rows;
}

export async function getDashboardStats() {
  const result = await query(
    `SELECT
       COUNT(*) as total_commands,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as commands_24h,
       COUNT(*) FILTER (WHERE status = 'error') as errors_total,
       COUNT(*) FILTER (WHERE status = 'error' AND created_at >= NOW() - INTERVAL '24 hours') as errors_24h,
       COUNT(DISTINCT telegram_user_id) as unique_users
     FROM command_logs`
  );
  return result.rows[0];
}

export async function clearOldLogs(daysToKeep = 30) {
  const result = await query(
    `DELETE FROM command_logs WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'`
  );
  return result.rowCount;
}
