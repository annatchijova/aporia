import { applyEvent } from './core/reducer';
import { assertBoundedText, assertCents, assertMinute, assertWeekday, emptySnapshot, type Candidate, type DecisionSnapshot, type RoomEvent } from './core/model';
import { decodeImageBase64 } from './core/artifact';
import { calculateRelaxations } from './core/relaxation';
import { canonicalSnapshot, canonicalize } from './core/canonical';
import { GeminiProvider } from './intelligence/gemini';
import { ProviderError, type CandidateDraft } from './intelligence/contracts';

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  RESEND_API_KEY?: string;
  CREATOR_EMAIL_FROM?: string;
  APORIA_APP_ORIGIN?: string;
  APORIA_ALLOWED_ORIGINS?: string;
  ROOM_LOOKUP_LIMITER: RateLimit;
  ROOM_CREATE_LIMITER: RateLimit;
  ROOM_JOIN_LIMITER: RateLimit;
  CREATOR_ACCESS_LIMITER: RateLimit;
}

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

async function body(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') throw new Error('content-type must be application/json');
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 2_100_000) throw new Error('request body too large');
  const raw = await request.arrayBuffer();
  if (raw.byteLength > 2_100_000) throw new Error('request body too large');
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(raw)); } catch { throw new Error('request body must be valid JSON'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('request body must be an object');
  return parsed as Record<string, unknown>;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, '0')).join('');
}

async function tokenHash(token: string): Promise<string> { return sha256(token); }

function randomToken(): string { return `${crypto.randomUUID()}${crypto.randomUUID()}`; }

class RecoveryEmailCooldownError extends Error {}

export async function sendCreatorLink(env: Env, email: string, roomId: string, purpose: 'login' | 'recover', origin: string, cooldownSeconds = 0): Promise<string> {
  if (!env.RESEND_API_KEY || !env.CREATOR_EMAIL_FROM || !env.APORIA_APP_ORIGIN) throw new Error('creator email is not configured');
  const configuredOrigin = new URL(origin);
  if (configuredOrigin.protocol !== 'https:' && configuredOrigin.hostname !== 'localhost') throw new Error('creator app origin must use HTTPS');
  const raw = randomToken();
  const hashedToken = await tokenHash(raw);
  const createdAt = now();
  const expiresAt = new Date(Date.now() + (purpose === 'recover' ? 7 : 0.5) * 24 * 60 * 60 * 1000).toISOString();
  const inserted = cooldownSeconds > 0
    ? await env.DB.prepare(`INSERT INTO creator_auth_tokens (token_hash, email, room_id, purpose, created_at, expires_at)
        SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (
          SELECT 1 FROM creator_auth_tokens WHERE room_id = ? AND purpose = 'recover' AND created_at > ?
        )`)
      .bind(hashedToken, email, roomId, purpose, createdAt, expiresAt, roomId, new Date(Date.now() - cooldownSeconds * 1000).toISOString()).run()
    : await env.DB.prepare('INSERT INTO creator_auth_tokens (token_hash, email, room_id, purpose, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(hashedToken, email, roomId, purpose, createdAt, expiresAt).run();
  if ((inserted.meta?.changes ?? 0) !== 1) {
    if (cooldownSeconds > 0) throw new RecoveryEmailCooldownError('wait before requesting another recovery email');
    throw new Error('could not create creator link');
  }
  const link = `${configuredOrigin.origin}/#creatorToken=${encodeURIComponent(raw)}&room=${encodeURIComponent(roomId)}`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.CREATOR_EMAIL_FROM, to: [email], subject: purpose === 'recover' ? 'Recover your APORIA room' : 'Manage your APORIA room', html: `<p>Use this one-time link to ${purpose === 'recover' ? 'recover' : 'manage'} your APORIA room:</p><p><a href="${link}">Continue to APORIA</a></p><p>This link expires in ${purpose === 'recover' ? '7 days' : '30 minutes'}.</p>` }),
  });
  if (!response.ok) {
    await env.DB.prepare('DELETE FROM creator_auth_tokens WHERE token_hash = ? AND used_at IS NULL').bind(hashedToken).run();
    throw new Error('could not send creator email');
  }
  return hashedToken;
}

async function creatorAccount(request: Request, env: Env, roomId: string): Promise<{ accountId: string } | null> {
  const raw = request.headers.get('x-aporia-creator');
  if (!raw || raw.length > 200) return null;
  return env.DB.prepare(`SELECT s.account_id as accountId FROM creator_sessions s JOIN rooms r ON r.creator_account_id = s.account_id
    WHERE s.token_hash = ? AND r.id = ? AND s.expires_at > ?`).bind(await tokenHash(raw), roomId, now()).first<{ accountId: string }>();
}

async function requireActive(env: Env, roomId: string): Promise<Response | null> {
  const row = await env.DB.prepare('SELECT status FROM rooms WHERE id = ?').bind(roomId).first<{ status: string }>();
  if (!row || row.status === 'trashed') return json({ error: 'room not found' }, 404);
  return row.status === 'active' ? null : json({ error: 'this room is read-only' }, 409);
}

function now(): string { return new Date().toISOString(); }

function newMeetingCode(): string {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 100_000_000;
  return String(value).padStart(8, '0');
}

async function session(request: Request, env: Env, roomId: string): Promise<{ participantId: string } | null> {
  const raw = request.headers.get('x-aporia-session');
  if (!raw || raw.length > 200) return null;
  return env.DB.prepare('SELECT participant_id as participantId FROM sessions WHERE token_hash = ? AND room_id = ?').bind(await tokenHash(raw), roomId).first<{ participantId: string }>();
}

async function readRoom(env: Env, roomId: string): Promise<DecisionSnapshot | null> {
  const row = await env.DB.prepare('SELECT snapshot_json as snapshot FROM rooms WHERE id = ?').bind(roomId).first<{ snapshot: string }>();
  return row ? JSON.parse(row.snapshot) as DecisionSnapshot : null;
}

async function commitEvent(env: Env, snapshot: DecisionSnapshot, event: RoomEvent): Promise<DecisionSnapshot> {
  const next = applyEvent(snapshot, event);
  const update = env.DB.prepare("UPDATE rooms SET revision = ?, snapshot_json = ? WHERE id = ? AND revision = ? AND status = 'active'").bind(next.revision, JSON.stringify(next), snapshot.roomId, snapshot.revision);
  const insert = env.DB.prepare(`INSERT INTO events (id, room_id, revision, actor_id, event_type, payload_json, created_at)
    SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM rooms WHERE id = ? AND revision = ? AND status = 'active')`).bind(event.id, event.roomId, event.revision, event.actorId, event.type, JSON.stringify(event.payload), event.createdAt, event.roomId, event.revision);
  const result = await env.DB.batch([update, insert]);
  if ((result[0]?.meta?.changes ?? 0) !== 1) throw new Error('stale room revision');
  return next;
}

function idempotencyKey(input: Record<string, unknown>): string {
  return textInput(input.idempotencyKey, 'idempotencyKey', 128);
}

function textInput(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be text`);
  return assertBoundedText(value, field, max);
}

function numberInput(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${field} must be a number`);
  return value;
}

function routePath(url: URL): string { return url.pathname.replace(/^\/[^/]+(?=\/api\/)/, ''); }

