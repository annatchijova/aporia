import { createHash } from 'node:crypto';
import { getPlatformProxy } from 'wrangler';
import { afterAll, expect, it } from 'vitest';
import { emptySnapshot } from '../../src/core/model';
import worker from '../../src/worker';

const persistPath = '/tmp/aporia-round39-source-retention-d1';
const roomId = 'room-r39-source-retention';
const participantId = 'participant-r39-uploader';
const token = 'synthetic-r39-participant-token';
const proposalId = 'proposal-r39-source-retention';
const claimId = 'claim-r39-source-retention';
const proxyPromise = getPlatformProxy({ configPath: `${process.cwd()}/wrangler.json`, envFiles: [], persist: { path: persistPath } });
let proxy;
afterAll(async () => await proxy?.dispose());

it('redacts a reviewed claim source in real local D1 while retaining the structured claim', async () => {
  proxy = await proxyPromise;
  const db = proxy.env.DB;
  const ddl = [
    `CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, title TEXT NOT NULL, revision INTEGER NOT NULL, snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active')`,
    `CREATE TABLE IF NOT EXISTS participants (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, display_name TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, room_id TEXT NOT NULL, participant_id TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS proposals (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, artifact_json TEXT NOT NULL, claims_json TEXT NOT NULL, provider_json TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS proposal_claim_decisions (proposal_id TEXT NOT NULL, claim_id TEXT NOT NULL, decision TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (proposal_id, claim_id))`,
    `CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, revision INTEGER NOT NULL, actor_id TEXT NOT NULL, event_type TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL)`,
  ];
  for (const sql of ddl) await db.prepare(sql).run();
  await db.prepare('DELETE FROM events WHERE room_id = ?').bind(roomId).run();
  await db.prepare('DELETE FROM proposal_claim_decisions WHERE proposal_id = ?').bind(proposalId).run();
  await db.prepare('DELETE FROM proposals WHERE id = ?').bind(proposalId).run();
  await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(roomId).run();
  await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(roomId).run();
  await db.prepare('DELETE FROM rooms WHERE id = ?').bind(roomId).run();

  const snapshot = emptySnapshot(roomId, 'Synthetic R39 room');
  snapshot.participants.push({ id: participantId, displayName: 'Synthetic uploader' });
  const now = new Date().toISOString();
  await db.prepare('INSERT INTO rooms (id, title, revision, snapshot_json, created_at, status) VALUES (?, ?, 0, ?, ?, ?)').bind(roomId, snapshot.title, JSON.stringify(snapshot), now, 'active').run();
  await db.prepare('INSERT INTO participants (id, room_id, display_name, created_at) VALUES (?, ?, ?, ?)').bind(participantId, roomId, 'Synthetic uploader', now).run();
  await db.prepare('INSERT INTO sessions (token_hash, room_id, participant_id, created_at) VALUES (?, ?, ?, ?)').bind(createHash('sha256').update(token).digest('hex'), roomId, participantId, now).run();
  await db.prepare('INSERT INTO proposals (id, room_id, artifact_json, claims_json, provider_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
    proposalId, roomId, JSON.stringify({ participantId, kind: 'image', content: '', contentHash: '' }),
    JSON.stringify([{ id: claimId, kind: 'dietary_note', participantId, value: { text: 'vegetarian' }, sourceText: 'I am Marta and do not eat meat', confidence: 'high', ambiguity: [] }]),
    JSON.stringify({ name: 'synthetic', model: 'fixture' }), 'pending', now,
  ).run();

  const response = await worker.fetch(new Request(`https://aporia.test/api/rooms/${roomId}/proposals/${proposalId}/confirm`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': token },
    body: JSON.stringify({ claimId, participantId, expectedRevision: 0 }),
  }), proxy.env);
  const row = await db.prepare('SELECT claims_json as claims FROM proposals WHERE id = ?').bind(proposalId).first();
  const claims = JSON.parse(row.claims);
  const decision = await db.prepare('SELECT decision FROM proposal_claim_decisions WHERE proposal_id = ? AND claim_id = ?').bind(proposalId, claimId).first();

  expect(response.status).toBe(200);
  expect(claims[0].sourceText).toBe('');
  expect(claims[0].value).toEqual({ text: 'vegetarian' });
  expect(decision.decision).toBe('confirmed');
});
