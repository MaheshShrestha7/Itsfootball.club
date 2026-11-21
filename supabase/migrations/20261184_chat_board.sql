-- Score by chat: the live scoreboard message the bot pins in a scorer's chat and rewrites after every
-- change (lib/chat-board.ts). { match_id, message_id }; null when there's none. chat_links stays server-only.
ALTER TABLE chat_links ADD COLUMN IF NOT EXISTS board JSONB;
CREATE INDEX IF NOT EXISTS idx_chat_links_board_match ON chat_links ((board ->> 'match_id')) WHERE board IS NOT NULL;
