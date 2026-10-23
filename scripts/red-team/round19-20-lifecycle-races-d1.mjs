import { createHash } from 'node:crypto';
import { getPlatformProxy } from 'wrangler';
import { afterAll, expect, it, vi } from 'vitest';
import worker from '../../src/worker';
import { GeminiProvider } from '../../src/intelligence/gemini';

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
  `CREATE UNIQUE INDEX IF NOT EXISTS r29_events_room_revision ON events(room_id, revision)`,
  `CREATE TABLE IF NOT EXISTS proposals (id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), artifact_json TEXT NOT NULL, claims_json TEXT NOT NULL, provider_json TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS candidates (id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), candidate_json TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS candidate_proposals (id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), base_revision INTEGER NOT NULL, idempotency_key TEXT NOT NULL, drafts_json TEXT NOT NULL, provider_json TEXT NOT NULL, warnings_json TEXT NOT NULL, status TEXT NOT NULL, accepted_event_id TEXT, created_at TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS r34_candidate_proposals_room_idempotency ON candidate_proposals(room_id, idempotency_key)`,
  `CREATE TABLE IF NOT EXISTS room_messages (id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), participant_id TEXT NOT NULL REFERENCES participants(id), body TEXT NOT NULL, idempotency_key TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(room_id, participant_id, idempotency_key))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS r23_room_messages_idempotency ON room_messages(room_id, participant_id, idempotency_key)`,
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

it('allows two scheduled purges that selected the same expired room to overlap safely', async () => {
  const db = proxy.env.DB;
  const now = new Date().toISOString();
  await db.prepare('DELETE FROM creator_sessions').run();
  await db.prepare('DELETE FROM creator_auth_tokens').run();
  await db.prepare('DELETE FROM room_messages WHERE room_id = ?').bind(roomId).run();
  await db.prepare('DELETE FROM proposal_claim_decisions WHERE proposal_id IN (SELECT id FROM proposals WHERE room_id = ?)').bind(roomId).run();
  await db.prepare('DELETE FROM proposals WHERE room_id = ?').bind(roomId).run();
  await db.prepare('DELETE FROM candidate_proposals WHERE room_id = ?').bind(roomId).run();
  await db.prepare('DELETE FROM candidates WHERE room_id = ?').bind(roomId).run();
  await db.prepare('DELETE FROM events WHERE room_id = ?').bind(roomId).run();
  await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(roomId).run();
  await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(roomId).run();
  await db.prepare('DELETE FROM rooms WHERE id = ?').bind(roomId).run();
  await db.prepare('DELETE FROM creator_accounts WHERE id = ?').bind(accountId).run();
  await db.prepare('INSERT INTO creator_accounts (id, email, created_at) VALUES (?, ?, ?)').bind(accountId, ownerEmail, now).run();
  await db.prepare(`INSERT INTO rooms (id, title, revision, snapshot_json, created_at, status, creator_account_id, deleted_at, recovery_until, recovery_snapshot_json)
    VALUES (?, 'Expired room', 1, '{}', ?, 'trashed', ?, ?, ?, '{}')`).bind(roomId, now, accountId, now, new Date(Date.now() - 1_000).toISOString()).run();
  await db.prepare(`INSERT INTO participants (id, room_id, display_name, created_at) VALUES ('r23-participant', ?, 'Synthetic person', ?)`).bind(roomId, now).run();
  await db.prepare(`INSERT INTO sessions (token_hash, room_id, participant_id, created_at) VALUES ('r23-session', ?, 'r23-participant', ?)`).bind(roomId, now).run();
  await db.prepare(`INSERT INTO events (id, room_id, revision, actor_id, event_type, payload_json, created_at) VALUES ('r23-event', ?, 1, 'r23-participant', 'test', '{}', ?)`).bind(roomId, now).run();
  await db.prepare(`INSERT INTO proposals (id, room_id, artifact_json, claims_json, provider_json, status, created_at) VALUES ('r23-proposal', ?, '{}', '[]', '{}', 'accepted', ?)`).bind(roomId, now).run();
  await db.prepare(`INSERT INTO proposal_claim_decisions (proposal_id, claim_id, decision, created_at) VALUES ('r23-proposal', 'r23-claim', 'confirmed', ?)`).bind(now).run();
  await db.prepare(`INSERT INTO candidates (id, room_id, candidate_json, created_at) VALUES ('r23-candidate', ?, '{}', ?)`).bind(roomId, now).run();
  await db.prepare(`INSERT INTO candidate_proposals (id, room_id, base_revision, idempotency_key, drafts_json, provider_json, warnings_json, status, created_at) VALUES ('r23-candidate-proposal', ?, 1, 'r23-key', '[]', '{}', '[]', 'pending', ?)`).bind(roomId, now).run();
  await db.prepare(`INSERT INTO room_messages (id, room_id, participant_id, body, idempotency_key, created_at) VALUES ('r23-message', ?, 'r23-participant', 'synthetic', 'r23-message-key', ?)`).bind(roomId, now).run();
  await db.prepare(`INSERT INTO creator_auth_tokens (token_hash, email, room_id, purpose, created_at, expires_at) VALUES ('r23-token', ?, ?, 'recover', ?, ?)`)
    .bind(ownerEmail, roomId, now, new Date(Date.now() - 1_000).toISOString()).run();
  await db.prepare(`INSERT INTO creator_sessions (token_hash, account_id, created_at, expires_at) VALUES ('r23-creator-session', ?, ?, ?)`)
    .bind(accountId, now, new Date(Date.now() - 1_000).toISOString()).run();

  let selections = 0;
  let releaseSelections;
  let reportSelections;
  const bothSelected = new Promise((resolve) => { reportSelections = resolve; });
  const selectionsReleased = new Promise((resolve) => { releaseSelections = resolve; });
  const wrappedDb = new Proxy(db, { get(target, property) {
    if (property === 'prepare') return (sql) => {
      const statement = target.prepare(sql);
      if (!sql.startsWith("SELECT id FROM rooms WHERE status = 'trashed' AND recovery_until <= ?")) return statement;
      return new Proxy(statement, { get(prepared, preparedProperty) {
        const method = Reflect.get(prepared, preparedProperty, prepared);
        if (preparedProperty !== 'bind') return typeof method === 'function' ? method.bind(prepared) : method;
        return (...values) => {
          const bound = method.apply(prepared, values);
          return new Proxy(bound, { get(boundStatement, boundProperty) {
            const boundMethod = Reflect.get(boundStatement, boundProperty, boundStatement);
            if (boundProperty !== 'all') return typeof boundMethod === 'function' ? boundMethod.bind(boundStatement) : boundMethod;
            return async (...args) => {
              const result = await boundMethod.apply(boundStatement, args);
              selections++;
              if (selections === 2) reportSelections();
              await selectionsReleased;
              return result;
            };
          } });
        };
      } });
    };
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  const env = { ...proxy.env, DB: wrappedDb };
  const controller = { scheduledTime: Date.now(), cron: '0 * * * *' };
  const purges = [worker.scheduled(controller, env), worker.scheduled(controller, env)];
  await bothSelected;
  releaseSelections();
  await Promise.all(purges);

  const room = await db.prepare('SELECT id FROM rooms WHERE id = ?').bind(roomId).first();
  const children = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM room_messages WHERE room_id = ?').bind(roomId).first(),
    db.prepare('SELECT COUNT(*) as count FROM proposal_claim_decisions WHERE proposal_id = ?').bind('r23-proposal').first(),
    db.prepare('SELECT COUNT(*) as count FROM proposals WHERE room_id = ?').bind(roomId).first(),
    db.prepare('SELECT COUNT(*) as count FROM candidate_proposals WHERE room_id = ?').bind(roomId).first(),
    db.prepare('SELECT COUNT(*) as count FROM candidates WHERE room_id = ?').bind(roomId).first(),
    db.prepare('SELECT COUNT(*) as count FROM events WHERE room_id = ?').bind(roomId).first(),
    db.prepare('SELECT COUNT(*) as count FROM sessions WHERE room_id = ?').bind(roomId).first(),
    db.prepare('SELECT COUNT(*) as count FROM participants WHERE room_id = ?').bind(roomId).first(),
    db.prepare('SELECT COUNT(*) as count FROM creator_auth_tokens WHERE room_id = ?').bind(roomId).first(),
    db.prepare('SELECT COUNT(*) as count FROM creator_sessions WHERE account_id = ?').bind(accountId).first(),
  ]);
  expect(room).toBeNull();
  expect(children.map((result) => result.count)).toEqual(Array(10).fill(0));
  expect(await db.prepare('SELECT id FROM creator_accounts WHERE id = ?').bind(accountId).first()).toBeNull();
});

it('preserves lifecycle, access, and cleanup invariants across one public-to-recovery journey', async () => {
  const db = proxy.env.DB;
  const emailBodies = [];
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    emailBodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: `synthetic-r24-email-${emailBodies.length}` }), { status: 200 });
  }));
  const allow = { limit: async () => ({ success: true }) };
  const env = {
    ...proxy.env, DB: db,
    ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
    RESEND_API_KEY: 'synthetic-only', CREATOR_EMAIL_FROM: 'no-reply@example.test', APORIA_APP_ORIGIN: 'https://aporia.test',
    ROOM_LOOKUP_LIMITER: allow, ROOM_CREATE_LIMITER: allow, ROOM_JOIN_LIMITER: allow, CREATOR_ACCESS_LIMITER: allow,
  };
  let created;
  let account;
  try {
    const createResponse = await worker.fetch(new Request('https://aporia.test/api/rooms', {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.24' },
      body: JSON.stringify({ title: 'R24 synthetic gathering', displayName: 'R24 host' }),
    }), env);
    expect(createResponse.status).toBe(200);
    created = await createResponse.json();
    const roomPath = `/api/rooms/${created.roomId}`;

    const lookup = await worker.fetch(new Request(`https://aporia.test/api/rooms/by-code/${created.meetingCode}`, { headers: { 'cf-connecting-ip': '192.0.2.24' } }), env);
    expect(lookup.status).toBe(200);
    expect((await lookup.json()).roomId).toBe(created.roomId);
    const joinResponse = await worker.fetch(new Request(`https://aporia.test${roomPath}/participants`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.24' }, body: JSON.stringify({ displayName: 'R24 attendee' }),
    }), env);
    expect(joinResponse.status).toBe(200);
    const attendee = await joinResponse.json();

    for (const [sessionToken, message, key] of [[created.sessionToken, 'Host update', 'r24-host'], [attendee.sessionToken, 'Attendee update', 'r24-attendee']]) {
      const response = await worker.fetch(new Request(`https://aporia.test${roomPath}/messages`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': sessionToken },
        body: JSON.stringify({ message, idempotencyKey: key }),
      }), env);
      expect(response.status, await response.clone().text()).toBe(201);
    }
    const accessRequest = await worker.fetch(new Request(`https://aporia.test${roomPath}/creator-access`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken, 'cf-connecting-ip': '192.0.2.24' },
      body: JSON.stringify({ email: ownerEmail }),
    }), env);
    expect(accessRequest.status).toBe(200);
    expect(emailBodies).toHaveLength(1);
    const loginLink = emailBodies[0].html.match(/href="([^"]+)"/)[1];
    const loginToken = new URL(loginLink).hash.slice(1).split('&').find((part) => part.startsWith('creatorToken=')).slice('creatorToken='.length);
    const login = await worker.fetch(new Request('https://aporia.test/api/creator-links/consume', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: decodeURIComponent(loginToken) }),
    }), env);
    expect(login.status).toBe(200);
    const creatorToken = (await login.json()).creatorToken;
    account = await db.prepare('SELECT id FROM creator_accounts WHERE email = ?').bind(ownerEmail).first();

    const close = await worker.fetch(new Request(`https://aporia.test${roomPath}/close`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-creator': creatorToken }, body: '{}',
    }), env);
    expect(close.status).toBe(200);
    const reopen = await worker.fetch(new Request(`https://aporia.test${roomPath}/reopen`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-creator': creatorToken }, body: '{}',
    }), env);
    expect(reopen.status).toBe(200);
    const afterReopen = await worker.fetch(new Request(`https://aporia.test${roomPath}`), env);
    const reopenedBody = await afterReopen.json();
    expect(afterReopen.status).toBe(200);
    expect(reopenedBody.status).toBe('reopened_read_only');
    expect(JSON.stringify(reopenedBody.snapshot)).not.toContain('R24 host');
    expect(JSON.stringify(reopenedBody.snapshot)).not.toContain('R24 attendee');
    const reopenedCodeLookup = await worker.fetch(new Request(`https://aporia.test/api/rooms/by-code/${created.meetingCode}`, { headers: { 'cf-connecting-ip': '192.0.2.24' } }), env);
    expect(reopenedCodeLookup.status).toBe(200);
    expect((await reopenedCodeLookup.json()).status).toBe('reopened_read_only');
    const blockedRejoin = await worker.fetch(new Request(`https://aporia.test${roomPath}/participants`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.24' }, body: JSON.stringify({ displayName: 'R24 late attendee' }),
    }), env);
    expect(blockedRejoin.status).toBe(409);
    const messagesAfterReopen = await worker.fetch(new Request(`https://aporia.test${roomPath}/messages`), env);
    expect((await messagesAfterReopen.json()).messages).toEqual([]);
    const stalePost = await worker.fetch(new Request(`https://aporia.test${roomPath}/messages`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': attendee.sessionToken },
      body: JSON.stringify({ message: 'stale attendee', idempotencyKey: 'r24-stale' }),
    }), env);
    expect(stalePost.status).toBe(401);

    const remove = await worker.fetch(new Request(`https://aporia.test${roomPath}/delete`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-creator': creatorToken }, body: '{}',
    }), env);
    expect(remove.status).toBe(200);
    expect(emailBodies).toHaveLength(2);
    const trashedRead = await worker.fetch(new Request(`https://aporia.test${roomPath}`), env);
    const trashedMessages = await worker.fetch(new Request(`https://aporia.test${roomPath}/messages`), env);
    const oldCodeLookup = await worker.fetch(new Request(`https://aporia.test/api/rooms/by-code/${created.meetingCode}`, { headers: { 'cf-connecting-ip': '192.0.2.24' } }), env);
    expect([trashedRead.status, trashedMessages.status, oldCodeLookup.status]).toEqual([404, 404, 404]);

    const recoveryLink = emailBodies[1].html.match(/href="([^"]+)"/)[1];
    const recoveryToken = new URL(recoveryLink).hash.slice(1).split('&').find((part) => part.startsWith('creatorToken=')).slice('creatorToken='.length);
    const recover = await worker.fetch(new Request('https://aporia.test/api/creator-links/consume', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: decodeURIComponent(recoveryToken) }),
    }), env);
    expect(recover.status).toBe(200);
    const recoveryBody = await recover.json();
    const anonymousRecoveredRead = await worker.fetch(new Request(`https://aporia.test${roomPath}`), env);
    const ownerRecoveredRead = await worker.fetch(new Request(`https://aporia.test${roomPath}`, { headers: { 'x-aporia-creator': recoveryBody.creatorToken } }), env);
    expect(anonymousRecoveredRead.status).toBe(401);
    expect(ownerRecoveredRead.status).toBe(200);
    expect((await ownerRecoveredRead.json()).status).toBe('recovered_read_only');
    const finalCounts = await Promise.all([
      db.prepare('SELECT COUNT(*) as count FROM participants WHERE room_id = ?').bind(created.roomId).first(),
      db.prepare('SELECT COUNT(*) as count FROM sessions WHERE room_id = ?').bind(created.roomId).first(),
      db.prepare('SELECT COUNT(*) as count FROM room_messages WHERE room_id = ?').bind(created.roomId).first(),
      db.prepare('SELECT COUNT(*) as count FROM events WHERE room_id = ?').bind(created.roomId).first(),
    ]);
    expect(finalCounts.map((row) => row.count)).toEqual([0, 0, 0, 0]);
  } finally {
    vi.unstubAllGlobals();
    if (created?.roomId) {
      await db.prepare('DELETE FROM creator_auth_tokens WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM creator_sessions WHERE account_id = ?').bind(account?.id ?? '').run();
      await db.prepare('DELETE FROM room_messages WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM proposal_claim_decisions WHERE proposal_id IN (SELECT id FROM proposals WHERE room_id = ?)').bind(created.roomId).run();
      await db.prepare('DELETE FROM proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM candidate_proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM candidates WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM events WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM rooms WHERE id = ?').bind(created.roomId).run();
      if (account?.id) await db.prepare('DELETE FROM creator_accounts WHERE id = ?').bind(account.id).run();
    }
  }
});