// Keep anonymous discovery, identity creation, and creator-link requests behind edge caps in ADR-0006.
async function enforcePublicBurstLimit(request: Request, env: Env, url: URL): Promise<Response | null> {
  const path = routePath(url).replace(/\/$/, '');
  const method = request.method;
  const lookupPath = method === 'GET' && /^\/api\/rooms\/by-code\/\d+$/.test(path);
  const createPath = method === 'POST' && path === '/api/rooms';
  const joinPath = method === 'POST' && /^\/api\/rooms\/[^/]+\/participants$/.test(path);
  const creatorAccessPath = method === 'POST' && /^\/api\/rooms\/[^/]+\/creator-access$/.test(path);
  if (!lookupPath && !createPath && !joinPath && !creatorAccessPath) return null;

  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown-client';
  const limiter = lookupPath ? env.ROOM_LOOKUP_LIMITER : createPath ? env.ROOM_CREATE_LIMITER : joinPath ? env.ROOM_JOIN_LIMITER : env.CREATOR_ACCESS_LIMITER;
  const route = lookupPath ? 'lookup' : createPath ? 'create' : joinPath ? 'join' : 'creator-access';
  const retryAfter = lookupPath || joinPath ? 10 : 60;
  try {
    const { success } = await limiter.limit({ key: `aporia:${route}:${clientIp}` });
    if (success) return null;
    return new Response(JSON.stringify({ error: 'too many requests; try again shortly' }), {
      status: 429,
      headers: { ...jsonHeaders, 'retry-after': String(retryAfter) },
    });
  } catch {
    return json({ error: 'request protection is temporarily unavailable' }, 503);
  }
}

async function createRoom(env: Env, request: Request): Promise<Response> {
  const input = await body(request);
  const title = textInput(input.title, 'title', 120);
  const displayName = textInput(input.displayName, 'displayName', 80);
  const roomId = crypto.randomUUID();
  const participantId = crypto.randomUUID();
  const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  const snapshot = emptySnapshot(roomId, title);
  snapshot.participants.push({ id: participantId, displayName });
  snapshot.revision = 1;
  const createdAt = now();
  const event = { id: crypto.randomUUID(), roomId, revision: 1, actorId: participantId, type: 'participant.added', payload: { id: participantId, displayName }, createdAt };
  const hashedToken = await tokenHash(token);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const meetingCode = newMeetingCode();
    try {
      await env.DB.batch([
        env.DB.prepare('INSERT INTO rooms (id, title, revision, snapshot_json, created_at, meeting_code, status, creator_participant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(roomId, title, 1, JSON.stringify(snapshot), createdAt, meetingCode, 'active', participantId),
        env.DB.prepare('INSERT INTO participants (id, room_id, display_name, created_at) VALUES (?, ?, ?, ?)').bind(participantId, roomId, displayName, createdAt),
        env.DB.prepare('INSERT INTO sessions (token_hash, room_id, participant_id, created_at) VALUES (?, ?, ?, ?)').bind(hashedToken, roomId, participantId, createdAt),
        env.DB.prepare('INSERT INTO events (id, room_id, revision, actor_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(event.id, roomId, 1, participantId, event.type, JSON.stringify(event.payload), createdAt),
      ]);
      return json({ roomId, participantId, sessionToken: token, meetingCode, snapshot });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('rooms.meeting_code') || attempt === 4) throw error;
    }
  }
  return json({ error: 'could not allocate a meeting number' }, 503);
}

async function lookupRoom(env: Env, meetingCode: string): Promise<Response> {
  if (!/^\d{8}$/.test(meetingCode)) return json({ error: 'meeting number must contain 8 digits' }, 400);
  const row = await env.DB.prepare('SELECT id, snapshot_json as snapshot, status FROM rooms WHERE meeting_code = ?').bind(meetingCode).first<{ id: string; snapshot: string; status: string }>();
  if (!row || row.status === 'trashed') return json({ error: 'room not found; check the number with its creator' }, 404);
  return json({ roomId: row.id, snapshot: JSON.parse(row.snapshot) as DecisionSnapshot, status: row.status });
}

async function listRoomMessages(env: Env, request: Request, roomId: string): Promise<Response> {
  const exists = await env.DB.prepare('SELECT id FROM rooms WHERE id = ? AND status != ?').bind(roomId, 'trashed').first<{ id: string }>();
  if (!exists) return json({ error: 'room not found' }, 404);
  const result = await env.DB.prepare('SELECT m.id, m.participant_id as participantId, p.display_name as displayName, m.body, m.created_at as createdAt FROM room_messages m JOIN participants p ON p.id = m.participant_id WHERE m.room_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT 100').bind(roomId).all<{ id: string; participantId: string; displayName: string; body: string; createdAt: string }>();
  const actor = await session(request, env, roomId);
  const count = actor ? await env.DB.prepare('SELECT COUNT(*) as count FROM room_messages WHERE room_id = ? AND participant_id = ?').bind(roomId, actor.participantId).first<{ count: number }>() : null;
  return json({ messages: (result.results ?? []).reverse(), participantMessageCount: count?.count ?? null });
}

async function postRoomMessage(env: Env, request: Request, roomId: string): Promise<Response> {
  const actor = await session(request, env, roomId);
  if (!actor) return json({ error: 'join the room before posting' }, 401);
  const input = await body(request);
  const message = textInput(input.message, 'message', 280);
  const key = idempotencyKey(input);
  const messageId = crypto.randomUUID();
  const createdAt = now();
  const result = await env.DB.prepare(`INSERT INTO room_messages (id, room_id, participant_id, body, idempotency_key, created_at)
    SELECT ?, ?, ?, ?, ?, ?
    WHERE (SELECT status FROM rooms WHERE id = ?) = 'active'
      AND (SELECT COUNT(*) FROM room_messages WHERE room_id = ? AND participant_id = ?) < 5
    ON CONFLICT(room_id, participant_id, idempotency_key) DO NOTHING`).bind(messageId, roomId, actor.participantId, message, key, createdAt, roomId, roomId, actor.participantId).run();
  if ((result.meta?.changes ?? 0) === 1) {
    const stored = await env.DB.prepare('SELECT m.id, m.participant_id as participantId, p.display_name as displayName, m.body, m.created_at as createdAt FROM room_messages m JOIN participants p ON p.id = m.participant_id WHERE m.id = ?').bind(messageId).first();
    return json({ message: stored }, 201);
  }
  const prior = await env.DB.prepare('SELECT m.id, m.participant_id as participantId, p.display_name as displayName, m.body, m.created_at as createdAt FROM room_messages m JOIN participants p ON p.id = m.participant_id WHERE m.room_id = ? AND m.participant_id = ? AND m.idempotency_key = ?').bind(roomId, actor.participantId, key).first();
  if (prior) return json({ message: prior });
  const room = await env.DB.prepare('SELECT status FROM rooms WHERE id = ?').bind(roomId).first<{ status: string }>();
  if (!room || room.status === 'trashed') return json({ error: 'room not found' }, 404);
  if (room.status !== 'active') return json({ error: 'this room is read-only' }, 409);
  return json({ error: 'you have reached the limit of 5 messages for this room' }, 429);
}

