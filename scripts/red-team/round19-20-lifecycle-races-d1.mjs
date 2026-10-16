import { createHash } from 'node:crypto';
import { getPlatformProxy } from 'wrangler';
import { afterAll, expect, it, vi } from 'vitest';
import worker from '../../src/worker';

const persistPath = '/tmp/aporia-round19-d1';
const roomId = 'room-r19-concurrent-delete';
const accountId = 'account-r19-owner';
const creatorToken = 'synthetic-r19-creator-token';
const ownerEmail = 'r19-owner@example.test';
const digest = (value) => createHash('sha256').update(value).digest('hex');
const proxyPromise = getPlatformProxy({ configPath: `${process.cwd()}/wrangler.json`, envFiles: [], persist: { path: persistPath } });

const ddl = [
  `CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, title TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL, meeting_code TEXT, status TEXT NOT NULL DEFAULT 'active', creator_participant_id TEXT, creator_account_id TEXT, closed_at TEXT, deleted_at TEXT, recovery_until TEXT, recovery_snapshot_json TEXT)`,
  `CREATE TABLE IF NOT EXISTS participants (id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), display_name TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), participant_id TEXT NOT NULL REFERENCES participants(id), created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), revision INTEGER NOT NULL, actor_id TEXT NOT NULL, event_type TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS proposals (id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), artifact_json TEXT NOT NULL, claims_json TEXT NOT NULL, provider_json TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS candidates (id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), candidate_json TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS candidate_proposals (id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), base_revision INTEGER NOT NULL, idempotency_key TEXT NOT NULL, drafts_json TEXT NOT NULL, provider_json TEXT NOT NULL, warnings_json TEXT NOT NULL, status TEXT NOT NULL, accepted_event_id TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS room_messages (id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), participant_id TEXT NOT NULL REFERENCES participants(id), body TEXT NOT NULL, idempotency_key TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS proposal_claim_decisions (proposal_id TEXT NOT NULL REFERENCES proposals(id), claim_id TEXT NOT NULL, decision TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (proposal_id, claim_id))`,
  `CREATE TABLE IF NOT EXISTS creator_accounts (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, google_subject TEXT UNIQUE, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS creator_auth_tokens (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, room_id TEXT NOT NULL REFERENCES rooms(id), purpose TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS creator_sessions (token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES creator_accounts(id), created_at TEXT NOT NULL, expires_at TEXT NOT NULL)`,
];

let proxy;
afterAll(async () => { vi.unstubAllGlobals(); await proxy?.dispose(); });