it('restores only the authenticated contributor’s own pending proposals', async () => {
  const db = proxy.env.DB;
  const allow = { limit: async () => ({ success: true }) };
  const env = {
    ...proxy.env, DB: db,
    ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
    ROOM_LOOKUP_LIMITER: allow, ROOM_CREATE_LIMITER: allow, ROOM_JOIN_LIMITER: allow, CREATOR_ACCESS_LIMITER: allow,
  };
  let created;
  try {
    const createResponse = await worker.fetch(new Request('https://aporia.test/api/rooms', {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.25' },
      body: JSON.stringify({ title: 'R25 pending proposal', displayName: 'R25 uploader' }),
    }), env);
    expect(createResponse.status).toBe(200);
    created = await createResponse.json();
    const pending = {
      id: 'r25-pending-proposal',
      artifact: { id: 'r25-artifact', kind: 'text', content: '', contentHash: '', createdAt: new Date().toISOString(), participantId: created.participantId },
      claims: [{ id: 'r25-claim', kind: 'proposal', participantId: created.participantId, value: { text: 'synthetic private contribution' }, sourceText: 'synthetic private contribution', confidence: 'high', ambiguity: [] }],
      warnings: [], provider: { name: 'gemini', model: 'synthetic-model' }, status: 'pending',
    };
    vi.spyOn(GeminiProvider.prototype, 'extract').mockResolvedValue(pending);
    const submit = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/proposals`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken },
      body: JSON.stringify({ kind: 'text', content: 'synthetic private contribution' }),
    }), env);
    expect(submit.status).toBe(200);
    const proposalRow = await db.prepare('SELECT id, status, claims_json as claims FROM proposals WHERE id = ?').bind(pending.id).first();
    expect(proposalRow.status).toBe('pending');
    expect(JSON.parse(proposalRow.claims)[0].sourceText).toBe('synthetic private contribution');

    const reload = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/proposals`, {
      headers: { 'x-aporia-session': created.sessionToken },
    }), env);
    expect(reload.status).toBe(200);
    expect((await reload.json()).proposals.map((item) => item.id)).toEqual([pending.id]);
    const otherJoin = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/participants`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName: 'R25 other participant' }),
    }), env);
    expect(otherJoin.status).toBe(200);
    const other = await otherJoin.json();
    const otherList = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/proposals`, { headers: { 'x-aporia-session': other.sessionToken } }), env);
    expect(otherList.status).toBe(200);
    expect((await otherList.json()).proposals).toEqual([]);
    const anonymous = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/proposals`), env);
    expect(anonymous.status).toBe(401);
    const room = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}`), env);
    expect(room.status).toBe(200);
    expect((await room.json()).snapshot.facts).toEqual([]);
  } finally {
    vi.restoreAllMocks();
    if (created?.roomId) {
      await db.prepare('DELETE FROM proposal_claim_decisions WHERE proposal_id IN (SELECT id FROM proposals WHERE room_id = ?)').bind(created.roomId).run();
      await db.prepare('DELETE FROM proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM events WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM rooms WHERE id = ?').bind(created.roomId).run();
    }
  }
});