async function joinRoom(env: Env, request: Request, roomId: string): Promise<Response> {
  const blocked = await requireActive(env, roomId); if (blocked) return blocked;
  const input = await body(request);
  const displayName = textInput(input.displayName, 'displayName', 80);
  if (!await readRoom(env, roomId)) return json({ error: 'room not found' }, 404);
  const participantId = crypto.randomUUID();
  const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  const createdAt = now();
  const current = await readRoom(env, roomId);
  if (!current) return json({ error: 'room not found' }, 404);
  const event: RoomEvent = { id: crypto.randomUUID(), roomId, revision: current.revision + 1, actorId: participantId, type: 'participant.added', payload: { id: participantId, displayName }, createdAt };
  const next = applyEvent(current, event);
  const result = await env.DB.batch([
    env.DB.prepare("UPDATE rooms SET revision = ?, snapshot_json = ? WHERE id = ? AND revision = ? AND status = 'active'").bind(next.revision, JSON.stringify(next), roomId, current.revision),
    env.DB.prepare('INSERT INTO participants (id, room_id, display_name, created_at) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM rooms WHERE id = ? AND revision = ? AND status = ?)').bind(participantId, roomId, displayName, createdAt, roomId, next.revision, 'active'),
    env.DB.prepare('INSERT INTO sessions (token_hash, room_id, participant_id, created_at) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM participants WHERE id = ? AND room_id = ?)').bind(await tokenHash(token), roomId, participantId, createdAt, participantId, roomId),
    env.DB.prepare(`INSERT INTO events (id, room_id, revision, actor_id, event_type, payload_json, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM rooms WHERE id = ? AND revision = ? AND status = 'active')`).bind(event.id, roomId, event.revision, participantId, event.type, JSON.stringify(event.payload), createdAt, roomId, next.revision),
  ]);
  if ((result[0]?.meta?.changes ?? 0) !== 1 || (result[1]?.meta?.changes ?? 0) !== 1 || (result[2]?.meta?.changes ?? 0) !== 1 || (result[3]?.meta?.changes ?? 0) !== 1) return json({ error: 'room changed; refresh and try again' }, 409);
  return json({ roomId, participantId, sessionToken: token, snapshot: next });
}

async function createProposal(env: Env, request: Request, roomId: string): Promise<Response> {
  const blocked = await requireActive(env, roomId); if (blocked) return blocked;
  const actor = await session(request, env, roomId);
  if (!actor) return json({ error: 'valid room session required' }, 401);
  const input = await body(request);
  if (input.kind !== undefined && input.kind !== 'text' && input.kind !== 'image') return json({ error: 'unsupported artifact kind' }, 400);
  const kind: 'text' | 'image' = input.kind === 'image' ? 'image' : 'text';
  let content: string;
  let artifactExtras: { mimeType?: 'image/png' | 'image/jpeg' | 'image/webp'; byteLength?: number } = {};
  if (kind === 'image') {
    const image = decodeImageBase64(input.content, input.mimeType);
    content = image.data;
    artifactExtras = { mimeType: image.mimeType, byteLength: image.byteLength };
  } else {
    content = textInput(input.content, 'content', 12_000);
  }
  const snapshot = await readRoom(env, roomId);
  if (!snapshot) return json({ error: 'room not found' }, 404);
  const artifact = { id: crypto.randomUUID(), kind, content, contentHash: await sha256(content), createdAt: now(), participantId: actor.participantId, ...artifactExtras };
  const names = snapshot.participants.map((item) => item.displayName);
  try {
    const proposal = await new GeminiProvider(env).extract({ artifact, participantNames: names });
    const redactedImageArtifact = kind === 'image' ? {
      id: artifact.id, kind: 'image' as const, content: '', contentHash: '', createdAt: artifact.createdAt, participantId: artifact.participantId,
    } : null;
    const retainedArtifact = redactedImageArtifact ?? artifact;
    const stored = await env.DB.prepare(`INSERT INTO proposals (id, room_id, artifact_json, claims_json, provider_json, status, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE (SELECT status FROM rooms WHERE id = ?) = 'active'`).bind(proposal.id, roomId, JSON.stringify(retainedArtifact), JSON.stringify(proposal.claims), JSON.stringify(proposal.provider), proposal.status, artifact.createdAt, roomId).run();
    if ((stored.meta?.changes ?? 0) !== 1) return json({ error: 'this room is read-only' }, 409);
    const responseProposal = redactedImageArtifact ? { ...proposal, artifact: redactedImageArtifact } : proposal;
    return json({ proposal: responseProposal });
  } catch (error) {
    if (error instanceof ProviderError) {
      const status = error.code === 'rate_limited' ? 429 : error.code === 'timeout' ? 504 : error.code === 'unavailable' && error.retryable ? 503 : 502;
      return json({ error: 'Extraction failed. Try again.', code: error.code, retryable: error.retryable }, status);
    }
    return json({ error: 'Extraction failed. Try again.', code: 'provider_failure', retryable: false }, 502);
  }
}

async function confirmClaim(env: Env, request: Request, roomId: string, proposalId: string): Promise<Response> {
  const blocked = await requireActive(env, roomId); if (blocked) return blocked;
  const actor = await session(request, env, roomId);
  if (!actor) return json({ error: 'valid room session required' }, 401);
  const input = await body(request);
  const expectedRevision = numberInput(input.expectedRevision, 'expectedRevision');
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return json({ error: 'expectedRevision is required' }, 400);
  const proposal = await env.DB.prepare('SELECT claims_json as claims, artifact_json as artifact FROM proposals WHERE id = ? AND room_id = ? AND status = ?').bind(proposalId, roomId, 'pending').first<{ claims: string; artifact: string }>();
  if (!proposal) return json({ error: 'pending proposal not found' }, 404);
  const sourceArtifact = JSON.parse(proposal.artifact) as { participantId?: string };
  if (sourceArtifact.participantId !== actor.participantId) return json({ error: 'only the person who submitted this contribution can approve it' }, 403);
  const claims = JSON.parse(proposal.claims) as Array<Record<string, unknown>>;
  const claim = claims.find((item) => item.id === input.claimId) as { id: string; kind: string; participantId: string | null; value: unknown } | undefined;
  if (!claim) return json({ error: 'claim not found' }, 404);
  const priorDecision = await env.DB.prepare('SELECT decision FROM proposal_claim_decisions WHERE proposal_id = ? AND claim_id = ?').bind(proposalId, claim.id).first<{ decision: string }>();
  if (priorDecision) return json({ error: 'this claim has already been reviewed' }, 409);
  const participantId = Object.prototype.hasOwnProperty.call(input, 'participantId')
    ? (typeof input.participantId === 'string' ? input.participantId : null)
    : claim.participantId;
  if (!participantId) return json({ error: 'participantId is required to confirm an ambiguous claim' }, 400);
  const snapshot = await readRoom(env, roomId);
  if (!snapshot || snapshot.revision !== expectedRevision) return json({ error: 'stale room revision', currentRevision: snapshot?.revision }, 409);
  if (!snapshot.participants.some((participant) => participant.id === participantId)) {
    return json({ error: 'participantId must belong to this room' }, 400);
  }
  const duplicate = snapshot.facts.some((fact) => fact.participantId === participantId && fact.kind === claim.kind && canonicalize(fact.value) === canonicalize(claim.value));
  const decision = (revision: number) => env.DB.prepare(`INSERT INTO proposal_claim_decisions (proposal_id, claim_id, decision, created_at)
    SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM rooms WHERE id = ? AND revision = ? AND status = 'active')`).bind(proposalId, claim.id, duplicate ? 'duplicate' : 'confirmed', now(), roomId, revision);
  const proposalUpdate = (revision: number) => env.DB.prepare(`UPDATE proposals SET status = 'confirmed' WHERE id = ? AND status = 'pending' AND
    (SELECT COUNT(*) FROM proposal_claim_decisions WHERE proposal_id = ? AND decision IN ('confirmed', 'duplicate')) >= ?
    AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND revision = ? AND status = 'active')`).bind(proposalId, proposalId, claims.length, roomId, revision);
  if (duplicate) {
    const result = await env.DB.batch([decision(snapshot.revision), proposalUpdate(snapshot.revision)]);
    if ((result[0]?.meta?.changes ?? 0) !== 1) return json({ error: 'claim review changed; refresh the room and try again' }, 409);
    return json({ snapshot, completedClaimId: claim.id, duplicate: true });
  }
  const value = claim.value as Record<string, unknown>;
  const fact = { id: crypto.randomUUID(), kind: claim.kind, participantId, value, sourceProposalId: proposalId, confirmedBy: actor.participantId, confirmedAt: now() };
  const event: RoomEvent = { id: crypto.randomUUID(), roomId, revision: snapshot.revision + 1, actorId: actor.participantId, type: 'fact.confirmed', payload: fact, createdAt: now() };
  const next = applyEvent(snapshot, event);
  const update = env.DB.prepare("UPDATE rooms SET revision = ?, snapshot_json = ? WHERE id = ? AND revision = ? AND status = 'active'").bind(next.revision, JSON.stringify(next), roomId, snapshot.revision);
  const insert = env.DB.prepare(`INSERT INTO events (id, room_id, revision, actor_id, event_type, payload_json, created_at)
    SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM rooms WHERE id = ? AND revision = ? AND status = 'active')`).bind(event.id, roomId, event.revision, event.actorId, event.type, JSON.stringify(event.payload), event.createdAt, roomId, next.revision);
  const result = await env.DB.batch([update, insert, decision(next.revision), proposalUpdate(next.revision)]);
  if ((result[0]?.meta?.changes ?? 0) !== 1 || (result[2]?.meta?.changes ?? 0) !== 1) return json({ error: 'concurrent change; retry from current room state' }, 409);
  return json({ snapshot: next, completedClaimId: claim.id, duplicate: false });
}

