-- Synthetic rows for the scheduled room-purge D1 induction. Never use on a shared database.
INSERT INTO rooms (id, title, revision, snapshot_json, created_at, meeting_code, status, creator_participant_id, creator_account_id, closed_at, deleted_at, recovery_until, recovery_snapshot_json)
VALUES ('r11-purge-fixture', 'Synthetic purge fixture', 1, '{}', '2026-10-01T00:00:00.000Z', NULL, 'trashed', NULL, 'r11-account', '2026-10-01T01:00:00.000Z', '2026-10-01T01:00:00.000Z', '2000-01-01T00:00:00.000Z', '{}');
INSERT INTO creator_accounts (id, email, created_at) VALUES ('r11-account', 'r11@example.test', '2026-10-01T00:00:00.000Z');
INSERT INTO participants (id, room_id, display_name, created_at) VALUES ('r11-participant', 'r11-purge-fixture', 'Synthetic attendee', '2026-10-01T00:00:00.000Z');
INSERT INTO sessions (token_hash, room_id, participant_id, created_at) VALUES ('r11-session-hash', 'r11-purge-fixture', 'r11-participant', '2026-10-01T00:00:00.000Z');
INSERT INTO events (id, room_id, revision, actor_id, event_type, payload_json, created_at) VALUES ('r11-event', 'r11-purge-fixture', 1, 'r11-participant', 'participant.added', '{}', '2026-10-01T00:00:00.000Z');
INSERT INTO proposals (id, room_id, artifact_json, claims_json, provider_json, status, created_at) VALUES ('r11-proposal', 'r11-purge-fixture', '{"kind":"text"}', '[]', '{}', 'reviewed', '2026-10-01T00:00:00.000Z');
INSERT INTO proposal_claim_decisions (proposal_id, claim_id, decision, created_at) VALUES ('r11-proposal', 'r11-claim', 'confirmed', '2026-10-01T00:00:00.000Z');
INSERT INTO candidates (id, room_id, candidate_json, created_at) VALUES ('r11-candidate', 'r11-purge-fixture', '{}', '2026-10-01T00:00:00.000Z');
INSERT INTO candidate_proposals (id, room_id, base_revision, idempotency_key, drafts_json, provider_json, warnings_json, status, created_at) VALUES ('r11-candidate-proposal', 'r11-purge-fixture', 1, 'r11-key', '[]', '{}', '[]', 'rejected', '2026-10-01T00:00:00.000Z');
INSERT INTO room_messages (id, room_id, participant_id, body, idempotency_key, created_at) VALUES ('r11-message', 'r11-purge-fixture', 'r11-participant', 'synthetic', 'r11-key', '2026-10-01T00:00:00.000Z');
INSERT INTO creator_auth_tokens (token_hash, email, room_id, purpose, created_at, expires_at) VALUES ('r11-auth-hash', 'r11@example.test', 'r11-purge-fixture', 'recover', '2026-10-01T00:00:00.000Z', '2000-01-01T00:00:00.000Z');
INSERT INTO creator_sessions (token_hash, account_id, created_at, expires_at) VALUES ('r11-creator-session', 'r11-account', '2026-10-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z');

INSERT INTO rooms (id, title, revision, snapshot_json, created_at, meeting_code, status, creator_account_id, closed_at, deleted_at, recovery_until, recovery_snapshot_json)
VALUES ('r11-not-expired', 'Synthetic unexpired room', 1, '{}', '2026-10-01T00:00:00.000Z', NULL, 'trashed', 'r11-account', '2026-10-01T01:00:00.000Z', '2026-10-01T01:00:00.000Z', '2099-01-01T00:00:00.000Z', '{}');
INSERT INTO participants (id, room_id, display_name, created_at) VALUES ('r11-not-expired-participant', 'r11-not-expired', 'Synthetic retained attendee', '2026-10-01T00:00:00.000Z');
INSERT INTO sessions (token_hash, room_id, participant_id, created_at) VALUES ('r11-not-expired-session', 'r11-not-expired', 'r11-not-expired-participant', '2026-10-01T00:00:00.000Z');
INSERT INTO room_messages (id, room_id, participant_id, body, idempotency_key, created_at) VALUES ('r11-not-expired-message', 'r11-not-expired', 'r11-not-expired-participant', 'synthetic retained', 'r11-key', '2026-10-01T00:00:00.000Z');
