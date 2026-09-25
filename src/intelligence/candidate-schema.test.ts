import { describe, expect, it } from 'vitest';
import { parseCandidateProposalResponse } from './candidate-schema';

describe('candidate proposal boundary', () => {
  it('rejects candidates with an empty time interval', () => {
    expect(() => parseCandidateProposalResponse({ candidates: [{ title: 'Invalid', weekday: 6, startMinute: 1200, endMinute: 1200, priceCents: null, currency: null, area: null }], warnings: [] })).toThrow('candidate interval is empty');
  });

  it('bounds the provider candidate list', () => {
    const candidates = Array.from({ length: 10 }, (_, index) => ({ title: 'Place ' + index, weekday: 6, startMinute: 1200, endMinute: 1260, priceCents: null, currency: null, area: null }));
    expect(parseCandidateProposalResponse({ candidates, warnings: [] }).candidates).toHaveLength(8);
  });
});