async function addCandidate(env: Env, request: Request, roomId: string): Promise<Response> {
  const blocked = await requireActive(env, roomId); if (blocked) return blocked;
  const actor = await session(request, env, roomId);
  if (!actor) return json({ error: 'valid room session required' }, 401);
  const input = await body(request);
  const expectedRevision = numberInput(input.expectedRevision, 'expectedRevision');
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return json({ error: 'expectedRevision is required' }, 400);
  const title = textInput(input.title, 'title', 120);
  const weekday = assertWeekday(numberInput(input.weekday, 'weekday'));
  const startMinute = assertMinute(numberInput(input.startMinute, 'startMinute'), 'startMinute');
  const endMinute = assertMinute(numberInput(input.endMinute, 'endMinute'), 'endMinute');
  const priceCents = input.priceCents === null || input.priceCents === undefined ? null : assertCents(numberInput(input.priceCents, 'priceCents'), 'priceCents');
  const currency = priceCents === null ? null : textInput(input.currency ?? 'ARS', 'currency', 8).toUpperCase();
  const area = input.area === null || input.area === undefined ? null : textInput(input.area, 'area', 80);
  const candidate: Candidate = { id: crypto.randomUUID(), title, weekday, startMinute, endMinute, priceCents, currency, area, source: { kind: 'manual', ref: `participant:${actor.participantId}` } };
  const snapshot = await readRoom(env, roomId);
  if (!snapshot) return json({ error: 'room not found' }, 404);
  if (snapshot.revision !== expectedRevision) return json({ error: 'stale room revision', currentRevision: snapshot.revision }, 409);
  const event: RoomEvent = { id: crypto.randomUUID(), roomId, revision: snapshot.revision + 1, actorId: actor.participantId, type: 'candidate.added', payload: candidate, createdAt: now() };
  const next = await commitEvent(env, snapshot, event);
  return json({ snapshot: next });
}

async function discoverCandidates(env: Env, request: Request, roomId: string): Promise<Response> {
  const blocked = await requireActive(env, roomId); if (blocked) return blocked;
  const actor = await session(request, env, roomId);
  if (!actor) return json({ error: 'valid room session required' }, 401);
  const input = await body(request);
  const expectedRevision = numberInput(input.expectedRevision, 'expectedRevision');
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return json({ error: 'expectedRevision is required' }, 400);
  const key = idempotencyKey(input);
  const existing = await env.DB.prepare('SELECT id, base_revision as baseRevision, drafts_json as drafts, provider_json as provider, warnings_json as warnings, status FROM candidate_proposals WHERE room_id = ? AND idempotency_key = ?').bind(roomId, key).first<{ id: string; baseRevision: number; drafts: string; provider: string; warnings: string; status: string }>();
  if (existing) return json({ proposal: { id: existing.id, baseRevision: existing.baseRevision, candidates: JSON.parse(existing.drafts), provider: JSON.parse(existing.provider), warnings: JSON.parse(existing.warnings), status: existing.status }, replayed: true });
  const snapshot = await readRoom(env, roomId);
  if (!snapshot) return json({ error: 'room not found' }, 404);
  if (snapshot.revision !== expectedRevision) return json({ error: 'stale room revision', currentRevision: snapshot.revision }, 409);
  const knownConstraints = snapshot.constraints.map((constraint) => JSON.stringify(constraint));
  try {
    const proposal = await new GeminiProvider(env).propose({ prompt: `Planning goal: ${snapshot.title}`, knownConstraints });
    const proposalId = crypto.randomUUID();
    await env.DB.prepare(`INSERT OR IGNORE INTO candidate_proposals (id, room_id, base_revision, idempotency_key, drafts_json, provider_json, warnings_json, status, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM rooms WHERE id = ? AND revision = ? AND status = 'active')`).bind(proposalId, roomId, snapshot.revision, key, JSON.stringify(proposal.candidates), JSON.stringify(proposal.provider), JSON.stringify(proposal.warnings), 'pending', now(), roomId, snapshot.revision).run();
    const stored = await env.DB.prepare('SELECT id, base_revision as baseRevision, drafts_json as drafts, provider_json as provider, warnings_json as warnings, status FROM candidate_proposals WHERE room_id = ? AND idempotency_key = ?').bind(roomId, key).first<{ id: string; baseRevision: number; drafts: string; provider: string; warnings: string; status: string }>();
    if (!stored) return json({ error: 'candidate proposal could not be stored' }, 503);
    return json({ proposal: { id: stored.id, baseRevision: stored.baseRevision, candidates: JSON.parse(stored.drafts), provider: JSON.parse(stored.provider), warnings: JSON.parse(stored.warnings), status: stored.status } });
  } catch (error) {
    if (error instanceof ProviderError) {
      const status = error.code === 'rate_limited' ? 429 : error.code === 'timeout' ? 504 : error.code === 'unavailable' && error.retryable ? 503 : 502;
      return json({ error: 'Candidate discovery failed. Try again.', code: error.code, retryable: error.retryable }, status);
    }
    return json({ error: 'Candidate discovery failed. Try again.', code: 'provider_failure', retryable: false }, 502);
  }
}

