import type { Candidate, CandidateResult, Constraint, DecisionSnapshot, Evaluation, Preference } from './model';

const EVALUATOR_VERSION = 'l1.0.0';

function evaluateCandidate(candidate: Candidate, constraints: Constraint[], preferences: Preference[]): CandidateResult {
  const hardViolations: string[] = [];
  const unknowns: string[] = [];
  const satisfied: string[] = [];
  let preferenceScore = 0;

  for (const constraint of constraints) {
    if (constraint.kind === 'availability') {
      const sameDay = candidate.weekday === constraint.weekday;
      const inside = candidate.startMinute >= constraint.startMinute && candidate.endMinute <= constraint.endMinute;
      if (sameDay && inside) satisfied.push(`${constraint.participantId} availability`);
      else hardViolations.push(`${constraint.participantId} is not available for this time`);
    } else if (constraint.kind === 'budget_max') {
      if (candidate.priceCents === null) unknowns.push(`${constraint.participantId} budget: candidate price unknown`);
      else if (candidate.currency !== constraint.currency) unknowns.push(`${constraint.participantId} budget: currency unknown`);
      else if (candidate.priceCents <= constraint.maxCents) satisfied.push(`${constraint.participantId} budget`);
      else hardViolations.push(`${constraint.participantId} budget exceeded`);
    } else if (constraint.kind === 'area_preference') {
      if (candidate.area === null) unknowns.push(`${constraint.participantId} area: candidate area unknown`);
      else if (candidate.area.toLocaleLowerCase() === constraint.area.toLocaleLowerCase()) {
        preferenceScore += 1;
        satisfied.push(`${constraint.participantId} area preference`);
      }
    }
  }

  for (const preference of preferences) {
    if (preference.kind === 'area_preference' && candidate.area?.toLocaleLowerCase() === preference.area.toLocaleLowerCase()) preferenceScore += 1;
  }

  return {
    candidateId: candidate.id,
    feasible: hardViolations.length === 0 && unknowns.length === 0,
    hardViolations,
    unknowns,
    satisfied,
    preferenceScore,
  };
}

export function evaluateSnapshot(snapshot: DecisionSnapshot): Evaluation {
  const candidates = [...snapshot.candidates].sort((a, b) => a.id.localeCompare(b.id));
  const candidateResults = candidates.map((candidate) => evaluateCandidate(candidate, snapshot.constraints, snapshot.preferences));
  const rankedCandidateIds = [...candidateResults]
    .sort((a, b) => {
      if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
      if (a.preferenceScore !== b.preferenceScore) return b.preferenceScore - a.preferenceScore;
      return a.candidateId.localeCompare(b.candidateId);
    })
    .map((result) => result.candidateId);

  return {
    snapshotRevision: snapshot.revision,
    candidateResults,
    rankedCandidateIds,
    evaluatorVersion: EVALUATOR_VERSION,
  };
}
