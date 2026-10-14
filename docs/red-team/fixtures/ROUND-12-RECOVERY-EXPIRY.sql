-- Synthetic rows for real local-D1 recovery expiry probes. Never use on a shared database.
INSERT OR IGNORE INTO creator_accounts (id, email, created_at)
VALUES ('r12-account', 'r12@example.test', '2026-10-14T00:00:00.000Z');

INSERT INTO rooms (id, title, revision, snapshot_json, created_at, meeting_code, status, creator_account_id, deleted_at, recovery_until, recovery_snapshot_json)
VALUES ('r12-expired-token', 'Synthetic expired token room', 1, '{}', '2026-10-14T00:00:00.000Z', NULL, 'trashed', 'r12-account', '2026-10-14T00:00:00.000Z', '2099-01-01T00:00:00.000Z', '{}');
INSERT INTO rooms (id, title, revision, snapshot_json, created_at, meeting_code, status, creator_account_id, deleted_at, recovery_until, recovery_snapshot_json)
VALUES ('r12-expired-window', 'Synthetic expired window room', 1, '{}', '2026-10-14T00:00:00.000Z', NULL, 'trashed', 'r12-account', '2026-10-14T00:00:00.000Z', '2000-01-01T00:00:00.000Z', '{}');

INSERT INTO creator_auth_tokens (token_hash, email, room_id, purpose, created_at, expires_at)
VALUES ('f5809e35309ec1b901c93446fd9063202ac1e1d74e75fffa24576e5dc93b755c', 'r12@example.test', 'r12-expired-token', 'recover', '2026-10-14T00:00:00.000Z', '2000-01-01T00:00:00.000Z');
INSERT INTO creator_auth_tokens (token_hash, email, room_id, purpose, created_at, expires_at)
VALUES ('cd242c5e7e02d8a76276e70349746fea836674f6063c33e4516e9506b9d4b8b5', 'r12@example.test', 'r12-expired-window', 'recover', '2026-10-14T00:00:00.000Z', '2099-01-01T00:00:00.000Z');