async function acceptCandidateProposal(env: Env, request: Request, roomId: string, proposalId: string): Promise<Response> {
  const blocked = await requireActive(env, roomId); if (blocked) return blocked;
  const actor = await session(request, env, roomId);
  if (!actor) return json({ error: 'valid room session required' }, 401);
  const input = await body(request);
  const expectedRevision = numberInput(input.expectedRevision, 'expectedRevision');
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return json({ error: 'expectedRevision is required' }, 400);
  const key = idempotencyKey(input);
  const proposal = await env.DB.prepare('SELECT id, base_revision as baseRevision, drafts_json as drafts, provider_json as provider, warnings_json as warnings, status FROM candidate_proposals WHERE id = ? AND room_id = ?').bind(proposalId, roomId).first<{ id: string; baseRevision: number; drafts: string; provider: string; warnings: string; status: string }>();
  if (!proposal) return json({ error: 'candidate proposal not found' }, 404);
  const snapshot = await readRoom(env, roomId);
  if (!snapshot) return json({ error: 'room not found' }, 404);
  if (proposal.status === 'accepted') return json({ snapshot, replayed: true });
  if (snapshot.revision !== expectedRevision || proposal.baseRevision !== expectedRevision) return json({ error: 'stale room revision', currentRevision: snapshot.revision }, 409);
  const drafts = JSON.parse(proposal.drafts) as CandidateDraft[];
  const provider = JSON.parse(proposal.provider) as { name: string; model: string; requestId?: string };
  const candidates: Candidate[] = drafts.map((draft) => ({ ...draft, id: crypto.randomUUID(), source: { kind: 'gemini', ref: provider.requestId ?? provider.model } }));
  if (candidates.length === 0) {
    await env.DB.prepare(`UPDATE candidate_proposals SET status = ?, accepted_event_id = ? WHERE id = ? AND status = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND revision = ? AND status = 'active')`).bind('accepted', key, proposalId, 'pending', roomId, snapshot.revision).run();
    return json({ snapshot });
  }
  const event: RoomEvent = { id: crypto.randomUUID(), roomId, revision: snapshot.revision + 1, actorId: actor.participantId, type: 'candidate.accepted', payload: candidates, createdAt: now() };
  const next = applyEvent(snapshot, event);
  const update = env.DB.prepare("UPDATE rooms SET revision = ?, snapshot_json = ? WHERE id = ? AND revision = ? AND status = 'active'").bind(next.revision, JSON.stringify(next), roomId, snapshot.revision);
  const insert = env.DB.prepare(`INSERT INTO events (id, room_id, revision, actor_id, event_type, payload_json, created_at)
    SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM rooms WHERE id = ? AND revision = ? AND status = 'active')`).bind(event.id, event.roomId, event.revision, event.actorId, event.type, JSON.stringify(event.payload), event.createdAt, roomId, next.revision);
  const proposalUpdate = env.DB.prepare(`UPDATE candidate_proposals SET status = ?, accepted_event_id = ? WHERE id = ? AND status = ?
    AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND revision = ? AND status = 'active')`).bind('accepted', event.id, proposalId, 'pending', roomId, next.revision);
  const result = await env.DB.batch([update, insert, proposalUpdate]);
  if ((result[0]?.meta?.changes ?? 0) !== 1 || (result[2]?.meta?.changes ?? 0) !== 1) return json({ error: 'concurrent change; retry from current room state' }, 409);
  return json({ snapshot: next });
}

async function calculateRoomRelaxations(env: Env, request: Request, roomId: string): Promise<Response> {
  const blocked = await requireActive(env, roomId); if (blocked) return blocked;
  const actor = await session(request, env, roomId);
  if (!actor) return json({ error: 'valid room session required' }, 401);
  const input = await body(request);
  const expectedRevision = numberInput(input.expectedRevision, 'expectedRevision');
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return json({ error: 'expectedRevision is required' }, 400);
  const snapshot = await readRoom(env, roomId);
  if (!snapshot) return json({ error: 'room not found' }, 404);
  if (snapshot.revision !== expectedRevision) return json({ error: 'stale room revision', currentRevision: snapshot.revision }, 409);
  return json({ result: calculateRelaxations(snapshot) });
}

async function requestCreatorAccess(env: Env, request: Request, roomId: string): Promise<Response> {
  const actor = await session(request, env, roomId);
  const input = await body(request);
  const email = textInput(input.email, 'email', 254).trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'valid email required' }, 400);
  const room = await env.DB.prepare("SELECT creator_participant_id as participantId, creator_account_id as accountId, status FROM rooms WHERE id = ?").bind(roomId).first<{ participantId: string | null; accountId: string | null; status: string }>();
  if (!room || room.status === 'trashed') return json({ sent: true });
  if (room.accountId) {
    const account = await env.DB.prepare('SELECT email FROM creator_accounts WHERE id = ?').bind(room.accountId).first<{ email: string }>();
    if (!account || account.email !== email) return json({ sent: true });
  } else if (!actor || room.participantId !== actor.participantId) {
    return json({ sent: true });
  }
  const recent = await env.DB.prepare('SELECT COUNT(*) as count FROM creator_auth_tokens WHERE room_id = ? AND created_at > ?').bind(roomId, new Date(Date.now() - 60_000).toISOString()).first<{ count: number }>();
  if ((recent?.count ?? 0) > 0) return json({ sent: true });
  try { await sendCreatorLink(env, email, roomId, 'login', env.APORIA_APP_ORIGIN!); }
  catch { console.error('creator access email delivery failed'); }
  return json({ sent: true });
}

