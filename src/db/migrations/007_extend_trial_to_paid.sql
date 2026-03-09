-- Reset 14-day Groq trial for all users (like they are new)
-- Everyone gets demo access on Groq for 14 days starting today
UPDATE users
SET demo_expires_at = NOW() + INTERVAL '14 days',
    ai_provider = 'groq'
WHERE is_active = TRUE;