it('forces two deletes past the cooldown read before either inserts a recovery token', async () => {
  proxy = await proxyPromise;
  const db = proxy.env.DB;
  for (const sql of ddl) await db.prepare(sql).run();
  await db.prepare('DELETE FROM creator_sessions').run();
  await db.prepare('DELETE FROM creator_auth_tokens').run();
  await db.prepare('DELETE FROM creator_accounts').run();
  await db.prepare('DELETE FROM rooms WHERE id = ?').bind(roomId).run();
  const snapshot = JSON.stringify({ roomId, title: 'Synthetic event', revision: 1, candidates: [], participants: [], facts: [], constraints: [], preferences: [], recoverySummary: { registeredCount: 0, attendedCount: null, nextMeetingCode: null } });
  const createdAt = new Date().toISOString();
  await db.prepare(`INSERT INTO creator_accounts (id, email, created_at) VALUES (?, ?, ?)`).bind(accountId, ownerEmail, createdAt).run();
  await db.prepare(`INSERT INTO rooms (id, title, revision, snapshot_json, created_at, meeting_code, status, creator_account_id) VALUES (?, ?, 1, ?, ?, '12345678', 'closed', ?)`).bind(roomId, 'Synthetic event', snapshot, createdAt, accountId).run();
  await db.prepare(`INSERT INTO creator_sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)`).bind(digest(creatorToken), accountId, createdAt, new Date(Date.now() + 86_400_000).toISOString()).run();

  let reservations = 0;
  let releaseReservations;
  let reportReservations;
  const bothAtReservation = new Promise((resolve) => { reportReservations = resolve; });
  const reservationReleased = new Promise((resolve) => { releaseReservations = resolve; });
  const wrappedDb = new Proxy(db, { get(target, property) {
    if (property === 'prepare') return (sql) => {
      const statement = target.prepare(sql);
      if (!sql.startsWith('INSERT INTO creator_auth_tokens')) return statement;
      return new Proxy(statement, { get(prepared, preparedProperty) {
        const method = Reflect.get(prepared, preparedProperty, prepared);
        if (preparedProperty !== 'bind') return typeof method === 'function' ? method.bind(prepared) : method;
        return (...values) => {
          const bound = method.apply(prepared, values);
          return new Proxy(bound, { get(boundStatement, boundProperty) {
            const boundMethod = Reflect.get(boundStatement, boundProperty, boundStatement);
            if (boundProperty !== 'run') return typeof boundMethod === 'function' ? boundMethod.bind(boundStatement) : boundMethod;
            return async (...args) => {
              reservations++;
              if (reservations === 2) reportReservations();
              await reservationReleased;
              return boundMethod.apply(boundStatement, args);
            };
          } });
        };
      } });
    };
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  const env = { ...proxy.env, DB: wrappedDb, RESEND_API_KEY: 'synthetic-only', CREATOR_EMAIL_FROM: 'no-reply@example.test', APORIA_APP_ORIGIN: 'https://aporia.test' };

  let emailCount = 0;
  vi.stubGlobal('fetch', vi.fn(async () => {
    emailCount++;
    return new Response(JSON.stringify({ id: `synthetic-email-${emailCount}` }), { status: 200 });
  }));

  const request = () => worker.fetch(new Request(`https://aporia.test/api/rooms/${roomId}/delete`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-creator': creatorToken }, body: '{}' }), env);
  const requests = [request(), request()];
  await bothAtReservation;
  releaseReservations();
  const responses = await Promise.all(requests);
  const responseDetails = await Promise.all(responses.map(async (response) => ({ status: response.status, body: await response.text() })));
  const statuses = responseDetails.map(({ status }) => status).sort();
  const rows = await db.prepare(`SELECT status, deleted_at as deletedAt, recovery_until as recoveryUntil FROM rooms WHERE id = ?`).bind(roomId).first();
  const tokens = await db.prepare(`SELECT token_hash as tokenHash, expires_at as expiresAt FROM creator_auth_tokens WHERE room_id = ? AND purpose = 'recover'`).bind(roomId).all();
  expect(statuses).toEqual([200, 429]);
  expect(emailCount).toBe(1);
  expect(rows.status).toBe('trashed');
  expect(tokens.results).toHaveLength(1);
  expect(tokens.results[0].expiresAt).toBe(rows.recoveryUntil);
});

it('lets a delayed delete follow a successful reopen as two valid lifecycle transitions', async () => {
  const db = proxy.env.DB;
  const snapshot = JSON.stringify({ roomId, title: 'Synthetic event', revision: 1, candidates: [], participants: [], facts: [], constraints: [], preferences: [], recoverySummary: { registeredCount: 0, attendedCount: null, nextMeetingCode: null } });
  await db.prepare('DELETE FROM creator_auth_tokens WHERE room_id = ?').bind(roomId).run();
  await db.prepare(`UPDATE rooms SET title = ?, snapshot_json = ?, revision = 1, meeting_code = '12345678', status = 'closed', deleted_at = NULL, recovery_until = NULL, recovery_snapshot_json = NULL WHERE id = ?`).bind('Synthetic event', snapshot, roomId).run();

  let releaseEmail;
  let reportEmail;
  const emailStarted = new Promise((resolve) => { reportEmail = resolve; });
  const emailReleased = new Promise((resolve) => { releaseEmail = resolve; });
  vi.stubGlobal('fetch', vi.fn(async () => {
    reportEmail();
    await emailReleased;
    return new Response(JSON.stringify({ id: 'synthetic-delayed-email' }), { status: 200 });
  }));

  const lifecycleRequest = (action, requestDb = db) => worker.fetch(new Request(`https://aporia.test/api/rooms/${roomId}/${action}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-creator': creatorToken }, body: '{}',
  }), { ...proxy.env, DB: requestDb, RESEND_API_KEY: 'synthetic-only', CREATOR_EMAIL_FROM: 'no-reply@example.test', APORIA_APP_ORIGIN: 'https://aporia.test' });
  const deleting = lifecycleRequest('delete');
  await emailStarted;
  const reopened = await lifecycleRequest('reopen');
  expect(reopened.status).toBe(200);
  expect((await db.prepare('SELECT status FROM rooms WHERE id = ?').bind(roomId).first()).status).toBe('reopened_read_only');
  releaseEmail();
  const deleted = await deleting;
  expect(deleted.status).toBe(200);
  const finalRoom = await db.prepare('SELECT status, recovery_snapshot_json as recovery FROM rooms WHERE id = ?').bind(roomId).first();
  const recoveryTokens = await db.prepare("SELECT COUNT(*) as count FROM creator_auth_tokens WHERE room_id = ? AND purpose = 'recover'").bind(roomId).first();
  expect(finalRoom.status).toBe('trashed');
  expect(JSON.parse(finalRoom.recovery)).toMatchObject({ title: 'Recovered room', candidates: [], registeredCount: 0 });
  expect(recoveryTokens.count).toBe(1);
  await db.prepare('DELETE FROM creator_auth_tokens WHERE room_id = ?').bind(roomId).run();
});

it('keeps a possibly delivered link from a failed attempt shorter than a later trash window', async () => {
  const db = proxy.env.DB;
  const snapshot = JSON.stringify({ roomId, title: 'Synthetic event', revision: 1, candidates: [], participants: [], facts: [], constraints: [], preferences: [], recoverySummary: { registeredCount: 0, attendedCount: null, nextMeetingCode: null } });
  await db.prepare('DELETE FROM creator_auth_tokens WHERE room_id = ?').bind(roomId).run();
  await db.prepare(`UPDATE rooms SET title = ?, snapshot_json = ?, revision = 1, meeting_code = '12345678', status = 'closed', deleted_at = NULL, recovery_until = NULL, recovery_snapshot_json = NULL WHERE id = ?`).bind('Synthetic event', snapshot, roomId).run();

  const initialTime = Date.parse('2026-10-16T12:00:00.000Z');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(initialTime);
  const issuedTokens = [];
  let sendCount = 0;
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    sendCount++;
    const html = JSON.parse(init.body).html;
    issuedTokens.push(decodeURIComponent(html.match(/creatorToken=([^&"]+)/)[1]));
    if (sendCount === 1) throw new Error('simulated lost provider response after possible acceptance');
    return new Response(JSON.stringify({ id: 'synthetic-retry-email' }), { status: 200 });
  }));

  const request = () => worker.fetch(new Request(`https://aporia.test/api/rooms/${roomId}/delete`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-creator': creatorToken }, body: '{}' }), {
    ...proxy.env, DB: db, RESEND_API_KEY: 'synthetic-only', CREATOR_EMAIL_FROM: 'no-reply@example.test', APORIA_APP_ORIGIN: 'https://aporia.test',
  });
  try {
    const failedAttempt = await request();
    expect(failedAttempt.status).toBe(503);
    expect((await db.prepare('SELECT status FROM rooms WHERE id = ?').bind(roomId).first()).status).toBe('closed');
    const firstToken = await db.prepare("SELECT expires_at as expiresAt FROM creator_auth_tokens WHERE room_id = ? AND purpose = 'recover'").bind(roomId).first();
    expect(firstToken.expiresAt).toBe(new Date(initialTime + 7 * 86_400_000).toISOString());

    vi.setSystemTime(initialTime + 61_000);
    const retry = await request();
    expect(retry.status).toBe(200);
    expect(sendCount).toBe(2);
    const room = await db.prepare('SELECT recovery_until as recoveryUntil FROM rooms WHERE id = ?').bind(roomId).first();
    const tokens = await db.prepare("SELECT token_hash as tokenHash, expires_at as expiresAt FROM creator_auth_tokens WHERE room_id = ? AND purpose = 'recover' ORDER BY created_at").bind(roomId).all();
    expect(tokens.results).toHaveLength(2);
    expect(tokens.results.map((token) => token.expiresAt)).toEqual([room.recoveryUntil, room.recoveryUntil]);

    vi.setSystemTime(Date.parse(room.recoveryUntil) - 1);
    const consumeOldLink = await worker.fetch(new Request('https://aporia.test/api/creator-links/consume', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: issuedTokens[0] }),
    }), { ...proxy.env, DB: db });
    const oldLinkResult = { status: consumeOldLink.status, body: await consumeOldLink.text() };
    expect(oldLinkResult.status).toBe(200);
  } finally {
    vi.useRealTimers();
    await db.prepare('DELETE FROM creator_sessions WHERE account_id = ?').bind(accountId).run();
    await db.prepare('DELETE FROM creator_auth_tokens WHERE room_id = ?').bind(roomId).run();
    await db.prepare("UPDATE rooms SET status = 'closed', deleted_at = NULL, recovery_until = NULL, recovery_snapshot_json = NULL WHERE id = ?").bind(roomId).run();
  }
});

it('does not consume a second recovery link or create a session after another link wins', async () => {
  const db = proxy.env.DB;
  const now = new Date().toISOString();
  const recoveryUntil = new Date(Date.now() + 86_400_000).toISOString();
  const recovery = JSON.stringify({ title: 'Recovered room', candidates: [], nextMeetingCode: null, registeredCount: 0, attendedCount: null });
  const rawTokens = ['synthetic-r22-recovery-link-one-token-valid', 'synthetic-r22-recovery-link-two-token-valid'];
  const hashes = await Promise.all(rawTokens.map(digest));
  await db.prepare('DELETE FROM creator_sessions WHERE account_id = ?').bind(accountId).run();
  await db.prepare('DELETE FROM creator_auth_tokens WHERE room_id = ?').bind(roomId).run();
  await db.prepare(`UPDATE rooms SET title = 'Deleted room', snapshot_json = ?, revision = 1, meeting_code = NULL, status = 'trashed', deleted_at = ?, recovery_until = ?, recovery_snapshot_json = ?, creator_account_id = ? WHERE id = ?`)
    .bind(JSON.stringify({ roomId, title: 'Deleted room', revision: 1, candidates: [], participants: [], facts: [], constraints: [], preferences: [], recoverySummary: { registeredCount: 0, attendedCount: null, nextMeetingCode: null } }), now, recoveryUntil, recovery, accountId, roomId).run();
  for (let index = 0; index < hashes.length; index++) {
    await db.prepare(`INSERT INTO creator_auth_tokens (token_hash, email, room_id, purpose, created_at, expires_at) VALUES (?, ?, ?, 'recover', ?, ?)`)
      .bind(hashes[index], ownerEmail, roomId, now, recoveryUntil).run();
  }

  let batches = 0;
  let releaseBatches;
  let reportBatches;
  const bothAtBatch = new Promise((resolve) => { reportBatches = resolve; });
  const batchesReleased = new Promise((resolve) => { releaseBatches = resolve; });
  const wrappedDb = new Proxy(db, { get(target, property) {
    if (property === 'batch') return async (statements) => {
      batches++;
      if (batches === 2) reportBatches();
      await batchesReleased;
      return target.batch(statements);
    };
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  const env = { ...proxy.env, DB: wrappedDb };
  const consume = (token) => worker.fetch(new Request('https://aporia.test/api/creator-links/consume', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }),
  }), env);
  const requests = rawTokens.map(consume);
  await bothAtBatch;
  releaseBatches();
  const responses = await Promise.all(requests);
  const statuses = await Promise.all(responses.map((response) => response.status));
  const room = await db.prepare('SELECT status FROM rooms WHERE id = ?').bind(roomId).first();
  const tokens = await db.prepare('SELECT used_at as usedAt FROM creator_auth_tokens WHERE room_id = ? AND purpose = ?').bind(roomId, 'recover').all();
  const sessions = await db.prepare('SELECT COUNT(*) as count FROM creator_sessions WHERE account_id = ?').bind(accountId).first();
  expect(statuses.sort()).toEqual([200, 409]);
  expect(room.status).toBe('recovered_read_only');
  expect(tokens.results.filter((token) => token.usedAt !== null)).toHaveLength(1);
  expect(sessions.count).toBe(1);

  await db.prepare('DELETE FROM creator_sessions WHERE account_id = ?').bind(accountId).run();
  await db.prepare('DELETE FROM creator_auth_tokens WHERE room_id = ?').bind(roomId).run();
  await db.prepare(`UPDATE rooms SET status = 'closed', deleted_at = NULL, recovery_until = NULL, recovery_snapshot_json = NULL WHERE id = ?`).bind(roomId).run();
});
