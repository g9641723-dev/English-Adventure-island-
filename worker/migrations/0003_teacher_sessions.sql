CREATE TABLE IF NOT EXISTS teacher_sessions (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, auth_tag TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS teacher_sessions_expiry ON teacher_sessions(expires_at);
