INSERT INTO rooms (
  id, title, snapshot_json, created_at, creator_participant_id
)
VALUES (
  'r14-login-room', 'Synthetic login race', '{}',
  '2026-10-14T00:00:00.000Z', 'r14-participant'
);

INSERT INTO participants (id, room_id, display_name, created_at)
VALUES (
  'r14-participant', 'r14-login-room', 'Synthetic creator',
  '2026-10-14T00:00:00.000Z'
);

INSERT INTO creator_auth_tokens (
  token_hash, email, room_id, purpose, created_at, expires_at, used_at
)
VALUES (
  'cc94559a25e180a9831cafb32f7db687c9751e5b72e7d295fed0f14b389e0bef',
  'r14-synthetic@example.invalid', 'r14-login-room', 'login',
  '2026-10-14T00:00:00.000Z', '2099-01-01T00:00:00.000Z', NULL
);
