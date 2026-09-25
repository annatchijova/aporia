import { evaluateSnapshot } from './evaluator';
import type { Candidate, Constraint, DecisionSnapshot, RelaxationOption, RelaxationResult } from './model';

export const RELAXATION_POLICY_VERSION = 'l4.0.0';
const MAX_OPTIONS = 8;

function optionFor(candidate: Candidate, constraint: Extract<Constraint, { kind: 'availability' | 'budget_max' }>, snapshot: DecisionSnapshot): RelaxationOption | null {
  if (constraint.kind === 'budget_max') {
    if (candidate.priceCents === null || candidate.currency !== constraint.currency || candidate.priceCents <= constraint.maxCents) return null;
    return { id: `${candidate.id}:${constraint.factId}`, policyVersion: RELAXATION_POLICY_VERSION, candidateId: candidate.id, candidateTitle: candidate.title, constraintKind: constraint.kind, participantId: constraint.participantId, factId: constraint.factId, change: { kind: 'budget_max', fromCents: constraint.maxCents, toCents: candidate.priceCents, currency: constraint.currency }, cost: { unit: 'cents', amount: candidate.priceCents - constraint.maxCents } };
  }
  if (candidate.weekday === constraint.weekday) {
    const addedMinutes = Math.max(0, constraint.startMinute - candidate.startMinute) + Math.max(0, candidate.endMinute - constraint.endMinute);
    return { id: `${candidate.id}:${constraint.factId}`, policyVersion: RELAXATION_POLICY_VERSION, candidateId: candidate.id, candidateTitle: candidate.title, constraintKind: constraint.kind, participantId: constraint.participantId, factId: constraint.factId, change: { kind: 'availability', fromWeekday: constraint.weekday, fromStartMinute: constraint.startMinute, fromEndMinute: constraint.endMinute, toWeekday: candidate.weekday, toStartMinute: Math.min(constraint.startMinute, candidate.startMinute), toEndMinute: Math.max(constraint.endMinute, candidate.endMinute) }, cost: { unit: 'minutes', amount: addedMinutes + 1 } };
  }
  return { id: `${candidate.id}:${constraint.factId}`, policyVersion: RELAXATION_POLICY_VERSION, candidateId: candidate.id, candidateTitle: candidate.title, constraintKind: constraint.kind, participantId: constraint.participantId, factId: constraint.factId, change: { kind: 'availability', fromWeekday: constraint.weekday, fromStartMinute: constraint.startMinute, fromEndMinute: constraint.endMinute, toWeekday: candidate.weekday, toStartMinute: candidate.startMinute, toEndMinute: candidate.endMinute }, cost: { unit: 'minutes', amount: 1440 + candidate.endMinute - candidate.startMinute } };
}

export function calculateRelaxations(snapshot: DecisionSnapshot): RelaxationResult {
  const options: RelaxationOption[] = [];
  const baseline = evaluateSnapshot(snapshot);
  const candidates = [...snapshot.candidates].sort((a, b) => a.id.localeCompare(b.id));
  for (const candidate of candidates) {
    if (baseline.candidateResults.find((item) => item.candidateId === candidate.id)?.feasible) continue;
    for (const constraint of snapshot.constraints) {
      if (constraint.kind !== 'availability' && constraint.kind !== 'budget_max') continue;
      const withoutConstraint = snapshot.constraints.filter((item) => item !== constraint);
      const relaxed = evaluateSnapshot({ ...snapshot, constraints: withoutConstraint });
      const result = relaxed.candidateResults.find((item) => item.candidateId === candidate.id);
      if (!result?.feasible) continue;
      const option = optionFor(candidate, constraint, snapshot);
      if (option) options.push(option);
    }
  }
  options.sort((a, b) => a.cost.amount - b.cost.amount || a.candidateId.localeCompare(b.candidateId) || a.factId.localeCompare(b.factId));
  return { snapshotRevision: snapshot.revision, policyVersion: RELAXATION_POLICY_VERSION, options: options.slice(0, MAX_OPTIONS) };
}
