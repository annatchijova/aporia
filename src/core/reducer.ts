import type { Constraint, DecisionSnapshot, Fact, Participant, RoomEvent } from './model';
import { evaluateSnapshot } from './evaluator';

export function applyEvent(snapshot: DecisionSnapshot, event: RoomEvent): DecisionSnapshot {
  if (event.roomId !== snapshot.roomId) throw new Error('event room mismatch');
  if (event.revision !== snapshot.revision + 1) throw new Error('event revision must be monotonic');
  const next: DecisionSnapshot = structuredClone(snapshot);
  next.revision = event.revision;

  if (event.type === 'participant.added') {
    const participant = event.payload as Participant;
    if (next.participants.some((item) => item.id === participant.id)) throw new Error('duplicate participant');
    next.participants.push(participant);
  } else if (event.type === 'fact.confirmed') {
    const fact = event.payload as Fact;
    if (next.facts.some((item) => item.id === fact.id)) throw new Error('duplicate fact');
    next.facts.push(fact);
    if (fact.kind === 'availability') {
      const value = fact.value as { weekday: number; startMinute: number; endMinute: number };
      next.constraints.push({ kind: 'availability', participantId: fact.participantId, ...value, factId: fact.id });
    } else if (fact.kind === 'budget_max') {
      const value = fact.value as { maxCents: number; currency: string };
      next.constraints.push({ kind: 'budget_max', participantId: fact.participantId, ...value, factId: fact.id });
    } else if (fact.kind === 'area_preference') {
      const value = fact.value as { area: string };
      next.preferences.push({ kind: 'area_preference', participantId: fact.participantId, area: value.area, factId: fact.id });
    }
  } else if (event.type === 'candidate.added') {
    const candidate = event.payload as DecisionSnapshot['candidates'][number];
    if (next.candidates.some((item) => item.id === candidate.id)) throw new Error('duplicate candidate');
    next.candidates.push(candidate);
  } else {
    throw new Error(`unsupported event type: ${event.type}`);
  }

  next.evaluation = evaluateSnapshot(next);
  return next;
}
