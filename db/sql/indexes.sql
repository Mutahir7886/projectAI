CREATE INDEX IF NOT EXISTS idx_messages_session_ts ON messages (session_id, ts);
