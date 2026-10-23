import { describe, expect, it } from 'vitest';
import { ProviderError } from './contracts';
import { parseExtractionResponse } from './schema';

const artifact = { id: 'artifact-1', kind: 'text' as const, content: 'Saturday after 20', contentHash: 'hash', createdAt: '2026-09-25T00:00:00.000Z', participantId: 'p-1' };
const provider = { name: 'gemini', model: 'test-model' };
const claim = (id = 'claim-1') => ({ id, kind: 'proposal', participantId: null, value: { text: 'Meet for dinner' }, sourceText: 'Dinner', ambiguity: [] });

describe('parseExtractionResponse provider limits', () => {
  it('rejects more than 64 claims instead of materializing an unbounded proposal', () => {
    expect(() => parseExtractionResponse({ claims: Array.from({ length: 65 }, (_, index) => claim(`claim-${index}`)), warnings: [] }, artifact, provider)).toThrow(ProviderError);
  });

  it('rejects oversized claim identifiers', () => {
    expect(() => parseExtractionResponse({ claims: [claim('x'.repeat(129))], warnings: [] }, artifact, provider)).toThrow(ProviderError);
  });

  it('rejects oversized ambiguity strings', () => {
    expect(() => parseExtractionResponse({ claims: [{ ...claim(), ambiguity: ['x'.repeat(501)] }], warnings: [] }, artifact, provider)).toThrow(ProviderError);
  });

  it('rejects oversized warnings instead of returning them to the uploader', () => {
    expect(() => parseExtractionResponse({ claims: [], warnings: ['x'.repeat(501)] }, artifact, provider)).toThrow(ProviderError);
  });
});
