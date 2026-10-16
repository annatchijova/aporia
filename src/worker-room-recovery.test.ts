import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptySnapshot } from './core/model';
import worker from './worker';

const roomId = 'room-r10-lifecycle';
const accountId = 'account-r10-owner';
const creatorToken = 'synthetic-r10-creator-session-token';
const oldParticipantToken = 'synthetic-r10-old-participant-session-token';
const ownerEmail = 'r10-owner@example.test';

type Statement = { sql: string; values: unknown[] };

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function syntheticDb() {
  const snapshot = emptySnapshot(roomId, 'Sensitive event title');
  snapshot.revision = 7;
  snapshot.participants.push(
    { id: 'participant-r10-one', displayName: 'Synthetic person one' },
    { id: 'participant-r10-two', displayName: 'Synthetic person two' },
  );
  snapshot.facts.push({
    id: 'fact-r10-private', kind: 'dietary_note', participantId: 'participant-r10-one',
    value: { text: 'Synthetic private note' }, sourceProposalId: 'proposal-r10',
    confirmedBy: 'participant-r10-one', confirmedAt: new Date().toISOString(),
  });
  snapshot.candidates.push({
    id: 'candidate-r10', title: 'Synthetic cafe', weekday: 6, startMinute: 1200,
    endMinute: 1320, priceCents: 5000, currency: 'ARS', area: 'Sensitive exact location',
    source: { kind: 'manual', ref: 'participant-r10-one' },
  });
  const state = {
    room: {
      id: roomId, status: 'closed', title: snapshot.title, snapshot: JSON.stringify(snapshot),
      meetingCode: '12345678' as string | null, creatorAccountId: accountId, creatorParticipantId: null as string | null,
      deletedAt: null as string | null, recoveryUntil: null as string | null,
      recovery: null as string | null,
    },
    participantCount: 2,
    messages: 1,
    proposals: 1,
    authTokens: new Map<string, { email: string; roomId: string; purpose: string; expiresAt: string; usedAt: string | null }>(),
    creatorSessions: new Map<string, string>(),
    sessions: new Map<string, string>([[await digest(oldParticipantToken), 'participant-r10-one']]),
    deletedChildren: new Set<string>(),
  };

  const apply = async ({ sql, values }: Statement, previousChanges = 1): Promise<{ meta: { changes: number } }> => {
    if (sql.startsWith('INSERT INTO creator_auth_tokens')) {
      state.authTokens.set(String(values[0]), { email: String(values[1]), roomId: String(values[2]), purpose: String(values[3]), expiresAt: String(values[5]), usedAt: null });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE rooms SET title = ?, snapshot_json = ?, status = 'trashed'")) {
      if (state.room.status !== 'closed' && state.room.status !== 'reopened_read_only') return { meta: { changes: 0 } };
      state.room.title = String(values[0]); state.room.snapshot = String(values[1]); state.room.status = 'trashed';
      state.room.meetingCode = null; state.room.deletedAt = String(values[2]); state.room.recoveryUntil = String(values[3]); state.room.recovery = String(values[4]);
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('UPDATE creator_auth_tokens SET expires_at')) {
      if (state.room.status !== 'trashed' || state.room.deletedAt !== values[5]) return { meta: { changes: 0 } };
      let changes = 0;
      for (const [hash, token] of state.authTokens) {
        if (token.roomId !== values[1] || token.purpose !== 'recover' || token.usedAt) continue;
        if (token.expiresAt > String(values[2]) || hash === String(values[3])) {
          token.expiresAt = String(values[0]);
          changes++;
        }
      }
      return { meta: { changes } };
    }
    if (sql.startsWith('DELETE FROM creator_auth_tokens')) {
      state.deletedChildren.add('creator_auth_tokens');
      if (sql.includes('expires_at <= ?')) {
        for (const [hash, token] of state.authTokens) if (token.expiresAt <= String(values[0])) state.authTokens.delete(hash);
      } else if (sql.includes("purpose = 'login'")) {
        for (const [hash, token] of state.authTokens) if (token.roomId === values[0] && token.purpose === 'login') state.authTokens.delete(hash);
      } else if (sql.includes('WHERE room_id = ?')) {
        for (const [hash, token] of state.authTokens) if (token.roomId === values[0]) state.authTokens.delete(hash);
      }
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("DELETE FROM rooms WHERE id = ? AND status = 'trashed'")) {
      if (state.room.status !== 'trashed' || state.room.recoveryUntil! > String(values[1])) return { meta: { changes: 0 } };
      state.room.status = 'purged';
      state.deletedChildren.add('rooms');
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('DELETE FROM ')) {
      state.deletedChildren.add(sql.slice('DELETE FROM '.length).split(' ', 1)[0]);
      if (sql.startsWith('DELETE FROM room_messages')) state.messages = 0;
      if (sql.startsWith('DELETE FROM proposals')) state.proposals = 0;
      if (sql.startsWith('DELETE FROM sessions')) state.sessions.clear();
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE rooms SET title = ?, snapshot_json = ?, revision = 1")) {
      const tokenHash = String(values[6]);
      const token = state.authTokens.get(tokenHash);
      if (state.room.status !== 'trashed' || !token || token.usedAt) return { meta: { changes: 0 } };
      state.room.title = String(values[0]); state.room.snapshot = String(values[1]); state.room.status = 'recovered_read_only';
      state.room.meetingCode = null; state.room.deletedAt = null; state.room.recoveryUntil = null; state.room.recovery = null;
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('UPDATE creator_auth_tokens SET used_at')) {
      if (sql.includes('changes() = 1') && previousChanges !== 1) return { meta: { changes: 0 } };
      const token = state.authTokens.get(String(values[1]));
      if (!token || token.usedAt) return { meta: { changes: 0 } };
      token.usedAt = String(values[0]);
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('INSERT INTO creator_sessions')) {
      if (sql.includes('changes() = 1') && previousChanges !== 1) return { meta: { changes: 0 } };
      state.creatorSessions.set(String(values[0]), String(values[1]));
      return { meta: { changes: 1 } };
    }
    return { meta: { changes: 1 } };
  };

  let batchQueue = Promise.resolve();
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          const statement = { sql, values };
          return {
            sql, values,
            async first<T>() {
              if (sql.includes('FROM creator_sessions s JOIN rooms r')) {
                const owner = state.creatorSessions.get(String(values[0])) ?? (String(values[0]) === await digest(creatorToken) ? accountId : undefined);
                return owner === state.room.creatorAccountId && String(values[1]) === roomId ? { accountId: owner } as T : null;
              }
              if (sql.startsWith('SELECT status, title, snapshot_json as snapshot FROM rooms')) return state.room.creatorAccountId === values[1] ? { status: state.room.status, title: state.room.title, snapshot: state.room.snapshot } as T : null;
              if (sql.startsWith('SELECT COALESCE(json_extract(snapshot_json')) return { count: state.participantCount } as T;
              if (sql.includes("COUNT(*) as count FROM creator_auth_tokens WHERE room_id = ? AND purpose = 'recover'")) return { count: [...state.authTokens.values()].filter((token) => token.roomId === roomId && token.purpose === 'recover').length } as T;
              if (sql === 'SELECT email FROM creator_accounts WHERE id = ?') return values[0] === accountId ? { email: ownerEmail } as T : null;
              if (sql.startsWith('SELECT email, room_id as roomId, purpose, expires_at as expiresAt, used_at as usedAt FROM creator_auth_tokens')) {
                const token = state.authTokens.get(String(values[0]));
                return token ? { ...token } as T : null;
              }
              if (sql.startsWith('SELECT recovery_until as recoveryUntil, recovery_snapshot_json as recovery FROM rooms')) {
                return state.room.status === 'trashed' ? { recoveryUntil: state.room.recoveryUntil, recovery: state.room.recovery } as T : null;
              }
              if (sql === 'SELECT id FROM creator_accounts WHERE email = ?') return values[0] === ownerEmail ? { id: accountId } as T : null;
              if (sql.startsWith('SELECT creator_account_id as accountId FROM rooms')) return { accountId: state.room.creatorAccountId } as T;
              if (sql.startsWith('SELECT participant_id as participantId FROM sessions WHERE token_hash')) {
                return state.sessions.get(String(values[0])) && String(values[1]) === roomId ? { participantId: state.sessions.get(String(values[0])) } as T : null;
              }
              if (sql.startsWith('SELECT id FROM rooms WHERE id = ? AND status != ?')) {
                return state.room.status !== values[1] ? { id: roomId } as T : null;
              }
              if (sql.startsWith('SELECT id, snapshot_json as snapshot, status FROM rooms WHERE meeting_code')) {
                return state.room.meetingCode === values[0] ? { id: roomId, snapshot: state.room.snapshot, status: state.room.status } as T : null;
              }
              if (sql.startsWith('SELECT snapshot_json as snapshot, meeting_code as meetingCode, status FROM rooms')) {
                return state.room.status !== 'trashed' ? { snapshot: state.room.snapshot, meetingCode: state.room.meetingCode, status: state.room.status } as T : null;
              }
              return null;
            },
            async run() { return apply(statement); },
            async all<T>() {
              if (sql.startsWith("SELECT id FROM rooms WHERE status = 'trashed' AND recovery_until <= ?")) {
                return { results: state.room.status === 'trashed' && state.room.recoveryUntil !== null && state.room.recoveryUntil <= String(values[0]) ? [{ id: roomId } as T] : [] };
              }
              return { results: [] as T[] };
            },
          };
        },
      };
    },
    async batch(statements: Array<{ sql: string; values: unknown[] }>) {
      const previous = batchQueue;
      let release!: () => void;
      batchQueue = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      try {
        const results = [];
        let previousChanges = 1;
        for (const statement of statements) {
          const result = await apply(statement, previousChanges);
          results.push(result);
          previousChanges = result.meta.changes;
        }
        return results;
      } finally {
        release();
      }
    },
  };
  return { db, state };
}

