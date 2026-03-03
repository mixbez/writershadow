-- Пользователи
CREATE TABLE IF NOT EXISTS users (
  id                      SERIAL PRIMARY KEY,
  telegram_user_id        BIGINT UNIQUE NOT NULL,
  username                TEXT,

  -- Настройка каналов
  blog_channel_id         BIGINT,
  draft_group_id          BIGINT,

  -- Напоминания
  reminder_time           TIME DEFAULT '20:00',
  timezone                TEXT DEFAULT 'Europe/Moscow',
  reminder_enabled        BOOLEAN DEFAULT TRUE,
  evening_nudge_enabled   BOOLEAN DEFAULT FALSE,
  evening_nudge_time      TIME DEFAULT '21:00',
  weekly_summary_enabled  BOOLEAN DEFAULT TRUE,

  -- AI-провайдер
  -- Значения: 'none' | 'groq' | 'anthropic' | 'paid'
  ai_provider             TEXT DEFAULT 'none'
                            CHECK (ai_provider IN ('none', 'groq', 'anthropic', 'paid')),
  ai_key_encrypted        TEXT,   -- ключ пользователя, зашифрованный AES-256-GCM

  -- Подписка (для paid уровня)
  -- Значения: 'inactive' | 'active' | 'expired'
  subscription_status     TEXT DEFAULT 'inactive'
                            CHECK (subscription_status IN ('inactive', 'active', 'expired')),
  subscription_expires_at TIMESTAMPTZ,

  is_active               BOOLEAN DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Посты (публикации в канале)
CREATE TABLE IF NOT EXISTS posts (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_message_id  BIGINT,
  text                TEXT NOT NULL,
  char_count          INTEGER NOT NULL,
  -- Значения: 'draft' | 'published'
  status              TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Черновики
CREATE TABLE IF NOT EXISTS drafts (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id  BIGINT NOT NULL,
  chat_id     BIGINT NOT NULL,
  text        TEXT NOT NULL,
  char_count  INTEGER NOT NULL,
  is_used     BOOLEAN DEFAULT FALSE,
  post_id     INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Суточная статистика
CREATE TABLE IF NOT EXISTS daily_stats (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  chars_written   INTEGER DEFAULT 0,
  drafts_count    INTEGER DEFAULT 0,
  posts_published INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_drafts_user_unused ON drafts(user_id) WHERE is_used = FALSE;
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_user_date ON daily_stats(user_id, date);
