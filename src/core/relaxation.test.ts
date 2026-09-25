import { describe, expect, it } from 'vitest';
import { calculateRelaxations } from './relaxation';
import type { DecisionSnapshot } from './model';

function base(): DecisionSnapshot {
  return { schemaVersion: 1, roomId: 'room', title: 'Dinner', revision: 4, participants: [{ id: 'p1', displayName: 'Anna' }], facts: [], constraints: [{ kind: 'budget_max', participantId: 'p1', maxCents: 250000, currency: 'ARS', factId: 'f1' }], preferences: [], candidates: [{ id: 'c1', title: 'Place', weekday: 6, startMinute: 1200, endMinute: 1320, priceCents: 290000, currency: 'ARS', area: null, source: { kind: 'manual', ref: 'test' } }], evaluation: null };
}

describe('deterministic relaxation engine', () => {
  it('finds the exact budget increase without mutating the snapshot', () => {
    const snapshot = base();
    const result = calculateRelaxations(snapshot);
    expect(result.options[0]).toMatchObject({ candidateId: 'c1', constraintKind: 'budget_max', cost: { unit: 'cents', amount: 40000 }, change: { fromCents: 250000, toCents: 290000 } });
    expect(snapshot.constraints[0]).toMatchObject({ maxCents: 250000 });
  });

  it('does not suggest relaxing an unknown price', () => {
    const snapshot = base(); snapshot.candidates[0].priceCents = null; snapshot.candidates[0].currency = null;
    expect(calculateRelaxations(snapshot).options).toEqual([]);
  });

  it('does not suggest a concession for an already feasible candidate', () => {
    const snapshot = base(); snapshot.candidates[0].priceCents = 240000;
    expect(calculateRelaxations(snapshot).options).toEqual([]);
  });

  it('is stable when candidate order changes', () => {
    const first = calculateRelaxations(base()); const reversed = base(); reversed.candidates.reverse();
    expect(calculateRelaxations(reversed)).toEqual(first);
  });
});