async function consumeCreatorLink(env: Env, request: Request): Promise<Response> {
  const input = await body(request);
  const token = textInput(input.token, 'token', 200);
  if (token.length < 40 || token.length > 200) return json({ error: 'invalid or expired link' }, 400);
  const hash = await tokenHash(token);
  const auth = await env.DB.prepare('SELECT email, room_id as roomId, purpose, expires_at as expiresAt, used_at as usedAt FROM creator_auth_tokens WHERE token_hash = ?').bind(hash).first<{ email: string; roomId: string; purpose: string; expiresAt: string; usedAt: string | null }>();
  if (!auth || auth.usedAt || auth.expiresAt <= now()) return json({ error: 'invalid or expired link' }, 400);
  if (auth.purpose === 'recover') {
    const row = await env.DB.prepare('SELECT recovery_until as recoveryUntil, recovery_snapshot_json as recovery FROM rooms WHERE id = ? AND status = ?').bind(auth.roomId, 'trashed').first<{ recoveryUntil: string | null; recovery: string | null }>();
    if (!row?.recovery || !row.recoveryUntil || row.recoveryUntil <= now()) return json({ error: 'recovery period has expired' }, 410);
    const account = await env.DB.prepare('SELECT id FROM creator_accounts WHERE email = ?').bind(auth.email).first<{ id: string }>();
    if (!account) return json({ error: 'creator account not found' }, 403);
    const owner = await env.DB.prepare('SELECT creator_account_id as accountId FROM rooms WHERE id = ?').bind(auth.roomId).first<{ accountId: string | null }>();
    if (owner?.accountId !== account.id) return json({ error: 'this recovery link does not match the room creator' }, 403);
    const recovery = JSON.parse(row.recovery) as { title: string; candidates: Candidate[]; nextMeetingCode: string | null; registeredCount: number; attendedCount: number | null };
    const nextRoom = recovery.nextMeetingCode ? await env.DB.prepare("SELECT id FROM rooms WHERE meeting_code = ? AND status = 'active'").bind(recovery.nextMeetingCode).first<{ id: string }>() : null;
    const snapshot = emptySnapshot(auth.roomId, 'Recovered room');
    snapshot.candidates = recovery.candidates;
    snapshot.recoverySummary = { nextMeetingCode: nextRoom ? recovery.nextMeetingCode : null, registeredCount: recovery.registeredCount, attendedCount: recovery.attendedCount };
    snapshot.revision = 1;
    const sessionToken = randomToken();
    const createdAt = now();
    const result = await env.DB.batch([
      env.DB.prepare("UPDATE rooms SET title = ?, snapshot_json = ?, revision = 1, status = 'recovered_read_only', meeting_code = NULL, deleted_at = NULL, recovery_until = NULL, recovery_snapshot_json = NULL, closed_at = COALESCE(closed_at, ?) WHERE id = ? AND status = 'trashed' AND creator_account_id = ? AND recovery_until > ? AND EXISTS (SELECT 1 FROM creator_auth_tokens WHERE token_hash = ? AND room_id = ? AND email = ? AND purpose = 'recover' AND used_at IS NULL AND expires_at > ?)").bind(recovery.title, JSON.stringify(snapshot), now(), auth.roomId, account.id, now(), hash, auth.roomId, auth.email, now()),
      env.DB.prepare("UPDATE creator_auth_tokens SET used_at = ? WHERE token_hash = ? AND room_id = ? AND email = ? AND purpose = 'recover' AND used_at IS NULL AND expires_at > ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND creator_account_id = ? AND status = 'recovered_read_only')").bind(now(), hash, auth.roomId, auth.email, now(), auth.roomId, account.id),
      env.DB.prepare('INSERT INTO creator_sessions (token_hash, account_id, created_at, expires_at) SELECT ?, ?, ?, ? WHERE changes() = 1 AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND creator_account_id = ? AND status = ?)').bind(await tokenHash(sessionToken), account.id, createdAt, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), auth.roomId, account.id, 'recovered_read_only'),
    ]);
    if ((result[0]?.meta?.changes ?? 0) !== 1 || (result[1]?.meta?.changes ?? 0) !== 1 || (result[2]?.meta?.changes ?? 0) !== 1) return json({ error: 'room recovery expired or already used' }, 409);
    return json({ roomId: auth.roomId, recovered: true, creatorToken: sessionToken });
  } else {
    const accountId = crypto.randomUUID();
    const sessionToken = randomToken();
    const createdAt = now();
    const consumed = await env.DB.batch([
      env.DB.prepare("UPDATE creator_auth_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?").bind(createdAt, hash, createdAt),
      env.DB.prepare('INSERT INTO creator_accounts (id, email, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING').bind(accountId, auth.email, createdAt),
    ]);
    if ((consumed[0]?.meta?.changes ?? 0) !== 1) return json({ error: 'invalid or already used link' }, 409);
    const account = await env.DB.prepare('SELECT id FROM creator_accounts WHERE email = ?').bind(auth.email).first<{ id: string }>();
    if (!account) return json({ error: 'could not create creator account' }, 503);
    const owner = await env.DB.prepare('SELECT creator_participant_id as participantId, creator_account_id as accountId FROM rooms WHERE id = ?').bind(auth.roomId).first<{ participantId: string | null; accountId: string | null }>();
    if (!owner || (owner.accountId && owner.accountId !== account.id)) return json({ error: 'room already belongs to another creator account' }, 403);
    const linked = await env.DB.batch([
      env.DB.prepare('UPDATE rooms SET creator_account_id = ? WHERE id = ? AND (creator_account_id = ? OR (creator_account_id IS NULL AND creator_participant_id IS NOT NULL))').bind(account.id, auth.roomId, account.id),
      env.DB.prepare(`INSERT INTO creator_sessions (token_hash, account_id, created_at, expires_at)
        SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM rooms WHERE id = ? AND creator_account_id = ?)`).bind(await tokenHash(sessionToken), account.id, createdAt, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), auth.roomId, account.id),
    ]);
    if ((linked[0]?.meta?.changes ?? 0) !== 1 || (linked[1]?.meta?.changes ?? 0) !== 1) return json({ error: 'room already belongs to another creator account' }, 403);
    return json({ roomId: auth.roomId, creatorToken: sessionToken });
  }
}

