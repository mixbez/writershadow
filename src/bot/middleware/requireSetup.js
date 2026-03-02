import { isUserSetup } from '../../db/models/user.js';

export function requireSetup() {
  return async (ctx, next) => {
    const setup = await isUserSetup(ctx.from.id);
    if (!setup) {
      await ctx.reply('Сначала выполни /start для настройки каналов.');
      return;
    }
    return next();
  };
}
