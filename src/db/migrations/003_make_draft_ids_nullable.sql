-- Make message_id and chat_id nullable in drafts table
-- This allows storing drafts created via /new command in private chat
ALTER TABLE drafts
ALTER COLUMN message_id DROP NOT NULL,
ALTER COLUMN chat_id DROP NOT NULL;
