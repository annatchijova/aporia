import { describe, expect, it, vi } from 'vitest';
import { ProviderError } from './contracts';
import { GeminiProvider } from './gemini';

const artifact = { id: 'artifact-1', kind: 'text' as const, content: 'Saturday after 20', contentHash: 'hash', createdAt: '2026-09-25T00:00:00.000Z', participantId: 'p-1' };
const successResponse = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ claims: [], warnings: [] }) }] } }], responseId: 'request-2' }), { status: 200, headers: { 'content-type': 'application/json' } });

describe('GeminiProvider failure boundary', () => {
  it('uses the current default model and maps an unknown model to a non-retryable provider error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: 404, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new GeminiProvider({ GEMINI_API_KEY: 'test-key' }).extract({ artifact, participantNames: ['Anna'] })).rejects.toMatchObject({ code: 'unavailable', retryable: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent');
    expect(url).not.toContain('test-key');
    expect(new Headers(init.headers).get('x-goog-api-key')).toBe('test-key');
  });

  it('maps an overloaded provider response to a retryable error', async () => {
    const fetchMock = vi.fn().mockImplementation(() => new Response(JSON.stringify({ error: { message: 'overloaded' } }), { status: 503, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new GeminiProvider({ GEMINI_API_KEY: 'test-key' }).extract({ artifact, participantNames: [] })).rejects.toMatchObject({ code: 'unavailable', retryable: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries one temporary overload and succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'overloaded' } }), { status: 503, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(successResponse());
    vi.stubGlobal('fetch', fetchMock);
    await expect(new GeminiProvider({ GEMINI_API_KEY: 'test-key' }).extract({ artifact, participantNames: [] })).resolves.toMatchObject({ claims: [], provider: { name: 'gemini' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns the same retryable error when the single retry also fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'overloaded' } }), { status: 503, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'still overloaded' } }), { status: 503, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new GeminiProvider({ GEMINI_API_KEY: 'test-key' }).extract({ artifact, participantNames: [] })).rejects.toMatchObject({ code: 'unavailable', retryable: true, message: 'Gemini is temporarily unavailable' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

  it('sends image artifacts as Gemini inline data and advertises image extraction', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ claims: [], warnings: [] }) }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const imageArtifact = { ...artifact, id: 'image-1', kind: 'image' as const, content: 'iVBORw0KGgo=', mimeType: 'image/png' as const, byteLength: 8 };
    const provider = new GeminiProvider({ GEMINI_API_KEY: 'test-key' });
    await provider.extract({ artifact: imageArtifact, participantNames: ['Anna'] });
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)) as { contents: Array<{ parts: Array<{ inlineData?: { mimeType: string; data: string } }> }> };
    expect(body.contents[0].parts[1].inlineData).toEqual({ mimeType: 'image/png', data: 'iVBORw0KGgo=' });
    expect(provider.capabilities().imageExtraction).toBe(true);
  });
});