it('restores pending candidate suggestions to room participants after reload', async () => {
  const db = proxy.env.DB;
  const allow = { limit: async () => ({ success: true }) };
  const env = { ...proxy.env, DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) }, ROOM_LOOKUP_LIMITER: allow, ROOM_CREATE_LIMITER: allow, ROOM_JOIN_LIMITER: allow };
  let created;
  try {
    const create = await worker.fetch(new Request('https://aporia.test/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.26' }, body: JSON.stringify({ title: 'R26 generated options', displayName: 'R26 owner' }) }), env);
    expect(create.status).toBe(200);
    created = await create.json();
    const otherJoin = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/participants`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName: 'R26 reviewer' }) }), env);
    expect(otherJoin.status).toBe(200);
    const other = await otherJoin.json();
    vi.spyOn(GeminiProvider.prototype, 'propose').mockResolvedValue({
      candidates: [{ title: 'Synthetic cafe', weekday: 6, startMinute: 1200, endMinute: 1320, priceCents: null, currency: null, area: null }],
      warnings: [], provider: { name: 'gemini', model: 'synthetic-model' },
    });
    const discovery = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/candidate-discovery`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken },
      body: JSON.stringify({ expectedRevision: 2, idempotencyKey: 'r26-discovery' }),
    }), env);
    expect(discovery.status).toBe(200);
    const { proposal } = await discovery.json();
    const stored = await db.prepare('SELECT status, drafts_json as drafts FROM candidate_proposals WHERE id = ?').bind(proposal.id).first();
    expect(stored.status).toBe('pending');
    expect(JSON.parse(stored.drafts)[0].title).toBe('Synthetic cafe');
    const reload = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/candidate-discovery`, { headers: { 'x-aporia-session': created.sessionToken } }), env);
    expect(reload.status).toBe(200);
    expect((await reload.json()).proposals.map((item) => item.id)).toEqual([proposal.id]);
    const otherList = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/candidate-discovery`, { headers: { 'x-aporia-session': other.sessionToken } }), env);
    expect((await otherList.json()).proposals.map((item) => item.id)).toEqual([proposal.id]);
    const anonymous = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/candidate-discovery`), env);
    expect(anonymous.status).toBe(401);
    const accept = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/candidate-discovery/${proposal.id}/accept`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': other.sessionToken },
      body: JSON.stringify({ expectedRevision: 2, idempotencyKey: 'r26-accept' }),
    }), env);
    expect(accept.status).toBe(200);
    expect((await accept.json()).snapshot.candidates).toHaveLength(1);
    const afterAcceptance = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/candidate-discovery`, { headers: { 'x-aporia-session': created.sessionToken } }), env);
    expect((await afterAcceptance.json()).proposals).toEqual([]);
  } finally {
    vi.restoreAllMocks();
    if (created?.roomId) {
      await db.prepare('DELETE FROM candidate_proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM events WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM rooms WHERE id = ?').bind(created.roomId).run();
    }
  }
});

it('keeps AI contribution evidence through close and removes both AI queues on reopen', async () => {
  proxy ??= await proxyPromise;
  const db = proxy.env.DB;
  const allow = { limit: async () => ({ success: true }) };
  const env = { ...proxy.env, DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) }, ROOM_CREATE_LIMITER: allow, ROOM_JOIN_LIMITER: allow };
  const creator = 'r27-creator-session';
  let created;
  let accountId;
  try {
    const create = await worker.fetch(new Request('https://aporia.test/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.27' }, body: JSON.stringify({ title: 'R27 event', displayName: 'R27 owner' }) }), env);
    expect(create.status).toBe(200);
    created = await create.json();
    const extraction = {
      id: 'r27-reviewed-proposal',
      artifact: { id: 'r27-artifact', kind: 'text', content: 'I can do Saturday after 8', contentHash: 'synthetic', createdAt: new Date().toISOString(), participantId: created.participantId },
      claims: [{ id: 'r27-claim', kind: 'proposal', participantId: created.participantId, value: { text: 'Saturday after 8' }, sourceText: 'I can do Saturday after 8', confidence: 'high', ambiguity: [] }],
      warnings: [], provider: { name: 'gemini', model: 'synthetic-model' }, status: 'pending',
    };
    vi.spyOn(GeminiProvider.prototype, 'extract').mockResolvedValue(extraction);
    vi.spyOn(GeminiProvider.prototype, 'propose').mockResolvedValue({ candidates: [{ title: 'R27 cafe', weekday: 6, startMinute: 1200, endMinute: 1320, priceCents: null, currency: null, area: null }], warnings: [], provider: { name: 'gemini', model: 'synthetic-model' } });
    const submit = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/proposals`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ kind: 'text', content: extraction.artifact.content }) }), env);
    expect(submit.status).toBe(200);
    const confirm = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/proposals/${extraction.id}/confirm`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ claimId: 'r27-claim', participantId: created.participantId, expectedRevision: 1 }) }), env);
    expect(confirm.status).toBe(200);
    const reviewedList = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/proposals`, { headers: { 'x-aporia-session': created.sessionToken } }), env);
    expect((await reviewedList.json()).proposals).toEqual([]);
    const discover = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/candidate-discovery`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ expectedRevision: 2, idempotencyKey: 'r27-discovery' }) }), env);
    expect(discover.status).toBe(200);

    accountId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    await db.prepare('INSERT INTO creator_accounts (id, email, created_at) VALUES (?, ?, ?)').bind(accountId, 'r27-owner@example.test', timestamp).run();
    await db.prepare('UPDATE rooms SET creator_account_id = ? WHERE id = ?').bind(accountId, created.roomId).run();
    await db.prepare('INSERT INTO creator_sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(digest(creator), accountId, timestamp, new Date(Date.now() + 86_400_000).toISOString()).run();
    const roomPath = `https://aporia.test/api/rooms/${created.roomId}`;
    const close = await worker.fetch(new Request(`${roomPath}/close`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-creator': creator }, body: '{}' }), env);
    expect(close.status).toBe(200);
    const retained = await db.prepare('SELECT p.status, p.artifact_json as artifact, p.claims_json as claims, (SELECT COUNT(*) FROM candidate_proposals WHERE room_id = p.room_id) as candidateCount FROM proposals p WHERE p.id = ?').bind(extraction.id).first();
    expect(retained.status).toBe('confirmed');
    expect(JSON.parse(retained.artifact).content).toBe('');
    expect(JSON.parse(retained.claims)[0].sourceText).toBe('');
    expect(JSON.parse(retained.claims)[0].value).toEqual(extraction.claims[0].value);
    expect(retained.candidateCount).toBe(1);
    const pendingWhileClosed = await worker.fetch(new Request(`${roomPath}/proposals`, { headers: { 'x-aporia-session': created.sessionToken } }), env);
    expect(pendingWhileClosed.status).toBe(409);

    const reopen = await worker.fetch(new Request(`${roomPath}/reopen`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-creator': creator }, body: '{}' }), env);
    expect(reopen.status).toBe(200);
    const remaining = await Promise.all([
      db.prepare('SELECT COUNT(*) as count FROM proposals WHERE room_id = ?').bind(created.roomId).first(),
      db.prepare('SELECT COUNT(*) as count FROM candidate_proposals WHERE room_id = ?').bind(created.roomId).first(),
      db.prepare('SELECT COUNT(*) as count FROM proposal_claim_decisions WHERE proposal_id = ?').bind(extraction.id).first(),
    ]);
    expect(remaining.map((row) => row.count)).toEqual([0, 0, 0]);
  } finally {
    vi.restoreAllMocks();
    if (created?.roomId) {
      await db.prepare('DELETE FROM proposal_claim_decisions WHERE proposal_id IN (SELECT id FROM proposals WHERE room_id = ?)').bind(created.roomId).run();
      await db.prepare('DELETE FROM proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM candidate_proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM events WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM rooms WHERE id = ?').bind(created.roomId).run();
    }
    if (accountId) {
      await db.prepare('DELETE FROM creator_sessions WHERE account_id = ?').bind(accountId).run();
      await db.prepare('DELETE FROM creator_accounts WHERE id = ?').bind(accountId).run();
    }
  }
});

it('does not commit a claim when room close wins after review prechecks', async () => {
  proxy ??= await proxyPromise;
  const db = proxy.env.DB;
  const allow = { limit: async () => ({ success: true }) };
  const env = { ...proxy.env, DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) }, ROOM_CREATE_LIMITER: allow };
  const creator = 'r28-creator-session';
  let created;
  let accountId;
  let releaseBatch;
  let signalBatch;
  let entered = false;
  const batchReached = new Promise((resolve) => { signalBatch = resolve; });
  const batchGate = new Promise((resolve) => { releaseBatch = resolve; });
  try {
    const create = await worker.fetch(new Request('https://aporia.test/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.28' }, body: JSON.stringify({ title: 'R28 review race', displayName: 'R28 owner' }) }), env);
    expect(create.status).toBe(200);
    created = await create.json();
    const proposal = { id: 'r28-proposal', artifact: { id: 'r28-artifact', kind: 'text', content: 'Saturday works', contentHash: 'synthetic', createdAt: new Date().toISOString(), participantId: created.participantId }, claims: [{ id: 'r28-claim', kind: 'proposal', participantId: created.participantId, value: { text: 'Saturday works' }, sourceText: 'Saturday works', confidence: 'high', ambiguity: [] }], warnings: [], provider: { name: 'gemini', model: 'synthetic-model' }, status: 'pending' };
    vi.spyOn(GeminiProvider.prototype, 'extract').mockResolvedValue(proposal);
    const submit = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/proposals`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ kind: 'text', content: proposal.artifact.content }) }), env);
    expect(submit.status).toBe(200);
    accountId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    await db.prepare('INSERT INTO creator_accounts (id, email, created_at) VALUES (?, ?, ?)').bind(accountId, 'r28-owner@example.test', timestamp).run();
    await db.prepare('UPDATE rooms SET creator_account_id = ? WHERE id = ?').bind(accountId, created.roomId).run();
    await db.prepare('INSERT INTO creator_sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(digest(creator), accountId, timestamp, new Date(Date.now() + 86_400_000).toISOString()).run();

    let armed = true;
    const gatedDb = new Proxy(db, { get(target, property) {
      if (property === 'batch') return async (statements) => {
        if (armed && !entered) { entered = true; signalBatch(); await batchGate; }
        return target.batch(statements);
      };
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    const roomPath = `https://aporia.test/api/rooms/${created.roomId}`;
    const confirming = worker.fetch(new Request(`${roomPath}/proposals/${proposal.id}/confirm`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ claimId: 'r28-claim', participantId: created.participantId, expectedRevision: 1 }) }), { ...env, DB: gatedDb });
    await batchReached;
    const close = await worker.fetch(new Request(`${roomPath}/close`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-creator': creator }, body: '{}' }), env);
    expect(close.status).toBe(200);
    releaseBatch();
    const confirm = await confirming;
    expect(confirm.status).toBe(409);
    const storedRoom = await db.prepare('SELECT status, snapshot_json as snapshot FROM rooms WHERE id = ?').bind(created.roomId).first();
    expect(storedRoom.status).toBe('closed');
    expect(JSON.parse(storedRoom.snapshot).facts).toEqual([]);
    expect(await db.prepare('SELECT COUNT(*) as count FROM proposal_claim_decisions WHERE proposal_id = ?').bind(proposal.id).first().then((row) => row.count)).toBe(0);
    expect((await db.prepare('SELECT status FROM proposals WHERE id = ?').bind(proposal.id).first()).status).toBe('pending');
  } finally {
    releaseBatch?.();
    vi.restoreAllMocks();
    if (created?.roomId) {
      await db.prepare('DELETE FROM proposal_claim_decisions WHERE proposal_id IN (SELECT id FROM proposals WHERE room_id = ?)').bind(created.roomId).run();
      await db.prepare('DELETE FROM proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM events WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM rooms WHERE id = ?').bind(created.roomId).run();
    }
    if (accountId) {
      await db.prepare('DELETE FROM creator_sessions WHERE account_id = ?').bind(accountId).run();
      await db.prepare('DELETE FROM creator_accounts WHERE id = ?').bind(accountId).run();
    }
  }
});

