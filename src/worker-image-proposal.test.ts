import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptySnapshot } from './core/model';
import { ProviderError } from './intelligence/contracts';
import { GeminiProvider } from './intelligence/gemini';
import worker from './worker';

const image = 'iVBORw0KGgo=';
const sessionToken = 'synthetic-participant-session-token';

function fakeEnv() {
  const insertedProposals: unknown[][] = [];
  const snapshot = emptySnapshot('room-image-r9', 'Synthetic image flow');
  snapshot.participants.push({ id: 'participant-image-r9', displayName: 'Synthetic uploader' });
  const env = {
    DB: {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            return {
              async first<T>() {
                if (sql.includes('SELECT status FROM rooms')) return { status: 'active' } as T;
                if (sql.includes('SELECT participant_id as participantId FROM sessions')) return { participantId: 'participant-image-r9' } as T;
                if (sql.includes('SELECT snapshot_json as snapshot FROM rooms')) return { snapshot: JSON.stringify(snapshot) } as T;
                return null;
              },
              async run() {
                if (sql.includes('INSERT INTO proposals')) insertedProposals.push(values);
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
    ROOM_LOOKUP_LIMITER: { limit: async () => ({ success: true }) },
    ROOM_CREATE_LIMITER: { limit: async () => ({ success: true }) },
    ROOM_JOIN_LIMITER: { limit: async () => ({ success: true }) },
    CREATOR_ACCESS_LIMITER: { limit: async () => ({ success: true }) },
    AI_PROPOSAL_LIMITER: { limit: async () => ({ success: true }) },
    AI_DISCOVERY_LIMITER: { limit: async () => ({ success: true }) },
    ASSETS: { fetch: vi.fn() },
  };
  return { env: env as unknown as Parameters<typeof worker.fetch>[1], insertedProposals };
}

function imageRequest() {
  return new Request('https://aporia.test/api/rooms/room-image-r9/proposals', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-aporia-session': sessionToken },
    body: JSON.stringify({ kind: 'image', content: image, mimeType: 'image/png' }),
  });
}

afterEach(() => vi.restoreAllMocks());

describe('Worker image proposal flow', () => {
  it('sends the image to the provider but returns and persists a redacted artifact', async () => {
    const { env, insertedProposals } = fakeEnv();
    let providerReceivedImage = '';
    vi.spyOn(GeminiProvider.prototype, 'extract').mockImplementation(async (request) => {
      providerReceivedImage = request.artifact.content;
      return {
        id: 'proposal-image-r9',
        artifact: request.artifact,
        claims: [{ id: 'claim-image-r9', kind: 'dietary_note', participantId: 'participant-image-r9', value: { text: 'synthetic note' }, sourceText: 'synthetic note from image', confidence: 'high', ambiguity: [] }],
        warnings: [],
        provider: { name: 'gemini', model: 'synthetic-model' },
        status: 'pending',
      };
    });

    const response = await worker.fetch(imageRequest(), env);
    const payload = await response.json() as { proposal: { artifact: Record<string, unknown>; claims: Array<{ sourceText: string }> } };
    const storedArtifact = JSON.parse(String(insertedProposals[0]?.[2])) as Record<string, unknown>;
    const storedClaims = JSON.parse(String(insertedProposals[0]?.[3])) as Array<{ sourceText: string }>;

    expect(response.status).toBe(200);
    expect(providerReceivedImage).toBe(image);
    expect(payload.proposal.artifact).toMatchObject({ kind: 'image', content: '', contentHash: '' });
    expect(payload.proposal.artifact).not.toHaveProperty('mimeType');
    expect(payload.proposal.artifact).not.toHaveProperty('byteLength');
    expect(storedArtifact).toMatchObject({ kind: 'image', content: '', contentHash: '' });
    expect(storedArtifact).not.toHaveProperty('mimeType');
    expect(storedArtifact).not.toHaveProperty('byteLength');
    expect(storedClaims[0].sourceText).toBe('synthetic note from image');
    expect(payload.proposal.claims[0].sourceText).toBe('synthetic note from image');
  });

  it('does not persist a proposal when provider processing fails', async () => {
    const { env, insertedProposals } = fakeEnv();
    vi.spyOn(GeminiProvider.prototype, 'extract').mockRejectedValue(new ProviderError('unavailable', 'synthetic provider failure', true));

    const response = await worker.fetch(imageRequest(), env);
    const payload = await response.json() as { error: string; code: string };

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({ error: 'Extraction failed. Try again.', code: 'unavailable' });
    expect(insertedProposals).toHaveLength(0);
  });

  it('preserves the provider rate-limit code for the client without persisting a proposal', async () => {
    const { env, insertedProposals } = fakeEnv();
    vi.spyOn(GeminiProvider.prototype, 'extract').mockRejectedValue(new ProviderError('rate_limited', 'synthetic provider limit', true));

    const response = await worker.fetch(imageRequest(), env);
    const payload = await response.json() as { error: string; code: string; retryable: boolean };

    expect(response.status).toBe(429);
    expect(payload).toMatchObject({ code: 'rate_limited', retryable: true });
    expect(insertedProposals).toHaveLength(0);
  });

  it('preserves the application AI limiter Retry-After header and skips the provider', async () => {
    const { env, insertedProposals } = fakeEnv();
    Object.assign(env, { AI_PROPOSAL_LIMITER: { limit: async () => ({ success: false }) } });
    const extract = vi.spyOn(GeminiProvider.prototype, 'extract');

    const response = await worker.fetch(imageRequest(), env);
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(payload.error).toContain('too many AI requests');
    expect(extract).not.toHaveBeenCalled();
    expect(insertedProposals).toHaveLength(0);
  });

  it('fails closed when the AI request limiter is unavailable', async () => {
    const { env } = fakeEnv();
    Object.assign(env, { AI_PROPOSAL_LIMITER: { limit: vi.fn().mockRejectedValue(new Error('synthetic limiter failure')) } });
    const extract = vi.spyOn(GeminiProvider.prototype, 'extract');

    const response = await worker.fetch(imageRequest(), env);
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(503);
    expect(payload.error).toBe('AI request protection is temporarily unavailable');
    expect(extract).not.toHaveBeenCalled();
  });
});
