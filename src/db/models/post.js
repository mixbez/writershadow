import { query } from '../index.js';

export async function createDraftPost(userId, text, draftIds = []) {
  const charCount = text.length;
  const result = await query(
    `INSERT INTO posts (user_id, text, char_count, status)
     VALUES ($1, $2, $3, 'draft')
     RETURNING *`,
    [userId, text, charCount]
  );
  const post = result.rows[0];

  // Link drafts to this post
  if (draftIds && draftIds.length > 0) {
    const placeholders = draftIds.map((_, i) => `$${i + 2}`).join(',');
    await query(
      `UPDATE drafts SET post_id = $1 WHERE id IN (${placeholders})`,
      [post.id, ...draftIds]
    );
  }

  return post;
}

export async function publishPost(postId, channelMessageId) {
  const result = await query(
    `UPDATE posts
     SET status = 'published', channel_message_id = $2, published_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [postId, channelMessageId]
  );
  return result.rows[0];
}

export async function getPost(postId) {
  const result = await query(
    'SELECT * FROM posts WHERE id = $1',
    [postId]
  );
  return result.rows[0];
}

export async function getLatestDraftPost(userId) {
  const result = await query(
    `SELECT * FROM posts
     WHERE user_id = $1 AND status = 'draft'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0];
}

export async function getRecentPublishedPosts(userId, limit = 15) {
  const result = await query(
    `SELECT * FROM posts
     WHERE user_id = $1 AND status IN ('published', 'imported')
     ORDER BY published_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

export async function getPostsByUserId(userId, status = null) {
  let sql = 'SELECT * FROM posts WHERE user_id = $1';
  const params = [userId];
  if (status) {
    sql += ' AND status = $2';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';
  const result = await query(sql, params);
  return result.rows;
}

export async function deletePost(postId) {
  await query('DELETE FROM posts WHERE id = $1', [postId]);
}

export async function schedulePost(postId, scheduledAt) {
  const result = await query(
    `UPDATE posts
     SET status = 'scheduled', scheduled_at = $2
     WHERE id = $1
     RETURNING *`,
    [postId, scheduledAt]
  );
  return result.rows[0];
}

export async function getDueScheduledPosts() {
  const result = await query(
    `SELECT * FROM posts
     WHERE status = 'scheduled' AND scheduled_at <= NOW()
     ORDER BY scheduled_at ASC`
  );
  return result.rows;
}

export async function getScheduledPostsByUser(userId) {
  const result = await query(
    `SELECT * FROM posts
     WHERE user_id = $1 AND status = 'scheduled'
     ORDER BY scheduled_at ASC`,
    [userId]
  );
  return result.rows;
}

export async function importPostsForUser(userId, texts) {
  let count = 0;
  for (const text of texts) {
    await query(
      `INSERT INTO posts (user_id, text, char_count, status, published_at)
       VALUES ($1, $2, $3, 'imported', NOW())
       ON CONFLICT DO NOTHING`,
      [userId, text, text.length]
    );
    count++;
  }
  return count;
}