it('keeps a confirmed fact when claim review wins immediately before room close', async () => {
  proxy ??= await proxyPromise;
  const db = proxy.env.DB;
  const allow = { limit: async () => ({ success: true }) };
  const env = { ...proxy.env, DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) }, ROOM_CREATE_LIMITER: allow };
  const creator = 'r28b-creator-session';
  let created;
  let accountId;
  try {
    const create = await worker.fetch(new Request('https://aporia.test/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.28' }, body: JSON.stringify({ title: 'R28b review then close', displayName: 'R28b owner' }) }), env);
    expect(create.status).toBe(200);
    created = await create.json();
    const proposal = { id: 'r28b-proposal', artifact: { id: 'r28b-artifact', kind: 'text', content: 'Sunday works', contentHash: 'synthetic', createdAt: new Date().toISOString(), participantId: created.participantId }, claims: [{ id: 'r28b-claim', kind: 'proposal', participantId: created.participantId, value: { text: 'Sunday works' }, sourceText: 'Sunday works', confidence: 'high', ambiguity: [] }], warnings: [], provider: { name: 'gemini', model: 'synthetic-model' }, status: 'pending' };
    vi.spyOn(GeminiProvider.prototype, 'extract').mockResolvedValue(proposal);
    const submit = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/proposals`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ kind: 'text', content: proposal.artifact.content }) }), env);
    expect(submit.status).toBe(200);
    accountId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    await db.prepare('INSERT INTO creator_accounts (id, email, created_at) VALUES (?, ?, ?)').bind(accountId, 'r28b-owner@example.test', timestamp).run();
    await db.prepare('UPDATE rooms SET creator_account_id = ? WHERE id = ?').bind(accountId, created.roomId).run();
    await db.prepare('INSERT INTO creator_sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(digest(creator), accountId, timestamp, new Date(Date.now() + 86_400_000).toISOString()).run();
    const roomPath = `https://aporia.test/api/rooms/${created.roomId}`;
    const confirm = await worker.fetch(new Request(`${roomPath}/proposals/${proposal.id}/confirm`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ claimId: 'r28b-claim', participantId: created.participantId, expectedRevision: 1 }) }), env);
    expect(confirm.status).toBe(200);
    const close = await worker.fetch(new Request(`${roomPath}/close`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-creator': creator }, body: '{}' }), env);
    expect(close.status).toBe(200);
    const stored = await db.prepare('SELECT status, snapshot_json as snapshot FROM rooms WHERE id = ?').bind(created.roomId).first();
    expect(stored.status).toBe('closed');
    expect(JSON.parse(stored.snapshot).facts.map((fact) => fact.value.text)).toEqual(['Sunday works']);
    expect((await db.prepare('SELECT status FROM proposals WHERE id = ?').bind(proposal.id).first()).status).toBe('confirmed');
  } finally {
    vi.restoreAllMocks();
    if (created?.roomId) {
      await db.prepare('DELETE FROM proposal_claim_decisions WHERE proposal_id IN (SELECT id FROM proposals WHERE room_id = ?)').bind(created.roomId).run();
      await db.prepare('DELETE FROM proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM events WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM rooms WHERE id = ?').bind(created.roomId).run();
    }
    if (accountId) {
      await db.prepare('DELETE FROM creator_sessions WHERE account_id = ?').bind(accountId).run();
      await db.prepare('DELETE FROM creator_accounts WHERE id = ?').bind(accountId).run();
    }
  }
});

