-- Таблица для логирования команд
CREATE TABLE IF NOT EXISTS command_logs (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,
  telegram_user_id  BIGINT,
  username          TEXT,
  command           TEXT NOT NULL,
  status            TEXT DEFAULT 'success' CHECK (status IN ('success', 'error')),
  error_message     TEXT,
  data              JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_command_logs_user_id ON command_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_command_logs_telegram_user_id ON command_logs(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_command_logs_created_at ON command_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_command_logs_command ON command_logs(command);
