import { query } from '../../db/index.js';

/**
 * Command logger middleware
 * Logs all command executions to command_logs table
 */
export function commandLoggerMiddleware() {
  return async (ctx, next) => {
    const startTime = Date.now();
    let status = 'success';
    let error_message = null;

    try {
      await next();
    } catch (error) {
      status = 'error';
      error_message = error.message;
      throw error;
    } finally {
      // Log the command
      if (ctx.message?.text?.startsWith('/') || ctx.callbackQuery?.data?.startsWith('cmd:')) {
        const command = ctx.message?.text?.split(' ')[0]?.slice(1) ||
                       ctx.callbackQuery?.data?.split(':')[1] ||
                       'unknown';

        const userId = ctx.from?.id;
        const username = ctx.from?.username;

        try {
          await query(`
            INSERT INTO command_logs (telegram_user_id, username, command, status, error_message, data)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [userId, username, command, status, error_message, JSON.stringify({
            duration_ms: Date.now() - startTime
          })]);
        } catch (logError) {
          console.error('Failed to log command:', logError);
        }
      }
    }
  };
}
