-- Add demo pro subscription support
ALTER TABLE users ADD COLUMN IF NOT EXISTS demo_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_features_enabled BOOLEAN DEFAULT FALSE;

-- Set all existing users to have 14 days demo starting now
UPDATE users
SET demo_expires_at = NOW() + INTERVAL '14 days',
    pro_features_enabled = TRUE,
    ai_provider = CASE
      WHEN ai_provider = 'none' THEN 'groq'
      WHEN ai_provider NOT IN ('groq', 'anthropic', 'paid') THEN 'groq'
      ELSE ai_provider
    END
WHERE is_active = TRUE;

-- For users with personal keys, keep them but mark as having custom key
-- For users without key, set to groq (public key)
-- Note: suggest command is premium only, not included in demo
