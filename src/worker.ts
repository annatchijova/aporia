import { applyEvent } from './core/reducer';
import { assertBoundedText, assertCents, assertMinute, assertWeekday, emptySnapshot, type Candidate, type DecisionSnapshot, type RoomEvent } from './core/model';
import { decodeImageBase64 } from './core/artifact';
import { canonicalSnapshot } from './core/canonical';
import { GeminiProvider } from './intelligence/gemini';
import { ProviderError } from './intelligence/contracts';

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

async function body(request: Request): Promise<Record<string, unknown>> {
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

function now(): string { return new Date().toISOString(); }

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
  const update = env.DB.prepare('UPDATE rooms SET revision = ?, snapshot_json = ? WHERE id = ? AND revision = ?').bind(next.revision, JSON.stringify(next), snapshot.roomId, snapshot.revision);
  const insert = env.DB.prepare('INSERT INTO events (id, room_id, revision, actor_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(event.id, event.roomId, event.revision, event.actorId, event.type, JSON.stringify(event.payload), event.createdAt);
  const result = await env.DB.batch([update, insert]);
  if ((result[0]?.meta?.changes ?? 0) !== 1) throw new Error('stale room revision');
  return next;
}

function routePath(url: URL): string { return url.pathname.replace(/^\/[^/]+(?=\/api\/)/, ''); }

async function createRoom(env: Env, request: Request): Promise<Response> {
  const input = await body(request);
  const title = assertBoundedText(String(input.title ?? ''), 'title', 120);
  const displayName = assertBoundedText(String(input.displayName ?? ''), 'displayName', 80);
  const roomId = crypto.randomUUID();
  const participantId = crypto.randomUUID();
  const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  const snapshot = emptySnapshot(roomId, title);
  snapshot.participants.push({ id: participantId, displayName });
  snapshot.revision = 1;
  const createdAt = now();
  const event = { id: crypto.randomUUID(), roomId, revision: 1, actorId: participantId, type: 'participant.added', payload: { id: participantId, displayName }, createdAt };
  await env.DB.batch([
    env.DB.prepare('INSERT INTO rooms (id, title, revision, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?)').bind(roomId, title, 1, JSON.stringify(snapshot), createdAt),
    env.DB.prepare('INSERT INTO participants (id, room_id, display_name, created_at) VALUES (?, ?, ?, ?)').bind(participantId, roomId, displayName, createdAt),
    env.DB.prepare('INSERT INTO sessions (token_hash, room_id, participant_id, created_at) VALUES (?, ?, ?, ?)').bind(await tokenHash(token), roomId, participantId, createdAt),
    env.DB.prepare('INSERT INTO events (id, room_id, revision, actor_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(event.id, roomId, 1, participantId, event.type, JSON.stringify(event.payload), createdAt),
  ]);
  return json({ roomId, participantId, sessionToken: token, snapshot });
}

async function joinRoom(env: Env, request: Request, roomId: string): Promise<Response> {
  const input = await body(request);
  const displayName = assertBoundedText(String(input.displayName ?? ''), 'displayName', 80);
  if (!await readRoom(env, roomId)) return json({ error: 'room not found' }, 404);
  const participantId = crypto.randomUUID();
  const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  const createdAt = now();
  const current = await readRoom(env, roomId);
  if (!current) return json({ error: 'room not found' }, 404);
  const event: RoomEvent = { id: crypto.randomUUID(), roomId, revision: current.revision + 1, actorId: participantId, type: 'participant.added', payload: { id: participantId, displayName }, createdAt };
  const next = applyEvent(current, event);
  await env.DB.batch([
    env.DB.prepare('UPDATE rooms SET revision = ?, snapshot_json = ? WHERE id = ? AND revision = ?').bind(next.revision, JSON.stringify(next), roomId, current.revision),
    env.DB.prepare('INSERT INTO participants (id, room_id, display_name, created_at) VALUES (?, ?, ?, ?)').bind(participantId, roomId, displayName, createdAt),
    env.DB.prepare('INSERT INTO sessions (token_hash, room_id, participant_id, created_at) VALUES (?, ?, ?, ?)').bind(await tokenHash(token), roomId, participantId, createdAt),
    env.DB.prepare('INSERT INTO events (id, room_id, revision, actor_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(event.id, roomId, event.revision, participantId, event.type, JSON.stringify(event.payload), createdAt),
  ]);
  return json({ roomId, participantId, sessionToken: token, snapshot: next });
}

async function createProposal(env: Env, request: Request, roomId: string): Promise<Response> {
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
    content = assertBoundedText(String(input.content ?? ''), 'content', 12_000);
  }
  const snapshot = await readRoom(env, roomId);
  if (!snapshot) return json({ error: 'room not found' }, 404);
  const artifact = { id: crypto.randomUUID(), kind, content, contentHash: await sha256(content), createdAt: now(), participantId: actor.participantId, ...artifactExtras };
  const names = snapshot.participants.map((item) => item.displayName);
  try {
    const proposal = await new GeminiProvider(env).extract({ artifact, participantNames: names });
    await env.DB.prepare('INSERT INTO proposals (id, room_id, artifact_json, claims_json, provider_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(proposal.id, roomId, JSON.stringify(artifact), JSON.stringify(proposal.claims), JSON.stringify(proposal.provider), proposal.status, artifact.createdAt).run();
    return json({ proposal });
  } catch (error) {
    if (error instanceof ProviderError) {
      const status = error.code === 'rate_limited' ? 429 : error.code === 'timeout' ? 504 : error.code === 'unavailable' && error.retryable ? 503 : 502;
      return json({ error: 'Extraction failed. Try again.', code: error.code, retryable: error.retryable }, status);
    }
    return json({ error: 'Extraction failed. Try again.', code: 'provider_failure', retryable: false }, 502);
  }
}

async function confirmClaim(env: Env, request: Request, roomId: string, proposalId: string): Promise<Response> {
  const actor = await session(request, env, roomId);
  if (!actor) return json({ error: 'valid room session required' }, 401);
  const input = await body(request);
  const expectedRevision = Number(input.expectedRevision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return json({ error: 'expectedRevision is required' }, 400);
  const proposal = await env.DB.prepare('SELECT claims_json as claims, artifact_json as artifact FROM proposals WHERE id = ? AND room_id = ? AND status = ?').bind(proposalId, roomId, 'pending').first<{ claims: string; artifact: string }>();
  if (!proposal) return json({ error: 'pending proposal not found' }, 404);
  const claims = JSON.parse(proposal.claims) as Array<Record<string, unknown>>;
  const claim = claims.find((item) => item.id === input.claimId) as { id: string; kind: string; participantId: string | null; value: unknown } | undefined;
  if (!claim) return json({ error: 'claim not found' }, 404);
  const participantId = typeof input.participantId === 'string' ? input.participantId : claim.participantId;
  if (!participantId) return json({ error: 'participantId is required to confirm an ambiguous claim' }, 400);
  const snapshot = await readRoom(env, roomId);
  if (!snapshot || snapshot.revision !== expectedRevision) return json({ error: 'stale room revision', currentRevision: snapshot?.revision }, 409);
  const value = claim.value as Record<string, unknown>;
  const fact = { id: crypto.randomUUID(), kind: claim.kind, participantId, value, sourceProposalId: proposalId, confirmedBy: actor.participantId, confirmedAt: now() };
  const event: RoomEvent = { id: crypto.randomUUID(), roomId, revision: snapshot.revision + 1, actorId: actor.participantId, type: 'fact.confirmed', payload: fact, createdAt: now() };
  const next = applyEvent(snapshot, event);
  const update = env.DB.prepare('UPDATE rooms SET revision = ?, snapshot_json = ? WHERE id = ? AND revision = ?').bind(next.revision, JSON.stringify(next), roomId, snapshot.revision);
  const insert = env.DB.prepare('INSERT INTO events (id, room_id, revision, actor_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(event.id, roomId, event.revision, event.actorId, event.type, JSON.stringify(event.payload), event.createdAt);
  const proposalUpdate = env.DB.prepare('UPDATE proposals SET status = ? WHERE id = ? AND status = ?').bind('confirmed', proposalId, 'pending');
  const result = await env.DB.batch([update, insert, proposalUpdate]);
  if ((result[0]?.meta?.changes ?? 0) !== 1 || (result[2]?.meta?.changes ?? 0) !== 1) return json({ error: 'concurrent change; retry from current room state' }, 409);
  return json({ snapshot: next });
}

async function addCandidate(env: Env, request: Request, roomId: string): Promise<Response> {
  const actor = await session(request, env, roomId);
  if (!actor) return json({ error: 'valid room session required' }, 401);
  const input = await body(request);
  const expectedRevision = Number(input.expectedRevision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return json({ error: 'expectedRevision is required' }, 400);
  const candidate: Candidate = { id: crypto.randomUUID(), title: assertBoundedText(String(input.title ?? ''), 'title', 120), weekday: assertWeekday(Number(input.weekday)), startMinute: assertMinute(Number(input.startMinute), 'startMinute'), endMinute: assertMinute(Number(input.endMinute), 'endMinute'), priceCents: input.priceCents === null || input.priceCents === undefined ? null : assertCents(Number(input.priceCents), 'priceCents'), currency: input.priceCents === null || input.priceCents === undefined ? null : assertBoundedText(String(input.currency ?? 'ARS'), 'currency', 8).toUpperCase(), area: input.area ? assertBoundedText(String(input.area), 'area', 80) : null, source: { kind: 'manual', ref: `participant:${actor.participantId}` } };
  const snapshot = await readRoom(env, roomId);
  if (!snapshot) return json({ error: 'room not found' }, 404);
  if (snapshot.revision !== expectedRevision) return json({ error: 'stale room revision', currentRevision: snapshot.revision }, 409);
  const event: RoomEvent = { id: crypto.randomUUID(), roomId, revision: snapshot.revision + 1, actorId: actor.participantId, type: 'candidate.added', payload: candidate, createdAt: now() };
  const next = await commitEvent(env, snapshot, event);
  return json({ snapshot: next });
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = routePath(url).replace(/\/$/, '');
  if (request.method === 'POST' && path === '/api/rooms') return createRoom(env, request);
  const roomMatch = path.match(/^\/api\/rooms\/([^/]+)$/);
  if (request.method === 'GET' && roomMatch) {
    const snapshot = await readRoom(env, roomMatch[1]);
    return snapshot ? json({ snapshot }) : json({ error: 'room not found' }, 404);
  }
  const joinMatch = path.match(/^\/api\/rooms\/([^/]+)\/participants$/);
  if (request.method === 'POST' && joinMatch) return joinRoom(env, request, joinMatch[1]);
  const proposalMatch = path.match(/^\/api\/rooms\/([^/]+)\/proposals$/);
  if (request.method === 'POST' && proposalMatch) return createProposal(env, request, proposalMatch[1]);
  const confirmMatch = path.match(/^\/api\/rooms\/([^/]+)\/proposals\/([^/]+)\/confirm$/);
  if (request.method === 'POST' && confirmMatch) return confirmClaim(env, request, confirmMatch[1], confirmMatch[2]);
  const candidateMatch = path.match(/^\/api\/rooms\/([^/]+)\/candidates$/);
  if (request.method === 'POST' && candidateMatch) return addCandidate(env, request, candidateMatch[1]);
  return json({ error: 'not found' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname.includes('/api/')) return await handleApi(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'request failed';
      return json({ error: message }, 400);
    }
  },
} satisfies ExportedHandler<Env>;