it('returns a conflict without partial writes when a candidate changes during AI acceptance', async () => {
  proxy ??= await proxyPromise;
  const db = proxy.env.DB;
  const allow = { limit: async () => ({ success: true }) };
  const env = { ...proxy.env, DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) }, ROOM_CREATE_LIMITER: allow };
  let created;
  let releaseBatch;
  let signalBatch;
  let entered = false;
  const batchReached = new Promise((resolve) => { signalBatch = resolve; });
  const batchGate = new Promise((resolve) => { releaseBatch = resolve; });
  try {
    const create = await worker.fetch(new Request('https://aporia.test/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.29' }, body: JSON.stringify({ title: 'R29 competing candidate changes', displayName: 'R29 owner' }) }), env);
    expect(create.status).toBe(200);
    created = await create.json();
    vi.spyOn(GeminiProvider.prototype, 'propose').mockResolvedValue({ candidates: [{ title: 'Synthetic generated option', weekday: 6, startMinute: 1200, endMinute: 1320, priceCents: null, currency: null, area: null }], warnings: [], provider: { name: 'gemini', model: 'synthetic-model' } });
    const discovery = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/candidate-discovery`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ expectedRevision: 1, idempotencyKey: 'r29-discovery' }) }), env);
    expect(discovery.status).toBe(200);
    const { proposal } = await discovery.json();

    const gatedDb = new Proxy(db, { get(target, property) {
      if (property === 'batch') return async (statements) => {
        if (!entered) { entered = true; signalBatch(); await batchGate; }
        return target.batch(statements);
      };
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    const accepting = worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/candidate-discovery/${proposal.id}/accept`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ expectedRevision: 1, idempotencyKey: 'r29-accept' }) }), { ...env, DB: gatedDb });
    await batchReached;
    const competingWrite = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/candidates`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ title: 'Participant option', weekday: 6, startMinute: 1080, endMinute: 1200, priceCents: null, currency: 'ARS', area: null, expectedRevision: 1 }) }), env);
    expect(competingWrite.status).toBe(200);
    releaseBatch();
    const accept = await accepting;
    expect(accept.status).toBe(409);
    const stored = await db.prepare('SELECT revision, snapshot_json as snapshot FROM rooms WHERE id = ?').bind(created.roomId).first();
    expect(stored.revision).toBe(2);
    expect(JSON.parse(stored.snapshot).candidates.map((candidate) => candidate.title)).toEqual(['Participant option']);
    expect((await db.prepare('SELECT status FROM candidate_proposals WHERE id = ?').bind(proposal.id).first()).status).toBe('pending');
    expect(await db.prepare('SELECT COUNT(*) as count FROM events WHERE room_id = ?').bind(created.roomId).first().then((row) => row.count)).toBe(2);
  } finally {
    releaseBatch?.();
    vi.restoreAllMocks();
    if (created?.roomId) {
      await db.prepare('DELETE FROM candidate_proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM events WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM rooms WHERE id = ?').bind(created.roomId).run();
    }
  }
});

it('returns a conflict without recording a claim when another candidate advances the room', async () => {
  proxy ??= await proxyPromise;
  const db = proxy.env.DB;
  const allow = { limit: async () => ({ success: true }) };
  const env = { ...proxy.env, DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) }, ROOM_CREATE_LIMITER: allow };
  let created;
  let releaseBatch;
  let signalBatch;
  let entered = false;
  const batchReached = new Promise((resolve) => { signalBatch = resolve; });
  const batchGate = new Promise((resolve) => { releaseBatch = resolve; });
  try {
    const create = await worker.fetch(new Request('https://aporia.test/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.30' }, body: JSON.stringify({ title: 'R30 competing claim confirmation', displayName: 'R30 owner' }) }), env);
    expect(create.status).toBe(200);
    created = await create.json();
    const proposal = { id: 'r30-proposal', artifact: { id: 'r30-artifact', kind: 'text', content: 'Saturday works', contentHash: 'synthetic', createdAt: new Date().toISOString(), participantId: created.participantId }, claims: [{ id: 'r30-claim', kind: 'proposal', participantId: created.participantId, value: { text: 'Saturday works' }, sourceText: 'Saturday works', confidence: 'high', ambiguity: [] }], warnings: [], provider: { name: 'gemini', model: 'synthetic-model' }, status: 'pending' };
    vi.spyOn(GeminiProvider.prototype, 'extract').mockResolvedValue(proposal);
    const submit = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/proposals`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ kind: 'text', content: proposal.artifact.content }) }), env);
    expect(submit.status).toBe(200);
    const gatedDb = new Proxy(db, { get(target, property) {
      if (property === 'batch') return async (statements) => {
        if (!entered) { entered = true; signalBatch(); await batchGate; }
        return target.batch(statements);
      };
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    const roomPath = `https://aporia.test/api/rooms/${created.roomId}`;
    const confirming = worker.fetch(new Request(`${roomPath}/proposals/${proposal.id}/confirm`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ claimId: 'r30-claim', participantId: created.participantId, expectedRevision: 1 }) }), { ...env, DB: gatedDb });
    await batchReached;
    const competingWrite = await worker.fetch(new Request(`${roomPath}/candidates`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ title: 'Participant option', weekday: 6, startMinute: 1080, endMinute: 1200, priceCents: null, currency: 'ARS', area: null, expectedRevision: 1 }) }), env);
    expect(competingWrite.status).toBe(200);
    releaseBatch();
    const confirm = await confirming;
    expect(confirm.status).toBe(409);
    const stored = await db.prepare('SELECT revision, snapshot_json as snapshot FROM rooms WHERE id = ?').bind(created.roomId).first();
    expect(stored.revision).toBe(2);
    expect(JSON.parse(stored.snapshot).facts).toEqual([]);
    expect(JSON.parse(stored.snapshot).candidates.map((candidate) => candidate.title)).toEqual(['Participant option']);
    expect(await db.prepare('SELECT COUNT(*) as count FROM proposal_claim_decisions WHERE proposal_id = ?').bind(proposal.id).first().then((row) => row.count)).toBe(0);
    expect((await db.prepare('SELECT status FROM proposals WHERE id = ?').bind(proposal.id).first()).status).toBe('pending');
    expect(await db.prepare('SELECT COUNT(*) as count FROM events WHERE room_id = ?').bind(created.roomId).first().then((row) => row.count)).toBe(2);
  } finally {
    releaseBatch?.();
    vi.restoreAllMocks();
    if (created?.roomId) {
      await db.prepare('DELETE FROM proposal_claim_decisions WHERE proposal_id IN (SELECT id FROM proposals WHERE room_id = ?)').bind(created.roomId).run();
      await db.prepare('DELETE FROM proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM events WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM rooms WHERE id = ?').bind(created.roomId).run();
    }
  }
});

it('turns a stale shared room mutation into 409 without a duplicate revision event', async () => {
  proxy ??= await proxyPromise;
  const db = proxy.env.DB;
  const allow = { limit: async () => ({ success: true }) };
  const env = { ...proxy.env, DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) }, ROOM_CREATE_LIMITER: allow };
  let created;
  let releaseBatch;
  let signalBatch;
  let entered = false;
  const batchReached = new Promise((resolve) => { signalBatch = resolve; });
  const batchGate = new Promise((resolve) => { releaseBatch = resolve; });
  try {
    const create = await worker.fetch(new Request('https://aporia.test/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.31' }, body: JSON.stringify({ title: 'R31 two shared writes', displayName: 'R31 owner' }) }), env);
    expect(create.status).toBe(200);
    created = await create.json();
    const gatedDb = new Proxy(db, { get(target, property) {
      if (property === 'batch') return async (statements) => {
        if (!entered) { entered = true; signalBatch(); await batchGate; }
        return target.batch(statements);
      };
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    const roomPath = `https://aporia.test/api/rooms/${created.roomId}/candidates`;
    const firstWrite = worker.fetch(new Request(roomPath, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ title: 'Earlier stale option', weekday: 6, startMinute: 1080, endMinute: 1200, priceCents: null, currency: 'ARS', area: null, expectedRevision: 1 }) }), { ...env, DB: gatedDb });
    await batchReached;
    const winningWrite = await worker.fetch(new Request(roomPath, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ title: 'Winning option', weekday: 6, startMinute: 1200, endMinute: 1320, priceCents: null, currency: 'ARS', area: null, expectedRevision: 1 }) }), env);
    expect(winningWrite.status).toBe(200);
    releaseBatch();
    const staleWrite = await firstWrite;
    expect(staleWrite.status).toBe(409);
    const stored = await db.prepare('SELECT revision, snapshot_json as snapshot FROM rooms WHERE id = ?').bind(created.roomId).first();
    expect(stored.revision).toBe(2);
    expect(JSON.parse(stored.snapshot).candidates.map((candidate) => candidate.title)).toEqual(['Winning option']);
    expect(await db.prepare('SELECT COUNT(*) as count FROM events WHERE room_id = ?').bind(created.roomId).first().then((row) => row.count)).toBe(2);
  } finally {
    releaseBatch?.();
    if (created?.roomId) {
      await db.prepare('DELETE FROM events WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM rooms WHERE id = ?').bind(created.roomId).run();
    }
  }
});

