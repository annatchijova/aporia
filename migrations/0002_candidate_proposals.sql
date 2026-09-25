CREATE TABLE IF NOT EXISTS candidate_proposals (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  base_revision INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  drafts_json TEXT NOT NULL,
  provider_json TEXT NOT NULL,
  warnings_json TEXT NOT NULL,
  status TEXT NOT NULL,
  accepted_event_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(room_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS candidate_proposals_room_status ON candidate_proposals(room_id, status);
