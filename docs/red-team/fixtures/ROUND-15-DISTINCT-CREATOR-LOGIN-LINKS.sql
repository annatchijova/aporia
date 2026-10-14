INSERT INTO rooms (
  id, title, snapshot_json, created_at, creator_participant_id
)
VALUES (
  'r15-login-room', 'Synthetic dual login race', '{}',
  '2026-10-14T00:00:00.000Z', 'r15-participant'
);

INSERT INTO participants (id, room_id, display_name, created_at)
VALUES (
  'r15-participant', 'r15-login-room', 'Synthetic creator',
  '2026-10-14T00:00:00.000Z'
);

INSERT INTO creator_auth_tokens (
  token_hash, email, room_id, purpose, created_at, expires_at, used_at
)
VALUES
  (
    '2310be6d4691f8e59bc23ea6f32f047eb1337ef1597d63cf40ade522b77838f9',
    'r15-synthetic@example.invalid', 'r15-login-room', 'login',
    '2026-10-14T00:00:00.000Z', '2099-01-01T00:00:00.000Z', NULL
  ),
  (
    'fe14190dcd14dc6d850b47aa4a0c1138b8697f792ec89486635846692a344a4d',
    'r15-synthetic@example.invalid', 'r15-login-room', 'login',
    '2026-10-14T00:00:00.000Z', '2099-01-01T00:00:00.000Z', NULL
  );