async function changeRoomLifecycle(env: Env, request: Request, roomId: string, action: 'close' | 'reopen' | 'delete'): Promise<Response> {
  const actor = await creatorAccount(request, env, roomId);
  if (!actor) return json({ error: 'creator account required' }, 401);
  const room = await env.DB.prepare('SELECT status, title, snapshot_json as snapshot FROM rooms WHERE id = ? AND creator_account_id = ?').bind(roomId, actor.accountId).first<{ status: string; title: string; snapshot: string }>();
  if (!room) return json({ error: 'room not found' }, 404);
  if (action === 'close') {
    if (room.status !== 'active') return json({ error: 'only an active room can be closed' }, 409);
    const result = await env.DB.prepare("UPDATE rooms SET status = 'closed', closed_at = ? WHERE id = ? AND status = 'active' AND creator_account_id = ?").bind(now(), roomId, actor.accountId).run();
    if ((result.meta?.changes ?? 0) !== 1) return json({ error: 'room changed; refresh and try again' }, 409);
    return json({ status: 'closed' });
  }
  if (action === 'reopen') {
    if (room.status !== 'closed') return json({ error: 'only a closed room can be reopened' }, 409);
    const previous = JSON.parse(room.snapshot) as DecisionSnapshot;
    const reopened = emptySnapshot(roomId, 'Reopened room');
    reopened.candidates = previous.candidates.map((candidate) => ({ ...candidate, area: null, source: { kind: 'manual', ref: 'reopened' } }));
    reopened.revision = (previous.revision ?? 0) + 1;
    const registeredCount = await env.DB.prepare('SELECT COUNT(*) as count FROM participants WHERE room_id = ?').bind(roomId).first<{ count: number }>().then((result) => result?.count ?? 0);
    reopened.recoverySummary = { nextMeetingCode: null, registeredCount, attendedCount: null };
    const updated = await env.DB.batch([
      env.DB.prepare("UPDATE rooms SET status = 'reopened_read_only', title = ?, snapshot_json = ?, revision = ?, creator_participant_id = NULL WHERE id = ? AND status = 'closed' AND creator_account_id = ?")
        .bind('Reopened room', JSON.stringify(reopened), reopened.revision, roomId, actor.accountId),
      env.DB.prepare('DELETE FROM room_messages WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = ? AND revision = ?)').bind(roomId, roomId, 'reopened_read_only', reopened.revision),
      env.DB.prepare('DELETE FROM proposal_claim_decisions WHERE proposal_id IN (SELECT id FROM proposals WHERE room_id = ?) AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = ? AND revision = ?)').bind(roomId, roomId, 'reopened_read_only', reopened.revision),
      env.DB.prepare('DELETE FROM proposals WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = ? AND revision = ?)').bind(roomId, roomId, 'reopened_read_only', reopened.revision),
      env.DB.prepare('DELETE FROM candidate_proposals WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = ? AND revision = ?)').bind(roomId, roomId, 'reopened_read_only', reopened.revision),
      env.DB.prepare('DELETE FROM candidates WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = ? AND revision = ?)').bind(roomId, roomId, 'reopened_read_only', reopened.revision),
      env.DB.prepare('DELETE FROM events WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = ? AND revision = ?)').bind(roomId, roomId, 'reopened_read_only', reopened.revision),
      env.DB.prepare('DELETE FROM sessions WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = ? AND revision = ?)').bind(roomId, roomId, 'reopened_read_only', reopened.revision),
      env.DB.prepare('DELETE FROM participants WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = ? AND revision = ?)').bind(roomId, roomId, 'reopened_read_only', reopened.revision),
      env.DB.prepare("DELETE FROM creator_auth_tokens WHERE room_id = ? AND purpose = 'login' AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = ? AND revision = ?)").bind(roomId, roomId, 'reopened_read_only', reopened.revision),
    ]);
    if ((updated[0]?.meta?.changes ?? 0) !== 1) return json({ error: 'room changed; refresh and try again' }, 409);
    return json({ status: 'reopened_read_only' });
  }
  if (room.status === 'trashed') return json({ error: 'room is already deleted' }, 409);
  if (room.status !== 'closed' && room.status !== 'reopened_read_only') return json({ error: 'close the room before deleting it' }, 409);
  const snapshot = JSON.parse(room.snapshot) as DecisionSnapshot;
  const input = action === 'delete' ? await body(request) : {};
  const registeredCount = await env.DB.prepare("SELECT COALESCE(json_extract(snapshot_json, '$.recoverySummary.registeredCount'), (SELECT COUNT(*) FROM participants WHERE room_id = rooms.id)) as count FROM rooms WHERE id = ?").bind(roomId).first<{ count: number }>().then((result) => result?.count ?? 0);
  let attendedCount: number | null = null;
  let nextMeetingCode: string | null = null;
  if (input.attendedCount !== undefined && input.attendedCount !== null) {
    attendedCount = numberInput(input.attendedCount, 'attendedCount');
    if (!Number.isSafeInteger(attendedCount) || attendedCount < 0 || attendedCount > registeredCount) return json({ error: 'attendedCount must be between 0 and the number of registered people' }, 400);
  }
  if (input.nextMeetingCode !== undefined && input.nextMeetingCode !== null && input.nextMeetingCode !== '') {
    nextMeetingCode = textInput(input.nextMeetingCode, 'nextMeetingCode', 8);
    if (!/^\d{8}$/.test(nextMeetingCode)) return json({ error: 'nextMeetingCode must contain 8 digits' }, 400);
    const nextRoom = await env.DB.prepare("SELECT id FROM rooms WHERE meeting_code = ? AND id != ? AND status = 'active'").bind(nextMeetingCode, roomId).first<{ id: string }>();
    if (!nextRoom) return json({ error: 'nextMeetingCode must belong to another active room' }, 400);
  }
  const creator = await env.DB.prepare('SELECT email FROM creator_accounts WHERE id = ?').bind(actor.accountId).first<{ email: string }>();
  if (!creator) return json({ error: 'creator account not found' }, 403);
  let recoveryTokenHash: string;
  try { recoveryTokenHash = await sendCreatorLink(env, creator.email, roomId, 'recover', env.APORIA_APP_ORIGIN ?? '', 60); }
  catch (error) {
    if (error instanceof RecoveryEmailCooldownError) return json({ error: error.message }, 429);
    return json({ error: 'could not send recovery email; room was not deleted' }, 503);
  }
  const recovery = { title: 'Recovered room', candidates: snapshot.candidates.map((candidate) => ({ id: crypto.randomUUID(), title: candidate.title, weekday: candidate.weekday, startMinute: candidate.startMinute, endMinute: candidate.endMinute, priceCents: candidate.priceCents, currency: candidate.currency, area: null, source: { kind: 'manual' as const, ref: 'recovered' } })), nextMeetingCode, registeredCount, attendedCount };
  const deletedAt = now();
  const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const trashed = await env.DB.batch([
    env.DB.prepare("UPDATE rooms SET title = ?, snapshot_json = ?, status = 'trashed', meeting_code = NULL, creator_participant_id = NULL, deleted_at = ?, recovery_until = ?, recovery_snapshot_json = json_set(?, '$.registeredCount', COALESCE(json_extract(rooms.snapshot_json, '$.recoverySummary.registeredCount'), (SELECT COUNT(*) FROM participants WHERE room_id = rooms.id)), '$.attendedCount', ?) WHERE id = ? AND creator_account_id = ? AND status IN ('closed', 'reopened_read_only') AND (? IS NULL OR ? <= COALESCE(json_extract(rooms.snapshot_json, '$.recoverySummary.registeredCount'), (SELECT COUNT(*) FROM participants WHERE room_id = rooms.id)))")
      .bind('Deleted room', JSON.stringify(emptySnapshot(roomId, 'Deleted room')), deletedAt, until, JSON.stringify(recovery), attendedCount, roomId, actor.accountId, attendedCount, attendedCount),
    env.DB.prepare("UPDATE creator_auth_tokens SET expires_at = ? WHERE token_hash = ? AND room_id = ? AND purpose = 'recover' AND used_at IS NULL AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = 'trashed' AND deleted_at = ?)")
      .bind(until, recoveryTokenHash, roomId, roomId, deletedAt),
    env.DB.prepare('DELETE FROM room_messages WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = ? AND deleted_at = ?)').bind(roomId, roomId, 'trashed', deletedAt),
    env.DB.prepare('DELETE FROM proposal_claim_decisions WHERE proposal_id IN (SELECT id FROM proposals WHERE room_id = ?) AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = ? AND deleted_at = ?)').bind(roomId, roomId, 'trashed', deletedAt),
    env.DB.prepare('DELETE FROM proposals WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = ? AND deleted_at = ?)').bind(roomId, roomId, 'trashed', deletedAt),
    env.DB.prepare('DELETE FROM candidate_proposals WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = ? AND deleted_at = ?)').bind(roomId, roomId, 'trashed', deletedAt),
    env.DB.prepare('DELETE FROM candidates WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = ? AND deleted_at = ?)').bind(roomId, roomId, 'trashed', deletedAt),
    env.DB.prepare('DELETE FROM events WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = ? AND deleted_at = ?)').bind(roomId, roomId, 'trashed', deletedAt),
    env.DB.prepare('DELETE FROM sessions WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = ? AND deleted_at = ?)').bind(roomId, roomId, 'trashed', deletedAt),
    env.DB.prepare('DELETE FROM participants WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = ? AND deleted_at = ?)').bind(roomId, roomId, 'trashed', deletedAt),
    env.DB.prepare("DELETE FROM creator_auth_tokens WHERE room_id = ? AND purpose = 'login' AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = ? AND deleted_at = ?)").bind(roomId, roomId, 'trashed', deletedAt),
  ]);
  if ((trashed[0]?.meta?.changes ?? 0) !== 1) return json({ error: 'room changed; refresh and try again' }, 409);
  return json({ status: 'trashed', recoveryUntil: until });
}

