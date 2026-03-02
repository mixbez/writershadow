import { query } from '../index.js';

export async function createDraft(userId, messageId, chatId, text) {
  const charCount = text.length;
  const result = await query(
    `INSERT INTO drafts (user_id, message_id, chat_id, text, char_count)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, messageId, chatId, text, charCount]
  );
  return result.rows[0];
}

export async function getUnusedDrafts(userId) {
  const result = await query(
    `SELECT * FROM drafts
     WHERE user_id = $1 AND is_used = FALSE
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function getDraftsByIds(draftIds) {
  if (draftIds.length === 0) return [];
  const placeholders = draftIds.map((_, i) => `$${i + 1}`).join(',');
  const result = await query(
    `SELECT * FROM drafts WHERE id IN (${placeholders})
     ORDER BY created_at ASC`,
    draftIds
  );
  return result.rows;
}

export async function markDraftsAsUsed(draftIds, postId) {
  if (draftIds.length === 0) return;
  const placeholders = draftIds.map((_, i) => `$${i + 2}`).join(',');
  await query(
    `UPDATE drafts
     SET is_used = TRUE, post_id = $1
     WHERE id IN (${placeholders})`,
    [postId, ...draftIds]
  );
}

export async function getDraft(draftId) {
  const result = await query(
    'SELECT * FROM drafts WHERE id = $1',
    [draftId]
  );
  return result.rows[0];
}

export async function getDraftCount(userId, since = null) {
  let sql = 'SELECT COUNT(*) FROM drafts WHERE user_id = $1 AND is_used = FALSE';
  const params = [userId];
  if (since) {
    sql += ' AND created_at >= $2';
    params.push(since);
  }
  const result = await query(sql, params);
  return parseInt(result.rows[0].count, 10);
}
