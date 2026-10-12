ALTER TABLE rooms ADD COLUMN creator_participant_id TEXT;
ALTER TABLE rooms ADD COLUMN creator_account_id TEXT;
ALTER TABLE rooms ADD COLUMN closed_at TEXT;
ALTER TABLE rooms ADD COLUMN deleted_at TEXT;
ALTER TABLE rooms ADD COLUMN recovery_until TEXT;
ALTER TABLE rooms ADD COLUMN recovery_snapshot_json TEXT;

UPDATE rooms
SET creator_participant_id = (
  SELECT p.id FROM participants p
  WHERE p.room_id = rooms.id
  ORDER BY p.created_at ASC, p.id ASC
  LIMIT 1
)
WHERE creator_participant_id IS NULL;

CREATE TABLE creator_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  google_subject TEXT UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE creator_auth_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  purpose TEXT NOT NULL CHECK (purpose IN ('login', 'recover')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX creator_auth_tokens_room_purpose ON creator_auth_tokens(room_id, purpose, expires_at);
CREATE INDEX creator_auth_tokens_room_email_created ON creator_auth_tokens(room_id, email, created_at);

CREATE TABLE creator_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES creator_accounts(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX creator_sessions_account_expiry ON creator_sessions(account_id, expires_at);

CREATE INDEX rooms_recovery_expiry ON rooms(status, recovery_until);
