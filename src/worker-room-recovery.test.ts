import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptySnapshot } from './core/model';
import worker from './worker';

const roomId = 'room-r10-lifecycle';
const accountId = 'account-r10-owner';
const creatorToken = 'synthetic-r10-creator-session-token';
const ownerEmail = 'r10-owner@example.test';

type Statement = { sql: string; values: unknown[] };

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function syntheticDb() {
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
    deletedChildren: new Set<string>(),
  };

  const apply = async ({ sql, values }: Statement): Promise<{ meta: { changes: number } }> => {
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
    if (sql.startsWith('DELETE FROM ')) {
      state.deletedChildren.add(sql.slice('DELETE FROM '.length).split(' ', 1)[0]);
      if (sql.startsWith('DELETE FROM room_messages')) state.messages = 0;
      if (sql.startsWith('DELETE FROM proposals')) state.proposals = 0;
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
      const token = state.authTokens.get(String(values[1]));
      if (!token || token.usedAt) return { meta: { changes: 0 } };
      token.usedAt = String(values[0]);
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('INSERT INTO creator_sessions')) {
      state.creatorSessions.set(String(values[0]), String(values[1]));
      return { meta: { changes: 1 } };
    }
    return { meta: { changes: 1 } };
  };

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
              if (sql.startsWith('SELECT snapshot_json as snapshot, meeting_code as meetingCode, status FROM rooms')) {
                return state.room.status !== 'trashed' ? { snapshot: state.room.snapshot, meetingCode: state.room.meetingCode, status: state.room.status } as T : null;
              }
              return null;
            },
            async run() { return apply(statement); },
            async all<T>() { return { results: [] as T[] }; },
          };
        },
      };
    },
    async batch(statements: Array<{ sql: string; values: unknown[] }>) {
      const results = [];
      for (const statement of statements) results.push(await apply(statement));
      return results;
    },
  };
  return { db, state };
}

function jsonRequest(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://aporia.test${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Worker room recovery lifecycle', () => {
  it('trashes a closed room, recovers once from the emailed link, and restores only the allowed snapshot', async () => {
    const { db, state } = syntheticDb();
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

    const oldRoomResponse = await worker.fetch(new Request(`https://aporia.test/api/rooms/${roomId}`), env);
    expect(oldRoomResponse.status).toBe(404);

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
    const ownerRead = await worker.fetch(new Request(`https://aporia.test/api/rooms/${roomId}`, { headers: { 'x-aporia-creator': recoveryBody.creatorToken! } }), env);
    expect(ownerRead.status).toBe(200);
    const replay = await worker.fetch(jsonRequest('/api/creator-links/consume', { token: decodeURIComponent(token!) }), env);
    expect(replay.status).toBe(400);
    expect(emailFetch).toHaveBeenCalledTimes(1);
  });
});
