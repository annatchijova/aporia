import { describe, expect, it } from 'vitest';
import { canonicalSnapshot } from './canonical';
import { evaluateSnapshot } from './evaluator';
import type { DecisionSnapshot } from './model';

const snapshot = (candidatePriceCents: number | null): DecisionSnapshot => ({
  schemaVersion: 1,
  roomId: 'room-1',
  title: 'Test plan',
  revision: 3,
  participants: [{ id: 'p-1', displayName: 'Anna' }],
  facts: [],
  constraints: [
    { kind: 'availability', participantId: 'p-1', weekday: 6, startMinute: 1200, endMinute: 1320, factId: 'f-1' },
    { kind: 'budget_max', participantId: 'p-1', maxCents: 300000, currency: 'ARS', factId: 'f-2' },
  ],
  preferences: [],
  candidates: [{ id: 'candidate-a', title: 'Saturday dinner', weekday: 6, startMinute: 1230, endMinute: 1290, priceCents: candidatePriceCents, currency: 'ARS', area: null, source: { kind: 'manual', ref: 'test' } }],
  evaluation: null,
});

describe('deterministic evaluator', () => {
  it('marks an unknown hard field as unknown and not feasible', () => {
    const result = evaluateSnapshot(snapshot(null));
    expect(result.candidateResults[0]).toMatchObject({ feasible: false, unknowns: ['p-1 budget: candidate price unknown'] });
  });

  it('accepts a candidate that satisfies exact hard constraints', () => {
    const result = evaluateSnapshot(snapshot(250000));
    expect(result.candidateResults[0]).toMatchObject({ feasible: true, hardViolations: [], unknowns: [] });
  });

  it('is invariant under candidate array order', () => {
    const first = { ...snapshot(250000), candidates: [...snapshot(250000).candidates, { id: 'candidate-b', title: 'Sunday dinner', weekday: 0, startMinute: 1230, endMinute: 1290, priceCents: 250000, currency: 'ARS', area: null, source: { kind: 'manual' as const, ref: 'test' } }] };
    const second = { ...first, candidates: [...first.candidates].reverse() };
    expect(evaluateSnapshot(first)).toEqual(evaluateSnapshot(second));
  });

  it('canonicalizes object key order identically', () => {
    expect(canonicalSnapshot({ z: 1, a: { y: true, x: 'ok' } } as never)).toBe('{"a":{"x":"ok","y":true},"z":1}');
  });
});
