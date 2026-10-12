ALTER TABLE rooms ADD COLUMN meeting_code TEXT;
ALTER TABLE rooms ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

UPDATE rooms
SET meeting_code = printf('%08d', abs(random()) % 100000000)
WHERE meeting_code IS NULL;

CREATE UNIQUE INDEX rooms_meeting_code ON rooms(meeting_code);

CREATE TABLE room_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  participant_id TEXT NOT NULL REFERENCES participants(id),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 280),
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(room_id, participant_id, idempotency_key)
);

CREATE INDEX room_messages_room_created ON room_messages(room_id, created_at, id);

CREATE TABLE proposal_claim_decisions (
  proposal_id TEXT NOT NULL REFERENCES proposals(id),
  claim_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('confirmed', 'duplicate')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (proposal_id, claim_id)
);

UPDATE proposals
SET artifact_json = json_set(artifact_json, '$.content', '')
WHERE json_extract(artifact_json, '$.kind') = 'image';