function jsonRequest(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://aporia.test${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
}

async function trashedRoomFixture(afterEmailAccepted?: () => void) {
  const { db, state } = await syntheticDb();
  const emailFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const email = JSON.parse(String(init?.body)) as { html: string };
    afterEmailAccepted?.();
    return new Response(JSON.stringify({ id: 'synthetic-email-id', html: email.html }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', emailFetch);
  const env = {
    DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
    RESEND_API_KEY: 'synthetic-only', CREATOR_EMAIL_FROM: 'no-reply@example.test', APORIA_APP_ORIGIN: 'https://aporia.test',
    ROOM_LOOKUP_LIMITER: { limit: async () => ({ success: true }) }, ROOM_CREATE_LIMITER: { limit: async () => ({ success: true }) },
    ROOM_JOIN_LIMITER: { limit: async () => ({ success: true }) }, CREATOR_ACCESS_LIMITER: { limit: async () => ({ success: true }) },
  } as unknown as Parameters<typeof worker.fetch>[1];
  const deleted = await worker.fetch(jsonRequest(`/api/rooms/${roomId}/delete`, {}, { 'x-aporia-creator': creatorToken }), env);
  expect(deleted.status).toBe(200);
  const emailBody = JSON.parse(String(emailFetch.mock.calls[0]?.[1]?.body)) as { html: string };
  const link = emailBody.html.match(/href="([^"]+)"/)?.[1];
  const token = new URL(link!).hash.slice(1).split('&').find((value) => value.startsWith('creatorToken='))?.split('=').slice(1).join('=');
  expect(token).toBeTruthy();
  return { env, state, emailFetch, token: decodeURIComponent(token!) };
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Worker room recovery lifecycle', () => {
  it('trashes a closed room, recovers once from the emailed link, and restores only the allowed snapshot', async () => {
    const { db, state } = await syntheticDb();
    const emailFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const email = JSON.parse(String(init?.body)) as { html: string };
      const link = email.html.match(/href="([^"]+)"/)?.[1];
      expect(link).toContain('creatorToken=');
      return new Response(JSON.stringify({ id: 'synthetic-email-id' }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', emailFetch);
    const env = {
      DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
      RESEND_API_KEY: 'synthetic-only', CREATOR_EMAIL_FROM: 'no-reply@example.test', APORIA_APP_ORIGIN: 'https://aporia.test',
      ROOM_LOOKUP_LIMITER: { limit: async () => ({ success: true }) }, ROOM_CREATE_LIMITER: { limit: async () => ({ success: true }) },
      ROOM_JOIN_LIMITER: { limit: async () => ({ success: true }) }, CREATOR_ACCESS_LIMITER: { limit: async () => ({ success: true }) },
    } as unknown as Parameters<typeof worker.fetch>[1];

    const deleteResponse = await worker.fetch(jsonRequest(`/api/rooms/${roomId}/delete`, {}, { 'x-aporia-creator': creatorToken }), env);
    const deleteBody = await deleteResponse.json() as { status?: string };
    expect(deleteResponse.status).toBe(200);
    expect(deleteBody.status).toBe('trashed');
    expect(state.room.status).toBe('trashed');
    expect(state.room.meetingCode).toBeNull();
    expect(state.messages).toBe(0);
    expect(state.proposals).toBe(0);
    expect(state.sessions.size).toBe(0);
    expect(state.deletedChildren).toEqual(new Set([
      'room_messages', 'proposal_claim_decisions', 'proposals', 'candidate_proposals',
      'candidates', 'events', 'sessions', 'participants', 'creator_auth_tokens',
    ]));
    expect(emailFetch).toHaveBeenCalledTimes(1);

    const emailBody = JSON.parse(String(emailFetch.mock.calls[0]?.[1]?.body)) as { html: string };
    const emailedLink = emailBody.html.match(/href="([^"]+)"/)?.[1];
    expect(emailedLink).toBeTruthy();
    const token = new URL(emailedLink!).hash.slice(1).split('&').find((value) => value.startsWith('creatorToken='))?.split('=').slice(1).join('=');
    expect(token).toBeTruthy();
    expect(state.authTokens.get(await digest(decodeURIComponent(token!)))?.expiresAt).toBe(state.room.recoveryUntil);

    const oldRoomResponse = await worker.fetch(new Request(`https://aporia.test/api/rooms/${roomId}`), env);
    expect(oldRoomResponse.status).toBe(404);
    const oldMeetingNumber = await worker.fetch(new Request('https://aporia.test/api/rooms/by-code/12345678'), env);
    expect(oldMeetingNumber.status).toBe(404);

    const recoveryResponse = await worker.fetch(jsonRequest('/api/creator-links/consume', { token: decodeURIComponent(token!) }), env);
    const recoveryBody = await recoveryResponse.json() as { roomId?: string; recovered?: boolean; creatorToken?: string };
    expect(recoveryResponse.status).toBe(200);
    expect(recoveryBody).toMatchObject({ roomId, recovered: true });
    expect(recoveryBody.creatorToken).toBeTruthy();
    expect(state.room.status).toBe('recovered_read_only');

    const recoveredSnapshot = JSON.parse(state.room.snapshot) as ReturnType<typeof emptySnapshot>;
    expect(recoveredSnapshot).toMatchObject({
      title: 'Recovered room', participants: [], facts: [], constraints: [], preferences: [],
      recoverySummary: { registeredCount: 2, attendedCount: null, nextMeetingCode: null },
    });
    expect(recoveredSnapshot.candidates).toHaveLength(1);
    expect(recoveredSnapshot.candidates[0]).toMatchObject({ title: 'Synthetic cafe', area: null, source: { kind: 'manual', ref: 'recovered' } });
    expect(JSON.stringify(recoveredSnapshot)).not.toContain('Sensitive event title');
    expect(JSON.stringify(recoveredSnapshot)).not.toContain('Synthetic person');
    expect(JSON.stringify(recoveredSnapshot)).not.toContain('Synthetic private note');
    expect(JSON.stringify(recoveredSnapshot)).not.toContain('Sensitive exact location');

    const anonymousRead = await worker.fetch(new Request(`https://aporia.test/api/rooms/${roomId}`), env);
    expect(anonymousRead.status).toBe(401);
    const oldChatRead = await worker.fetch(new Request(`https://aporia.test/api/rooms/${roomId}/messages`), env);
    expect(oldChatRead.status).toBe(200);
    expect(await oldChatRead.json()).toMatchObject({ messages: [], participantMessageCount: null });
    const staleSessionPost = await worker.fetch(jsonRequest(`/api/rooms/${roomId}/messages`, { message: 'synthetic stale write', idempotencyKey: 'r10-stale-session' }, { 'x-aporia-session': oldParticipantToken }), env);
    expect(staleSessionPost.status).toBe(401);
    const ownerRead = await worker.fetch(new Request(`https://aporia.test/api/rooms/${roomId}`, { headers: { 'x-aporia-creator': recoveryBody.creatorToken! } }), env);
    expect(ownerRead.status).toBe(200);
    const replay = await worker.fetch(jsonRequest('/api/creator-links/consume', { token: decodeURIComponent(token!) }), env);
    expect(replay.status).toBe(400);
    expect(emailFetch).toHaveBeenCalledTimes(1);
  });

  it('creates only one creator session when the same recovery link is consumed concurrently', async () => {
    const { env, state, token } = await trashedRoomFixture();

    const responses = await Promise.all(Array.from({ length: 8 }, () =>
      worker.fetch(jsonRequest('/api/creator-links/consume', { token }), env),
    ));
    const statuses = await Promise.all(responses.map((response) => response.status));

    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses).toHaveLength(8);
    expect(statuses.filter((status) => status !== 200).every((status) => [400, 409, 410].includes(status))).toBe(true);
    expect(state.room.status).toBe('recovered_read_only');
    expect(state.creatorSessions.size).toBe(1);
  });

  it('leaves a recovery link usable if it is opened before deletion commits', async () => {
    const { db, state } = await syntheticDb();
    const env = {
      DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
      RESEND_API_KEY: 'synthetic-only', CREATOR_EMAIL_FROM: 'no-reply@example.test', APORIA_APP_ORIGIN: 'https://aporia.test',
      ROOM_LOOKUP_LIMITER: { limit: async () => ({ success: true }) }, ROOM_CREATE_LIMITER: { limit: async () => ({ success: true }) },
      ROOM_JOIN_LIMITER: { limit: async () => ({ success: true }) }, CREATOR_ACCESS_LIMITER: { limit: async () => ({ success: true }) },
    } as unknown as Parameters<typeof worker.fetch>[1];
    let token = '';
    let earlyStatus = 0;
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const email = JSON.parse(String(init?.body)) as { html: string };
      const link = email.html.match(/href="([^"]+)"/)?.[1];
      token = decodeURIComponent(new URL(link!).hash.slice(1).split('&').find((value) => value.startsWith('creatorToken='))!.split('=').slice(1).join('='));
      const early = await worker.fetch(jsonRequest('/api/creator-links/consume', { token }), env);
      earlyStatus = early.status;
      return new Response(JSON.stringify({ id: 'synthetic-email-id' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }));

    const deleted = await worker.fetch(jsonRequest(`/api/rooms/${roomId}/delete`, {}, { 'x-aporia-creator': creatorToken }), env);
    expect(deleted.status).toBe(200);
    expect(earlyStatus).toBe(410);
    expect(state.room.status).toBe('trashed');
    expect(state.authTokens.get(await digest(token))?.usedAt).toBeNull();

    const retry = await worker.fetch(jsonRequest('/api/creator-links/consume', { token }), env);
    expect(retry.status).toBe(200);
    expect(state.room.status).toBe('recovered_read_only');
    expect(state.creatorSessions.size).toBe(1);
  });

  it('rejects an expired recovery email token without changing the trashed room', async () => {
    const { env, state, emailFetch, token } = await trashedRoomFixture();
    const storedToken = state.authTokens.get(await digest(token));
    expect(storedToken).toBeTruthy();
    storedToken!.expiresAt = new Date(Date.now() - 1_000).toISOString();

    const response = await worker.fetch(jsonRequest('/api/creator-links/consume', { token }), env);

    expect(response.status).toBe(400);
    expect(state.room.status).toBe('trashed');
    expect(state.room.recovery).toBeTruthy();
    expect(state.creatorSessions.size).toBe(0);
    expect(emailFetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the recovery link valid for the full trash window when email delivery is delayed', async () => {
    vi.useFakeTimers();
    const sendStartedAt = new Date('2026-10-14T12:00:00.000Z');
    vi.setSystemTime(sendStartedAt);
    try {
      const { env, state, token } = await trashedRoomFixture(() => {
        vi.setSystemTime(new Date(sendStartedAt.getTime() + 8 * 24 * 60 * 60 * 1000));
      });
      const storedToken = state.authTokens.get(await digest(token));
      expect(storedToken?.expiresAt).toBe(state.room.recoveryUntil);
      expect(new Date(storedToken!.expiresAt).getTime()).toBeGreaterThan(Date.now());

      const response = await worker.fetch(jsonRequest('/api/creator-links/consume', { token }), env);

      expect(response.status).toBe(200);
      expect(state.room.status).toBe('recovered_read_only');
    } finally {
      vi.useRealTimers();
    }
  });

  it('expires recovery and purges the room at exact deadline equality', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T12:00:00.000Z'));
    try {
      const { env, state, token } = await trashedRoomFixture();
      const tokenExpiry = state.authTokens.get(await digest(token))?.expiresAt;
      expect(tokenExpiry).toBe(state.room.recoveryUntil);
      vi.setSystemTime(new Date(state.room.recoveryUntil!));
      const equalityAttempt = await worker.fetch(jsonRequest('/api/creator-links/consume', { token }), env);
      expect(equalityAttempt.status).toBe(400);

      const [response] = await Promise.all([
        worker.fetch(jsonRequest('/api/creator-links/consume', { token }), env),
        worker.scheduled({ cron: '0 * * * *', type: 'cron', scheduledTime: Date.now(), noRetry: () => {} } as ScheduledController, env),
      ]);

      expect(response.status).toBe(400);
      expect(state.room.status).toBe('purged');
      expect(state.authTokens.size).toBe(0);
      expect(state.creatorSessions.size).toBe(0);
      expect(state.deletedChildren).toContain('rooms');
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a recovery link after the seven-day trash window without restoring the room', async () => {
    const { env, state, emailFetch, token } = await trashedRoomFixture();
    state.room.recoveryUntil = new Date(Date.now() - 1_000).toISOString();

    const response = await worker.fetch(jsonRequest('/api/creator-links/consume', { token }), env);

    expect(response.status).toBe(410);
    expect(state.room.status).toBe('trashed');
    expect(state.room.recovery).toBeTruthy();
    expect(state.creatorSessions.size).toBe(0);
    expect(emailFetch).toHaveBeenCalledTimes(1);
  });
});
