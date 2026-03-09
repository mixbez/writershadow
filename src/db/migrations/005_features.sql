-- Add support for scheduled posts and new user settings
-- Features: split text, scheduled posts, AI tags, bridge, delete used drafts

-- Scheduled posts
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE posts ADD CONSTRAINT posts_status_check
  CHECK (status IN ('draft', 'published', 'imported', 'scheduled'));
ALTER TABLE posts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_at)
  WHERE status = 'scheduled';

-- User feature toggles
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_tags_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bridge_enabled BOOLEAN DEFAULT FALSE;
