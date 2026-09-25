import { describe, expect, it, vi } from 'vitest';
import { ProviderError } from './contracts';
import { GeminiProvider } from './gemini';

const artifact = { id: 'artifact-1', kind: 'text' as const, content: 'Saturday after 20', contentHash: 'hash', createdAt: '2026-09-25T00:00:00.000Z', participantId: 'p-1' };

describe('GeminiProvider failure boundary', () => {
  it('uses the current default model and maps an unknown model to a non-retryable provider error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: 404, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new GeminiProvider({ GEMINI_API_KEY: 'test-key' }).extract({ artifact, participantNames: ['Anna'] })).rejects.toMatchObject({ code: 'unavailable', retryable: false });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent');
    expect(url).not.toContain('test-key');
    expect(new Headers(init.headers).get('x-goog-api-key')).toBe('test-key');
  });

  it('maps an overloaded provider response to a retryable error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'overloaded' } }), { status: 503, headers: { 'content-type': 'application/json' } })));
    await expect(new GeminiProvider({ GEMINI_API_KEY: 'test-key' }).extract({ artifact, participantNames: [] })).rejects.toMatchObject({ code: 'unavailable', retryable: true });
  });

  it('maps malformed non-JSON provider output to invalid_output', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>upstream failure</html>', { status: 200, headers: { 'content-type': 'text/html' } })));
    await expect(new GeminiProvider({ GEMINI_API_KEY: 'test-key' }).extract({ artifact, participantNames: [] })).rejects.toMatchObject({ code: 'invalid_output', retryable: false });
  });

  it('fails before network access when the server-side key is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(new GeminiProvider({}).extract({ artifact, participantNames: [] })).rejects.toMatchObject({ code: 'unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retains ProviderError identity through the provider boundary', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })));
    await expect(new GeminiProvider({ GEMINI_API_KEY: 'test-key' }).extract({ artifact, participantNames: [] })).rejects.toBeInstanceOf(ProviderError);
  });
});
