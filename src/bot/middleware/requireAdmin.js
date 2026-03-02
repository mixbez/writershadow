export function requireAdmin() {
  return async (ctx, next) => {
    if (String(ctx.from.id) !== String(process.env.ADMIN_USER_ID)) {
      return; // Молча игнорируем
    }
    return next();
  };
}