async function purgeExpiredRooms(env: Env): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM creator_auth_tokens WHERE expires_at <= ?').bind(now()),
    env.DB.prepare('DELETE FROM creator_sessions WHERE expires_at <= ?').bind(now()),
  ]);
  const expired = await env.DB.prepare("SELECT id FROM rooms WHERE status = 'trashed' AND recovery_until <= ? LIMIT 100").bind(now()).all<{ id: string }>();
  for (const { id } of expired.results ?? []) {
    const expiredAt = now();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM room_messages WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = 'trashed' AND recovery_until <= ?)").bind(id, id, expiredAt),
      env.DB.prepare("DELETE FROM proposal_claim_decisions WHERE proposal_id IN (SELECT id FROM proposals WHERE room_id = ?) AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = 'trashed' AND recovery_until <= ?)").bind(id, id, expiredAt),
      env.DB.prepare("DELETE FROM proposals WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = 'trashed' AND recovery_until <= ?)").bind(id, id, expiredAt),
      env.DB.prepare("DELETE FROM candidate_proposals WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = 'trashed' AND recovery_until <= ?)").bind(id, id, expiredAt),
      env.DB.prepare("DELETE FROM candidates WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = 'trashed' AND recovery_until <= ?)").bind(id, id, expiredAt),
      env.DB.prepare("DELETE FROM events WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = 'trashed' AND recovery_until <= ?)").bind(id, id, expiredAt),
      env.DB.prepare("DELETE FROM sessions WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = 'trashed' AND recovery_until <= ?)").bind(id, id, expiredAt),
      env.DB.prepare("DELETE FROM participants WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = 'trashed' AND recovery_until <= ?)").bind(id, id, expiredAt),
      env.DB.prepare("DELETE FROM creator_auth_tokens WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND status = 'trashed' AND recovery_until <= ?)").bind(id, id, expiredAt),
      env.DB.prepare("DELETE FROM rooms WHERE id = ? AND status = 'trashed' AND recovery_until <= ?").bind(id, expiredAt),
    ]);
  }
  const currentTime = now();
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM creator_sessions WHERE account_id IN (
      SELECT a.id FROM creator_accounts a
      WHERE NOT EXISTS (SELECT 1 FROM rooms r WHERE r.creator_account_id = a.id)
        AND NOT EXISTS (SELECT 1 FROM creator_auth_tokens t WHERE t.email = a.email AND t.expires_at > ?)
    )`).bind(currentTime),
    env.DB.prepare(`DELETE FROM creator_accounts WHERE NOT EXISTS (SELECT 1 FROM rooms r WHERE r.creator_account_id = creator_accounts.id)
      AND NOT EXISTS (SELECT 1 FROM creator_auth_tokens t WHERE t.email = creator_accounts.email AND t.expires_at > ?)`).bind(currentTime),
  ]);
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = routePath(url).replace(/\/$/, '');
  if (request.method === 'POST' && path === '/api/creator-links/consume') return consumeCreatorLink(env, request);
  if (request.method === 'POST' && path === '/api/rooms') return createRoom(env, request);
  const codeMatch = path.match(/^\/api\/rooms\/by-code\/(\d+)$/);
  if (request.method === 'GET' && codeMatch) return lookupRoom(env, codeMatch[1]);
  const roomMatch = path.match(/^\/api\/rooms\/([^/]+)$/);
  if (request.method === 'GET' && roomMatch) {
    const row = await env.DB.prepare('SELECT snapshot_json as snapshot, meeting_code as meetingCode, status FROM rooms WHERE id = ? AND status != ?').bind(roomMatch[1], 'trashed').first<{ snapshot: string; meetingCode: string | null; status: string }>();
    if (!row) return json({ error: 'room not found' }, 404);
    if (row.status === 'recovered_read_only' && !await creatorAccount(request, env, roomMatch[1])) return json({ error: 'creator access required' }, 401);
    return json({ snapshot: JSON.parse(row.snapshot) as DecisionSnapshot, meetingCode: row.meetingCode ?? '', status: row.status });
  }
  const messagesMatch = path.match(/^\/api\/rooms\/([^/]+)\/messages$/);
  if (request.method === 'GET' && messagesMatch) return listRoomMessages(env, request, messagesMatch[1]);
  if (request.method === 'POST' && messagesMatch) return postRoomMessage(env, request, messagesMatch[1]);
  const joinMatch = path.match(/^\/api\/rooms\/([^/]+)\/participants$/);
  if (request.method === 'POST' && joinMatch) return joinRoom(env, request, joinMatch[1]);
  const creatorAccessMatch = path.match(/^\/api\/rooms\/([^/]+)\/creator-access$/);
  if (request.method === 'POST' && creatorAccessMatch) return requestCreatorAccess(env, request, creatorAccessMatch[1]);
  const lifecycleMatch = path.match(/^\/api\/rooms\/([^/]+)\/(close|reopen|delete)$/);
  if (request.method === 'POST' && lifecycleMatch) return changeRoomLifecycle(env, request, lifecycleMatch[1], lifecycleMatch[2] as 'close' | 'reopen' | 'delete');
  const proposalMatch = path.match(/^\/api\/rooms\/([^/]+)\/proposals$/);
  if (request.method === 'POST' && proposalMatch) return createProposal(env, request, proposalMatch[1]);
  const confirmMatch = path.match(/^\/api\/rooms\/([^/]+)\/proposals\/([^/]+)\/confirm$/);
  if (request.method === 'POST' && confirmMatch) return confirmClaim(env, request, confirmMatch[1], confirmMatch[2]);
  const candidateMatch = path.match(/^\/api\/rooms\/([^/]+)\/candidates$/);
  if (request.method === 'POST' && candidateMatch) return addCandidate(env, request, candidateMatch[1]);
  const discoveryMatch = path.match(/^\/api\/rooms\/([^/]+)\/candidate-discovery$/);
  if (request.method === 'POST' && discoveryMatch) return discoverCandidates(env, request, discoveryMatch[1]);
  const acceptDiscoveryMatch = path.match(/^\/api\/rooms\/([^/]+)\/candidate-discovery\/([^/]+)\/accept$/);
  if (request.method === 'POST' && acceptDiscoveryMatch) return acceptCandidateProposal(env, request, acceptDiscoveryMatch[1], acceptDiscoveryMatch[2]);
  const relaxationMatch = path.match(/^\/api\/rooms\/([^/]+)\/relaxations$/);
  if (request.method === 'POST' && relaxationMatch) return calculateRoomRelaxations(env, request, relaxationMatch[1]);
  return json({ error: 'not found' }, 404);
}

function isAllowedOrigin(origin: string | null, env: Env): origin is string {
  if (!origin || origin === 'null') return false;
  return (env.APORIA_ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean).some((rule) => {
    if (rule === origin) return true;
    if (!rule.startsWith('https://*.')) return false;
    let parsed: URL;
    try { parsed = new URL(origin); } catch { return false; }
    const suffix = rule.slice('https://*'.length);
    return parsed.protocol === 'https:' && parsed.origin === origin && parsed.hostname.endsWith(suffix) && parsed.hostname.length > suffix.length;
  });
}

function corsResponse(request: Request, env: Env, response: Response): Response {
  const origin = request.headers.get('origin');
  if (!isAllowedOrigin(origin, env)) return response;
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', origin);
  headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
  headers.set('access-control-allow-headers', 'content-type, x-aporia-session, x-aporia-creator');
  headers.set('access-control-max-age', '600');
  headers.append('vary', 'Origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> { await purgeExpiredRooms(env); },
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname.includes('/api/')) {
        if (request.method === 'OPTIONS') {
          const origin = request.headers.get('origin');
          const allowed = isAllowedOrigin(origin, env);
          return corsResponse(request, env, new Response(null, { status: allowed ? 204 : 403, headers: { 'cache-control': 'no-store' } }));
        }
        const limited = await enforcePublicBurstLimit(request, env, url);
        if (limited) return corsResponse(request, env, limited);
        return corsResponse(request, env, await handleApi(request, env));
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'request failed';
      return corsResponse(request, env, json({ error: message }, 400));
    }
  },
} satisfies ExportedHandler<Env>;
