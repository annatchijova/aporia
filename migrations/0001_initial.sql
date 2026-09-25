CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  participant_id TEXT NOT NULL REFERENCES participants(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  revision INTEGER NOT NULL,
  actor_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(room_id, revision),
  UNIQUE(room_id, id)
);

CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  artifact_json TEXT NOT NULL,
  claims_json TEXT NOT NULL,
  provider_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  candidate_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS events_room_revision ON events(room_id, revision);
CREATE INDEX IF NOT EXISTS proposals_room_status ON proposals(room_id, status);
CREATE INDEX IF NOT EXISTS candidates_room ON candidates(room_id);
CREATE INDEX IF NOT EXISTS sessions_room ON sessions(room_id);
