import { query } from '../index.js';

export async function createOrGetUser(telegramUserId, username) {
  const result = await query(
    `INSERT INTO users (telegram_user_id, username)
     VALUES ($1, $2)
     ON CONFLICT (telegram_user_id) DO UPDATE
     SET username = COALESCE($2, users.username)
     RETURNING *`,
    [telegramUserId, username]
  );
  return result.rows[0];
}

export async function updateUser(telegramUserId, fields) {
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');

  const result = await query(
    `UPDATE users
     SET ${setClauses}
     WHERE telegram_user_id = $1
     RETURNING *`,
    [telegramUserId, ...values]
  );
  return result.rows[0];
}

export async function getUser(telegramUserId) {
  const result = await query(
    'SELECT * FROM users WHERE telegram_user_id = $1',
    [telegramUserId]
  );
  return result.rows[0];
}

export async function isUserSetup(telegramUserId) {
  const user = await getUser(telegramUserId);
  return user && user.blog_channel_id && user.draft_group_id;
}

export async function getUserById(userId) {
  const result = await query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0];
}

export async function getUserByUsername(username) {
  const result = await query(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );
  return result.rows[0];
}

export async function getAllActiveUsers() {
  const result = await query('SELECT * FROM users WHERE is_active = TRUE');
  return result.rows;
}

export async function getUserByDraftGroupId(draftGroupId) {
  const result = await query(
    'SELECT * FROM users WHERE draft_group_id = $1 AND is_active = TRUE',
    [draftGroupId]
  );
  return result.rows[0];
}
