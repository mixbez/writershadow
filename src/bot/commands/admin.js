import { requireAdmin } from '../middleware/requireAdmin.js';
import { getUserByUsername, getAllActiveUsers } from '../../db/models/user.js';
import { query } from '../../db/index.js';
import { bot } from '../index.js';

export async function adminCommand(ctx) {
  // Check admin permission
  if (String(ctx.from.id) !== String(process.env.ADMIN_USER_ID)) {
    return; // Silently ignore
  }

  // Only in private chat
  if (ctx.chat.type !== 'private') {
    await ctx.reply('Используй этту команду в личном чате.');
    return;
  }

  const args = ctx.message.text?.split(/\s+/).slice(1) || [];
  const subcommand = args[0]?.toLowerCase();

  if (!subcommand || subcommand === 'help') {
    await ctx.reply(`Admin commands:
/admin grant @username [days] - Give Pro subscription
/admin revoke @username - Remove Pro subscription
/admin list - List active Pro users
/admin stats - Show general statistics`);
    return;
  }

  try {
    if (subcommand === 'grant') {
      await grantSubscription(ctx, args);
    } else if (subcommand === 'revoke') {
      await revokeSubscription(ctx, args);
    } else if (subcommand === 'list') {
      await listProUsers(ctx);
    } else if (subcommand === 'stats') {
      await showAdminStats(ctx);
    } else {
      await ctx.reply('Unknown command. Use /admin help');
    }
  } catch (err) {
    console.error('Admin command error:', err);
    await ctx.reply('Error: ' + err.message);
  }
}

async function grantSubscription(ctx, args) {
  const username = args[1];
  const days = parseInt(args[2] || '30', 10);

  if (!username) {
    await ctx.reply('Usage: /admin grant @username [days]');
    return;
  }

  const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
  const user = await getUserByUsername(cleanUsername);

  if (!user) {
    await ctx.reply(`User @${cleanUsername} not found`);
    return;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  await query(
    `UPDATE users
     SET subscription_status = 'active',
         subscription_expires_at = $1,
         ai_provider = 'paid'
     WHERE id = $2`,
    [expiresAt.toISOString(), user.id]
  );

  const dateStr = expiresAt.toLocaleDateString('ru-RU');
  await bot.telegram.sendMessage(
    user.telegram_user_id,
    `Подписка WriterShadow Pro активирована до ${dateStr}! /suggest теперь доступен.`
  );

  await ctx.reply(`✅ Подписка для @${cleanUsername} активирована до ${dateStr}`);
}

async function revokeSubscription(ctx, args) {
  const username = args[1];

  if (!username) {
    await ctx.reply('Usage: /admin revoke @username');
    return;
  }

  const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
  const user = await getUserByUsername(cleanUsername);

  if (!user) {
    await ctx.reply(`User @${cleanUsername} not found`);
    return;
  }

  await query(
    `UPDATE users
     SET subscription_status = 'inactive',
         ai_provider = 'none'
     WHERE id = $1`,
    [user.id]
  );

  await bot.telegram.sendMessage(
    user.telegram_user_id,
    'Ваша подписка WriterShadow Pro была отменена.'
  );

  await ctx.reply(`✅ Подписка для @${cleanUsername} отозвана`);
}

async function listProUsers(ctx) {
  const result = await query(
    `SELECT username, subscription_expires_at
     FROM users
     WHERE subscription_status = 'active'
     ORDER BY subscription_expires_at DESC`
  );

  if (result.rows.length === 0) {
    await ctx.reply('No active Pro subscriptions');
    return;
  }

  let text = '📋 Active Pro subscriptions:\n\n';
  for (const user of result.rows) {
    const expiresDate = new Date(user.subscription_expires_at);
    const dateStr = expiresDate.toLocaleDateString('ru-RU');
    text += `@${user.username} — до ${dateStr}\n`;
  }

  await ctx.reply(text);
}

async function showAdminStats(ctx) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const result = await query(
    `SELECT
      (SELECT COUNT(*) FROM users WHERE is_active = TRUE) as total_users,
      (SELECT SUM(drafts_count) FROM daily_stats WHERE date >= $1) as total_drafts,
      (SELECT SUM(posts_published) FROM daily_stats WHERE date >= $1) as total_posts,
      (SELECT COUNT(*) FROM users WHERE subscription_status = 'active') as pro_users
     `,
    [sevenDaysAgo.toISOString().slice(0, 10)]
  );

  const stats = result.rows[0];

  const text = `📊 WriterShadow Stats (Last 7 days)

Total users: ${stats.total_users}
Pro users: ${stats.pro_users}
Drafts created: ${stats.total_drafts || 0}
Posts published: ${stats.total_posts || 0}`;

  await ctx.reply(text);
}