it('does not claim an empty AI proposal was accepted after its base revision changes', async () => {
  proxy ??= await proxyPromise;
  const db = proxy.env.DB;
  const allow = { limit: async () => ({ success: true }) };
  const env = { ...proxy.env, DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) }, ROOM_CREATE_LIMITER: allow };
  let created;
  let releaseUpdate;
  let signalUpdate;
  let entered = false;
  const updateReached = new Promise((resolve) => { signalUpdate = resolve; });
  const updateGate = new Promise((resolve) => { releaseUpdate = resolve; });
  try {
    const create = await worker.fetch(new Request('https://aporia.test/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.32' }, body: JSON.stringify({ title: 'R32 empty AI result', displayName: 'R32 owner' }) }), env);
    expect(create.status).toBe(200);
    created = await create.json();
    vi.spyOn(GeminiProvider.prototype, 'propose').mockResolvedValue({ candidates: [], warnings: ['no concrete candidates'], provider: { name: 'gemini', model: 'synthetic-model' } });
    const discovery = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/candidate-discovery`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ expectedRevision: 1, idempotencyKey: 'r32-discovery' }) }), env);
    expect(discovery.status).toBe(200);
    const { proposal } = await discovery.json();
    const gatedDb = new Proxy(db, { get(target, property) {
      if (property !== 'prepare') {
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }
      return (sql) => {
        const statement = target.prepare(sql);
        if (!String(sql).startsWith('UPDATE candidate_proposals SET status = ?')) return statement;
        return { bind: (...values) => {
          const bound = statement.bind(...values);
          return { run: async (...args) => {
            if (!entered) { entered = true; signalUpdate(); await updateGate; }
            return bound.run(...args);
          } };
        } };
      };
    } });
    const accept = worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/candidate-discovery/${proposal.id}/accept`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ expectedRevision: 1, idempotencyKey: 'r32-accept' }) }), { ...env, DB: gatedDb });
    await updateReached;
    const competingWrite = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/candidates`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ title: 'Participant option', weekday: 6, startMinute: 1080, endMinute: 1200, priceCents: null, currency: 'ARS', area: null, expectedRevision: 1 }) }), env);
    expect(competingWrite.status).toBe(200);
    releaseUpdate();
    const acceptResponse = await accept;
    expect(acceptResponse.status).toBe(409);
    expect((await db.prepare('SELECT status FROM candidate_proposals WHERE id = ?').bind(proposal.id).first()).status).toBe('pending');
  } finally {
    releaseUpdate?.();
    vi.restoreAllMocks();
    if (created?.roomId) {
      await db.prepare('DELETE FROM candidate_proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM events WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM rooms WHERE id = ?').bind(created.roomId).run();
    }
  }
});

it('keeps duplicate-claim double confirmation to one decision without an unhandled D1 error', async () => {
  proxy ??= await proxyPromise;
  const db = proxy.env.DB;
  const allow = { limit: async () => ({ success: true }) };
  const env = { ...proxy.env, DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) }, ROOM_CREATE_LIMITER: allow };
  let created;
  let releaseBatches;
  let signalBoth;
  let waiting = 0;
  const bothReached = new Promise((resolve) => { signalBoth = resolve; });
  const batchGate = new Promise((resolve) => { releaseBatches = resolve; });
  try {
    const create = await worker.fetch(new Request('https://aporia.test/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.33' }, body: JSON.stringify({ title: 'R33 duplicate confirmation', displayName: 'R33 owner' }) }), env);
    expect(create.status).toBe(200);
    created = await create.json();
    vi.spyOn(GeminiProvider.prototype, 'extract').mockImplementation(async ({ artifact }) => {
      const id = artifact.content === 'first evidence' ? 'r33-first-proposal' : 'r33-duplicate-proposal';
      const claimId = artifact.content === 'first evidence' ? 'r33-first-claim' : 'r33-duplicate-claim';
      return { id, artifact, claims: [{ id: claimId, kind: 'proposal', participantId: created.participantId, value: { text: 'Same agreed plan' }, sourceText: artifact.content, confidence: 'high', ambiguity: [] }], warnings: [], provider: { name: 'gemini', model: 'synthetic-model' }, status: 'pending' };
    });
    const submitProposal = async (content) => worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/proposals`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ kind: 'text', content }) }), env);
    const firstSubmit = await submitProposal('first evidence');
    expect(firstSubmit.status).toBe(200);
    const firstConfirm = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/proposals/r33-first-proposal/confirm`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ claimId: 'r33-first-claim', participantId: created.participantId, expectedRevision: 1 }) }), env);
    expect(firstConfirm.status).toBe(200);
    const duplicateSubmit = await submitProposal('duplicate evidence');
    expect(duplicateSubmit.status).toBe(200);

    const gatedDb = new Proxy(db, { get(target, property) {
      if (property === 'batch') return async (statements) => {
        waiting += 1;
        if (waiting === 2) signalBoth();
        await batchGate;
        return target.batch(statements);
      };
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    const confirmDuplicate = () => worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/proposals/r33-duplicate-proposal/confirm`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ claimId: 'r33-duplicate-claim', participantId: created.participantId, expectedRevision: 2 }) }), { ...env, DB: gatedDb });
    const confirmations = [confirmDuplicate(), confirmDuplicate()];
    await bothReached;
    releaseBatches();
    const responses = await Promise.all(confirmations);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await db.prepare('SELECT COUNT(*) as count FROM proposal_claim_decisions WHERE proposal_id = ?').bind('r33-duplicate-proposal').first().then((row) => row.count)).toBe(1);
    expect((await db.prepare('SELECT status FROM proposals WHERE id = ?').bind('r33-duplicate-proposal').first()).status).toBe('confirmed');
    expect((await db.prepare('SELECT revision FROM rooms WHERE id = ?').bind(created.roomId).first()).revision).toBe(2);
  } finally {
    releaseBatches?.();
    vi.restoreAllMocks();
    if (created?.roomId) {
      await db.prepare('DELETE FROM proposal_claim_decisions WHERE proposal_id IN (SELECT id FROM proposals WHERE room_id = ?)').bind(created.roomId).run();
      await db.prepare('DELETE FROM proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM events WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM rooms WHERE id = ?').bind(created.roomId).run();
    }
  }
});

it('measures repeated Gemini extraction calls from one authenticated participant', async () => {
  proxy ??= await proxyPromise;
  const db = proxy.env.DB;
  const allow = { limit: async () => ({ success: true }) };
  const proposalBuckets = new Map();
  const aiProposalLimiter = { limit: async ({ key }) => {
    const count = proposalBuckets.get(key) ?? 0;
    proposalBuckets.set(key, count + 1);
    return { success: count < 5 };
  } };
  const env = { ...proxy.env, DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) }, ROOM_CREATE_LIMITER: allow, AI_PROPOSAL_LIMITER: aiProposalLimiter };
  let created;
  let providerCalls = 0;
  try {
    const create = await worker.fetch(new Request('https://aporia.test/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.34' }, body: JSON.stringify({ title: 'R34 AI call budget', displayName: 'R34 owner' }) }), env);
    expect(create.status).toBe(200);
    created = await create.json();
    vi.spyOn(GeminiProvider.prototype, 'extract').mockImplementation(async ({ artifact }) => {
      providerCalls++;
      return { id: `r34-proposal-${providerCalls}`, artifact, claims: [], warnings: [], provider: { name: 'gemini', model: 'synthetic-model' }, status: 'pending' };
    });
    const submit = () => worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/proposals`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ kind: 'text', content: 'A synthetic contribution' }) }), env);
    const responses = await Promise.all(Array.from({ length: 6 }, submit));
    expect(responses.map((response) => response.status).sort()).toEqual([200, 200, 200, 200, 200, 429]);
    expect(responses.find((response) => response.status === 429)?.headers.get('retry-after')).toBe('60');
    expect(providerCalls).toBe(5);
  } finally {
    vi.restoreAllMocks();
    if (created?.roomId) {
      await db.prepare('DELETE FROM proposal_claim_decisions WHERE proposal_id IN (SELECT id FROM proposals WHERE room_id = ?)').bind(created.roomId).run();
      await db.prepare('DELETE FROM proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM events WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM rooms WHERE id = ?').bind(created.roomId).run();
    }
  }
});

it('limits repeated Gemini candidate discovery for one authenticated participant', async () => {
  proxy ??= await proxyPromise;
  const db = proxy.env.DB;
  const allow = { limit: async () => ({ success: true }) };
  const discoveryBuckets = new Map();
  const aiDiscoveryLimiter = { limit: async ({ key }) => {
    const count = discoveryBuckets.get(key) ?? 0;
    discoveryBuckets.set(key, count + 1);
    return { success: count < 5 };
  } };
  const env = { ...proxy.env, DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) }, ROOM_CREATE_LIMITER: allow, AI_DISCOVERY_LIMITER: aiDiscoveryLimiter };
  let created;
  let providerCalls = 0;
  try {
    const create = await worker.fetch(new Request('https://aporia.test/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.35' }, body: JSON.stringify({ title: 'R35 AI discovery budget', displayName: 'R35 owner' }) }), env);
    expect(create.status).toBe(200);
    created = await create.json();
    vi.spyOn(GeminiProvider.prototype, 'propose').mockImplementation(async () => {
      providerCalls++;
      return { candidates: [], warnings: ['synthetic empty result'], provider: { name: 'gemini', model: 'synthetic-model' } };
    });
    const discover = (index) => worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/candidate-discovery`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ expectedRevision: 1, idempotencyKey: `r35-discovery-${index}` }) }), env);
    const responses = await Promise.all(Array.from({ length: 6 }, (_, index) => discover(index)));
    expect(responses.map((response) => response.status).sort()).toEqual([200, 200, 200, 200, 200, 429]);
    expect(providerCalls).toBe(5);
  } finally {
    vi.restoreAllMocks();
    if (created?.roomId) {
      await db.prepare('DELETE FROM candidate_proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM events WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM rooms WHERE id = ?').bind(created.roomId).run();
    }
  }
});

