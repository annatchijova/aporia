INSERT INTO creator_accounts (id, email, created_at)
VALUES ('r16-account', 'r16-synthetic@example.invalid', '2026-10-14T00:00:00.000Z');

INSERT INTO rooms (
  id, title, snapshot_json, created_at, status, creator_account_id
)
VALUES (
  'r16-delete-recovery-room', 'Synthetic race window', '{}',
  '2026-10-14T00:00:00.000Z', 'closed', 'r16-account'
);

INSERT INTO creator_auth_tokens (
  token_hash, email, room_id, purpose, created_at, expires_at, used_at
)
VALUES (
  'b09c53dfdf2ff05a1dfd05569e0cfada7108c55728b55cfbf7ef671245f753f7',
  'r16-synthetic@example.invalid', 'r16-delete-recovery-room', 'recover',
  '2026-10-14T00:00:00.000Z', '2099-01-01T00:00:00.000Z', NULL
);
