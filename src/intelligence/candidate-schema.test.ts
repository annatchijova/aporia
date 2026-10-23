import { describe, expect, it } from 'vitest';
import { parseCandidateProposalResponse } from './candidate-schema';

describe('candidate proposal boundary', () => {
  it('rejects candidates with an empty time interval', () => {
    expect(() => parseCandidateProposalResponse({ candidates: [{ title: 'Invalid', weekday: 6, startMinute: 1200, endMinute: 1200, priceCents: null, currency: null, area: null }], warnings: [] })).toThrow('candidate interval is empty');
  });

  it('rejects provider output beyond the eight-candidate contract', () => {
    const candidates = Array.from({ length: 10 }, (_, index) => ({ title: 'Place ' + index, weekday: 6, startMinute: 1200, endMinute: 1260, priceCents: null, currency: null, area: null }));
    expect(() => parseCandidateProposalResponse({ candidates, warnings: [] })).toThrow('exceeds eight candidates');
  });

  it('rejects oversized candidate warnings', () => {
    expect(() => parseCandidateProposalResponse({ candidates: [], warnings: ['x'.repeat(501)] })).toThrow('warnings exceed provider limits');
  });
});