it('measures whether duplicate candidate-discovery idempotency requests duplicate Gemini work', async () => {
  proxy ??= await proxyPromise;
  const db = proxy.env.DB;
  const allow = { limit: async () => ({ success: true }) };
  const env = { ...proxy.env, DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) }, ROOM_CREATE_LIMITER: allow, AI_DISCOVERY_LIMITER: allow };
  let created;
  let providerCalls = 0;
  let releaseProvider;
  let signalProviderCall;
  const providerStarted = new Promise((resolve) => { signalProviderCall = resolve; });
  const providerGate = new Promise((resolve) => { releaseProvider = resolve; });
  try {
    const create = await worker.fetch(new Request('https://aporia.test/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.36' }, body: JSON.stringify({ title: 'R36 duplicate AI key', displayName: 'R36 owner' }) }), env);
    expect(create.status).toBe(200);
    created = await create.json();
    vi.spyOn(GeminiProvider.prototype, 'propose').mockImplementation(async () => {
      providerCalls++;
      signalProviderCall();
      await providerGate;
      return { candidates: [], warnings: ['synthetic duplicate-key result'], provider: { name: 'gemini', model: 'synthetic-model' } };
    });
    const discover = () => worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/candidate-discovery`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ expectedRevision: 1, idempotencyKey: 'r36-shared-idempotency-key' }) }), env);
    const first = discover();
    const second = discover();
    await providerStarted;
    const inProgressResponse = await Promise.race([first, second]);
    expect(inProgressResponse.status).toBe(409);
    expect(inProgressResponse.headers.get('retry-after')).toBe('2');
    expect(providerCalls).toBe(1);
    releaseProvider();
    const responses = await Promise.all([first, second]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(providerCalls).toBe(1);
    expect(await db.prepare('SELECT COUNT(*) as count FROM candidate_proposals WHERE room_id = ? AND idempotency_key = ?').bind(created.roomId, 'r36-shared-idempotency-key').first().then((row) => row.count)).toBe(1);
    const replay = await discover();
    expect(replay.status).toBe(200);
    expect((await replay.json()).replayed).toBe(true);
    expect(providerCalls).toBe(1);
  } finally {
    releaseProvider?.();
    vi.restoreAllMocks();
    if (created?.roomId) {
      await db.prepare('DELETE FROM candidate_proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM events WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM rooms WHERE id = ?').bind(created.roomId).run();
    }
  }
});

it('releases a failed candidate-discovery reservation so the same key can retry', async () => {
  proxy ??= await proxyPromise;
  const db = proxy.env.DB;
  const allow = { limit: async () => ({ success: true }) };
  const env = { ...proxy.env, DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) }, ROOM_CREATE_LIMITER: allow, AI_DISCOVERY_LIMITER: allow };
  let created;
  let providerCalls = 0;
  try {
    const create = await worker.fetch(new Request('https://aporia.test/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.37' }, body: JSON.stringify({ title: 'R37 AI retry reservation', displayName: 'R37 owner' }) }), env);
    expect(create.status).toBe(200);
    created = await create.json();
    vi.spyOn(GeminiProvider.prototype, 'propose').mockImplementation(async () => {
      providerCalls++;
      if (providerCalls === 1) throw new Error('synthetic provider failure');
      return { candidates: [], warnings: ['synthetic successful retry'], provider: { name: 'gemini', model: 'synthetic-model' } };
    });
    const discover = () => worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/candidate-discovery`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ expectedRevision: 1, idempotencyKey: 'r37-retry-key' }) }), env);
    expect((await discover()).status).toBe(502);
    const retried = await discover();
    expect(retried.status).toBe(200);
    expect(providerCalls).toBe(2);
    expect(await db.prepare('SELECT status FROM candidate_proposals WHERE room_id = ? AND idempotency_key = ?').bind(created.roomId, 'r37-retry-key').first().then((row) => row.status)).toBe('pending');
  } finally {
    vi.restoreAllMocks();
    if (created?.roomId) {
      await db.prepare('DELETE FROM candidate_proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM events WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM rooms WHERE id = ?').bind(created.roomId).run();
    }
  }
});

it('reclaims a stale candidate-discovery reservation after a worker interruption', async () => {
  proxy ??= await proxyPromise;
  const db = proxy.env.DB;
  const allow = { limit: async () => ({ success: true }) };
  const env = { ...proxy.env, DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) }, ROOM_CREATE_LIMITER: allow, AI_DISCOVERY_LIMITER: allow };
  let created;
  let providerCalls = 0;
  try {
    const create = await worker.fetch(new Request('https://aporia.test/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.38' }, body: JSON.stringify({ title: 'R38 stale AI reservation', displayName: 'R38 owner' }) }), env);
    expect(create.status).toBe(200);
    created = await create.json();
    const staleAt = new Date(Date.now() - 180_000).toISOString();
    await db.prepare(`INSERT INTO candidate_proposals (id, room_id, base_revision, idempotency_key, drafts_json, provider_json, warnings_json, status, created_at)
      VALUES (?, ?, 1, ?, '[]', '{}', '[]', 'processing', ?)`).bind('r38-stale-reservation', created.roomId, 'r38-recover-stale-key', staleAt).run();
    vi.spyOn(GeminiProvider.prototype, 'propose').mockImplementation(async () => {
      providerCalls++;
      return { candidates: [], warnings: ['synthetic recovered result'], provider: { name: 'gemini', model: 'synthetic-model' } };
    });
    const response = await worker.fetch(new Request(`https://aporia.test/api/rooms/${created.roomId}/candidate-discovery`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ expectedRevision: 1, idempotencyKey: 'r38-recover-stale-key' }) }), env);
    expect(response.status).toBe(200);
    expect(providerCalls).toBe(1);
    const row = await db.prepare('SELECT id, status FROM candidate_proposals WHERE room_id = ? AND idempotency_key = ?').bind(created.roomId, 'r38-recover-stale-key').first();
    expect(row.id).not.toBe('r38-stale-reservation');
    expect(row.status).toBe('pending');
  } finally {
    vi.restoreAllMocks();
    if (created?.roomId) {
      await db.prepare('DELETE FROM candidate_proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM events WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM rooms WHERE id = ?').bind(created.roomId).run();
    }
  }
});

