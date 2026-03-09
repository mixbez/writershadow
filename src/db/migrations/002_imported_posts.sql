-- Добавляем статус 'imported' для постов, импортированных из JSON-экспорта Telegram
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE posts ADD CONSTRAINT posts_status_check
  CHECK (status IN ('draft', 'published', 'imported'));
