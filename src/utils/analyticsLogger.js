import { logCommand } from '../db/models/commandLog.js';

/**
 * Создает обёртку для логирования команд
 * Используется для автоматического логирования всех команд бота
 */
export function withAnalytics(commandName) {
  return (handler) => {
    return async (ctx, next) => {
      const startTime = Date.now();
      const telegramUserId = ctx.from?.id;
      const username = ctx.from?.username;

      try {
        await handler(ctx, next);

        // Логируем успешное выполнение
        await logCommand(
          telegramUserId,
          commandName,
          'success',
          null,
          {
            duration: Date.now() - startTime,
            userId: ctx.state?.user?.id
          }
        );
      } catch (error) {
        // Логируем ошибку
        await logCommand(
          telegramUserId,
          commandName,
          'error',
          error.message,
          {
            duration: Date.now() - startTime,
            userId: ctx.state?.user?.id,
            stack: error.stack
          }
        );
        throw error;
      }
    };
  };
}

/**
 * Прямое логирование без обёртки
 */
export async function logAnalytics(telegramUserId, command, status = 'success', errorMessage = null, data = null) {
  return logCommand(telegramUserId, command, status, errorMessage, data);
}

/**
 * Логирует команду синхронно (без ожидания)
 * Полезно когда не нужно ждать завершения логирования
 */
export function logAnalyticsAsync(telegramUserId, command, status = 'success', errorMessage = null, data = null) {
  logCommand(telegramUserId, command, status, errorMessage, data).catch(err =>
    console.error('Analytics logging error:', err)
  );
}