it('does not resurrect an in-flight AI suggestion after close, reopen, and deletion', async () => {
  proxy ??= await proxyPromise;
  const db = proxy.env.DB;
  const allow = { limit: async () => ({ success: true }) };
  const creator = 'r39-lifecycle-creator-session';
  const env = {
    ...proxy.env, DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
    ROOM_CREATE_LIMITER: allow, AI_DISCOVERY_LIMITER: allow,
    RESEND_API_KEY: 'synthetic-only', CREATOR_EMAIL_FROM: 'no-reply@example.test', APORIA_APP_ORIGIN: 'https://aporia.test',
  };
  let created;
  let accountId;
  let releaseProvider;
  let signalProvider;
  const providerStarted = new Promise((resolve) => { signalProvider = resolve; });
  const providerGate = new Promise((resolve) => { releaseProvider = resolve; });
  const fetchStub = vi.fn(async () => new Response(JSON.stringify({ id: 'synthetic-r39-email' }), { status: 200 }));
  try {
    const create = await worker.fetch(new Request('https://aporia.test/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.39' }, body: JSON.stringify({ title: 'R39 in-flight lifecycle', displayName: 'R39 owner' }) }), env);
    expect(create.status).toBe(200);
    created = await create.json();
    accountId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    await db.prepare('INSERT INTO creator_accounts (id, email, created_at) VALUES (?, ?, ?)').bind(accountId, 'r39-owner@example.test', timestamp).run();
    await db.prepare('UPDATE rooms SET creator_account_id = ? WHERE id = ?').bind(accountId, created.roomId).run();
    await db.prepare('INSERT INTO creator_sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(digest(creator), accountId, timestamp, new Date(Date.now() + 86_400_000).toISOString()).run();
    vi.stubGlobal('fetch', fetchStub);
    vi.spyOn(GeminiProvider.prototype, 'propose').mockImplementation(async () => {
      signalProvider();
      await providerGate;
      return { candidates: [{ title: 'Synthetic private option', weekday: 6, startMinute: 1200, endMinute: 1320, priceCents: null, currency: null, area: 'synthetic private area' }], warnings: [], provider: { name: 'gemini', model: 'synthetic-model' } };
    });
    const roomPath = `https://aporia.test/api/rooms/${created.roomId}`;
    const discovering = worker.fetch(new Request(`${roomPath}/candidate-discovery`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ expectedRevision: 1, idempotencyKey: 'r39-lifecycle-key' }) }), env);
    await providerStarted;
    expect((await db.prepare('SELECT status FROM candidate_proposals WHERE room_id = ? AND idempotency_key = ?').bind(created.roomId, 'r39-lifecycle-key').first()).status).toBe('processing');

    const close = await worker.fetch(new Request(`${roomPath}/close`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-creator': creator }, body: '{}' }), env);
    expect(close.status).toBe(200);
    expect((await db.prepare('SELECT status FROM candidate_proposals WHERE room_id = ? AND idempotency_key = ?').bind(created.roomId, 'r39-lifecycle-key').first()).status).toBe('processing');

    const reopen = await worker.fetch(new Request(`${roomPath}/reopen`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-creator': creator }, body: '{}' }), env);
    expect(reopen.status).toBe(200);
    expect(await db.prepare('SELECT COUNT(*) as count FROM candidate_proposals WHERE room_id = ?').bind(created.roomId).first().then((row) => row.count)).toBe(0);

    const remove = await worker.fetch(new Request(`${roomPath}/delete`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-creator': creator }, body: '{}' }), env);
    expect(remove.status).toBe(200);
    expect((await db.prepare('SELECT status FROM rooms WHERE id = ?').bind(created.roomId).first()).status).toBe('trashed');
    releaseProvider();
    const lateResult = await discovering;
    expect(lateResult.status).toBe(409);
    expect((await lateResult.json()).error).toContain('room changed');
    const afterCompletion = await Promise.all([
      db.prepare('SELECT COUNT(*) as count FROM candidate_proposals WHERE room_id = ?').bind(created.roomId).first(),
      db.prepare('SELECT recovery_snapshot_json as snapshot FROM rooms WHERE id = ?').bind(created.roomId).first(),
    ]);
    expect(afterCompletion[0].count).toBe(0);
    expect(afterCompletion[1].snapshot).not.toContain('Synthetic private option');
    expect(afterCompletion[1].snapshot).not.toContain('synthetic private area');
    expect(fetchStub).toHaveBeenCalledTimes(1);
  } finally {
    releaseProvider?.();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (created?.roomId) {
      await db.prepare('DELETE FROM creator_auth_tokens WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM proposal_claim_decisions WHERE proposal_id IN (SELECT id FROM proposals WHERE room_id = ?)').bind(created.roomId).run();
      await db.prepare('DELETE FROM proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM candidate_proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM room_messages WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM events WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM rooms WHERE id = ?').bind(created.roomId).run();
    }
    if (accountId) {
      await db.prepare('DELETE FROM creator_sessions WHERE account_id = ?').bind(accountId).run();
      await db.prepare('DELETE FROM creator_accounts WHERE id = ?').bind(accountId).run();
    }
  }
});

it('does not dispatch reserved Gemini work after room close, reopen, and deletion win first', async () => {
  proxy ??= await proxyPromise;
  const db = proxy.env.DB;
  let releaseLimiter;
  let signalLimiter;
  const limiterEntered = new Promise((resolve) => { signalLimiter = resolve; });
  const limiterGate = new Promise((resolve) => { releaseLimiter = resolve; });
  const aiLimiter = { limit: async () => { signalLimiter(); await limiterGate; return { success: true }; } };
  const creator = 'r40-lifecycle-before-provider-session';
  const env = {
    ...proxy.env, DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
    ROOM_CREATE_LIMITER: { limit: async () => ({ success: true }) }, AI_DISCOVERY_LIMITER: aiLimiter,
    RESEND_API_KEY: 'synthetic-only', CREATOR_EMAIL_FROM: 'no-reply@example.test', APORIA_APP_ORIGIN: 'https://aporia.test',
  };
  let created;
  let accountId;
  let providerCalls = 0;
  const fetchStub = vi.fn(async () => new Response(JSON.stringify({ id: 'synthetic-r40-email' }), { status: 200 }));
  try {
    const create = await worker.fetch(new Request('https://aporia.test/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.40' }, body: JSON.stringify({ title: 'R40 dispatch authorization', displayName: 'R40 owner' }) }), env);
    expect(create.status).toBe(200);
    created = await create.json();
    accountId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    await db.prepare('INSERT INTO creator_accounts (id, email, created_at) VALUES (?, ?, ?)').bind(accountId, 'r40-owner@example.test', timestamp).run();
    await db.prepare('UPDATE rooms SET creator_account_id = ? WHERE id = ?').bind(accountId, created.roomId).run();
    await db.prepare('INSERT INTO creator_sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(digest(creator), accountId, timestamp, new Date(Date.now() + 86_400_000).toISOString()).run();
    vi.stubGlobal('fetch', fetchStub);
    vi.spyOn(GeminiProvider.prototype, 'propose').mockImplementation(async () => {
      providerCalls++;
      return { candidates: [], warnings: [], provider: { name: 'gemini', model: 'synthetic-model' } };
    });
    const roomPath = `https://aporia.test/api/rooms/${created.roomId}`;
    const discovering = worker.fetch(new Request(`${roomPath}/candidate-discovery`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ expectedRevision: 1, idempotencyKey: 'r40-delete-before-provider-key' }) }), env);
    await limiterEntered;
    expect((await db.prepare('SELECT status FROM candidate_proposals WHERE room_id = ? AND idempotency_key = ?').bind(created.roomId, 'r40-delete-before-provider-key').first()).status).toBe('processing');

    const close = await worker.fetch(new Request(`${roomPath}/close`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-creator': creator }, body: '{}' }), env);
    expect(close.status).toBe(200);
    const reopen = await worker.fetch(new Request(`${roomPath}/reopen`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-creator': creator }, body: '{}' }), env);
    expect(reopen.status).toBe(200);
    const remove = await worker.fetch(new Request(`${roomPath}/delete`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-creator': creator }, body: '{}' }), env);
    expect(remove.status).toBe(200);

    releaseLimiter();
    const response = await discovering;
    expect(response.status).toBe(409);
    expect(providerCalls).toBe(0);
    expect(await db.prepare('SELECT COUNT(*) as count FROM candidate_proposals WHERE room_id = ?').bind(created.roomId).first().then((row) => row.count)).toBe(0);
  } finally {
    releaseLimiter?.();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (created?.roomId) {
      await db.prepare('DELETE FROM creator_auth_tokens WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM candidate_proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM room_messages WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM events WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM rooms WHERE id = ?').bind(created.roomId).run();
    }
    if (accountId) {
      await db.prepare('DELETE FROM creator_sessions WHERE account_id = ?').bind(accountId).run();
      await db.prepare('DELETE FROM creator_accounts WHERE id = ?').bind(accountId).run();
    }
  }
});

it('does not start contribution extraction when room close wins before provider dispatch', async () => {
  proxy ??= await proxyPromise;
  const db = proxy.env.DB;
  let releaseLimiter;
  let signalLimiter;
  const limiterEntered = new Promise((resolve) => { signalLimiter = resolve; });
  const limiterGate = new Promise((resolve) => { releaseLimiter = resolve; });
  const aiLimiter = { limit: async () => { signalLimiter(); await limiterGate; return { success: true }; } };
  const creator = 'r41-extraction-lifecycle-creator';
  const env = {
    ...proxy.env, DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
    ROOM_CREATE_LIMITER: { limit: async () => ({ success: true }) }, AI_PROPOSAL_LIMITER: aiLimiter,
  };
  let created;
  let accountId;
  let providerCalls = 0;
  try {
    const create = await worker.fetch(new Request('https://aporia.test/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.41' }, body: JSON.stringify({ title: 'R41 extraction dispatch', displayName: 'R41 owner' }) }), env);
    expect(create.status).toBe(200);
    created = await create.json();
    accountId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    await db.prepare('INSERT INTO creator_accounts (id, email, created_at) VALUES (?, ?, ?)').bind(accountId, 'r41-owner@example.test', timestamp).run();
    await db.prepare('UPDATE rooms SET creator_account_id = ? WHERE id = ?').bind(accountId, created.roomId).run();
    await db.prepare('INSERT INTO creator_sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(digest(creator), accountId, timestamp, new Date(Date.now() + 86_400_000).toISOString()).run();
    vi.spyOn(GeminiProvider.prototype, 'extract').mockImplementation(async ({ artifact }) => {
      providerCalls++;
      return { id: 'r41-extraction-result', artifact, claims: [], warnings: [], provider: { name: 'gemini', model: 'synthetic-model' }, status: 'pending' };
    });
    const roomPath = `https://aporia.test/api/rooms/${created.roomId}`;
    const extracting = worker.fetch(new Request(`${roomPath}/proposals`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-session': created.sessionToken }, body: JSON.stringify({ kind: 'text', content: 'Synthetic evidence submitted before close' }) }), env);
    await limiterEntered;
    const close = await worker.fetch(new Request(`${roomPath}/close`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aporia-creator': creator }, body: '{}' }), env);
    expect(close.status).toBe(200);
    releaseLimiter();
    const response = await extracting;
    expect(response.status).toBe(409);
    expect(providerCalls).toBe(0);
    expect(await db.prepare('SELECT COUNT(*) as count FROM proposals WHERE room_id = ?').bind(created.roomId).first().then((row) => row.count)).toBe(0);
  } finally {
    releaseLimiter?.();
    vi.restoreAllMocks();
    if (created?.roomId) {
      await db.prepare('DELETE FROM proposal_claim_decisions WHERE proposal_id IN (SELECT id FROM proposals WHERE room_id = ?)').bind(created.roomId).run();
      await db.prepare('DELETE FROM proposals WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM events WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM sessions WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM participants WHERE room_id = ?').bind(created.roomId).run();
      await db.prepare('DELETE FROM rooms WHERE id = ?').bind(created.roomId).run();
    }
    if (accountId) {
      await db.prepare('DELETE FROM creator_sessions WHERE account_id = ?').bind(accountId).run();
      await db.prepare('DELETE FROM creator_accounts WHERE id = ?').bind(accountId).run();
    }
  }
});
