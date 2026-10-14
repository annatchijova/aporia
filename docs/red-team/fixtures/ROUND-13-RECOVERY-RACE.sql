INSERT INTO creator_accounts (id, email, created_at)
VALUES ('r13-account', 'r13-synthetic@example.invalid', '2026-10-14T00:00:00.000Z');

INSERT INTO rooms (
  id, title, snapshot_json, created_at, status, creator_account_id,
  recovery_until, recovery_snapshot_json
)
VALUES (
  'r13-race-room-2', 'Synthetic recovery race two', '{}',
  '2026-10-14T00:00:00.000Z', 'trashed', 'r13-account',
  '2099-01-01T00:00:00.000Z',
  '{"title":"Synthetic recovery race two","candidates":[],"nextMeetingCode":null,"registeredCount":0,"attendedCount":null}'
);

INSERT INTO creator_auth_tokens (
  token_hash, email, room_id, purpose, created_at, expires_at, used_at
)
VALUES (
  '20205a12be32896ae1f0e7df19b5c9bccc289c9b32a8dbfa40854b97e8676bca',
  'r13-synthetic@example.invalid', 'r13-race-room-2', 'recover',
  '2026-10-14T00:00:00.000Z', '2099-01-01T00:00:00.000Z', NULL
);
