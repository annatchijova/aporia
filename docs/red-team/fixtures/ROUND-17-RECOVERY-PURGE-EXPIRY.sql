-- Synthetic rows for Round 17 only. Use in an isolated local D1 database.
INSERT INTO creator_accounts (id, email, created_at)
VALUES ('r17-race-account', 'r17-race@example.invalid', '2026-10-14T00:00:00.000Z');
INSERT INTO rooms (id, title, revision, snapshot_json, created_at, status, creator_account_id, closed_at, deleted_at, recovery_until, recovery_snapshot_json)
VALUES ('r17-race-room', 'Synthetic concurrent purge', 1, '{}', '2026-10-14T00:00:00.000Z', 'trashed', 'r17-race-account', '2026-10-14T00:00:00.000Z', '2026-10-14T00:00:00.000Z', '2000-10-14T00:00:00.000Z', '{}');
INSERT INTO participants (id, room_id, display_name, created_at)
VALUES ('r17-race-participant', 'r17-race-room', 'Synthetic attendee', '2026-10-14T00:00:00.000Z');
INSERT INTO sessions (token_hash, room_id, participant_id, created_at)
VALUES ('r17-race-session-hash', 'r17-race-room', 'r17-race-participant', '2026-10-14T00:00:00.000Z');
INSERT INTO room_messages (id, room_id, participant_id, body, idempotency_key, created_at)
VALUES ('r17-race-message', 'r17-race-room', 'r17-race-participant', 'synthetic', 'r17-race-key', '2026-10-14T00:00:00.000Z');
INSERT INTO proposals (id, room_id, artifact_json, claims_json, provider_json, status, created_at)
VALUES ('r17-race-proposal', 'r17-race-room', '{"kind":"text"}', '[]', '{}', 'reviewed', '2026-10-14T00:00:00.000Z');
INSERT INTO proposal_claim_decisions (proposal_id, claim_id, decision, created_at)
VALUES ('r17-race-proposal', 'r17-race-claim', 'confirmed', '2026-10-14T00:00:00.000Z');
INSERT INTO candidates (id, room_id, candidate_json, created_at)
VALUES ('r17-race-candidate', 'r17-race-room', '{}', '2026-10-14T00:00:00.000Z');
INSERT INTO candidate_proposals (id, room_id, base_revision, idempotency_key, drafts_json, provider_json, warnings_json, status, created_at)
VALUES ('r17-race-candidate-proposal', 'r17-race-room', 1, 'r17-candidate-key', '[]', '{}', '[]', 'rejected', '2026-10-14T00:00:00.000Z');
INSERT INTO events (id, room_id, revision, actor_id, event_type, payload_json, created_at)
VALUES ('r17-race-event', 'r17-race-room', 1, 'r17-race-participant', 'participant.added', '{}', '2026-10-14T00:00:00.000Z');
INSERT INTO creator_auth_tokens (token_hash, email, room_id, purpose, created_at, expires_at)
VALUES ('7931e198b449d71735a81bda68c1db662382740adf21f0e892770b69dfa059e5', 'r17-race@example.invalid', 'r17-race-room', 'recover', '2026-10-14T00:00:00.000Z', '2099-10-14T00:00:00.000Z');
INSERT INTO creator_sessions (token_hash, account_id, created_at, expires_at)
VALUES ('r17-race-creator-session', 'r17-race-account', '2026-10-14T00:00:00.000Z', '2099-10-14T00:00:00.000Z');

-- An expired token with a still-open room recovery window models a delayed provider response.
INSERT INTO creator_accounts (id, email, created_at)
VALUES ('r17-gap-account', 'r17-gap@example.invalid', '2026-10-14T00:00:00.000Z');
INSERT INTO rooms (id, title, revision, snapshot_json, created_at, status, creator_account_id, closed_at, deleted_at, recovery_until, recovery_snapshot_json)
VALUES ('r17-gap-room', 'Synthetic timing gap', 1, '{}', '2026-10-14T00:00:00.000Z', 'trashed', 'r17-gap-account', '2026-10-14T00:00:00.000Z', '2026-10-14T00:00:00.000Z', '2099-10-14T00:00:00.000Z', '{"title":"Recovered room","candidates":[],"registeredCount":0,"attendedCount":null}');
INSERT INTO creator_auth_tokens (token_hash, email, room_id, purpose, created_at, expires_at)
VALUES ('d327464ca6a58c9440cee2155b9b8bd35ad9b8c1c12162b5b24c6cbf71e0dd17', 'r17-gap@example.invalid', 'r17-gap-room', 'recover', '2026-10-14T00:00:00.000Z', '2000-10-14T00:00:00.000Z');
