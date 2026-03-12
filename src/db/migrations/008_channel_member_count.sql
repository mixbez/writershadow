ALTER TABLE users
  ADD COLUMN IF NOT EXISTS channel_member_count       INTEGER,
  ADD COLUMN IF NOT EXISTS channel_member_count_updated_at TIMESTAMPTZ;
