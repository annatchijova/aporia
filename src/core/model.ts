export const SCHEMA_VERSION = 1 as const;

export type ProposalStatus = 'pending' | 'confirmed' | 'edited' | 'rejected' | 'failed';
export type ClaimKind = 'availability' | 'budget_max' | 'area_preference' | 'proposal';

export interface Participant {
  id: string;
  displayName: string;
}

export interface InputArtifact {
  id: string;
  kind: 'text';
  content: string;
  contentHash: string;
  createdAt: string;
  participantId: string;
}

export interface ClaimProposal {
  id: string;
  kind: ClaimKind;
  participantId: string | null;
  value: AvailabilityValue | BudgetValue | AreaValue | ProposalValue;
  sourceText: string;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  ambiguity: string[];
}

export interface ExtractionProposal {
  id: string;
  artifact: InputArtifact;
  claims: ClaimProposal[];
  warnings: string[];
  provider: { name: string; model: string; requestId?: string };
  status: ProposalStatus;
}

export interface AvailabilityValue {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface BudgetValue {
  maxCents: number;
  currency: string;
}

export interface AreaValue {
  area: string;
}

export interface ProposalValue {
  text: string;
}

export interface Fact {
  id: string;
  kind: ClaimKind;
  participantId: string;
  value: ClaimProposal['value'];
  sourceProposalId: string;
  confirmedBy: string;
  confirmedAt: string;
}

export type Constraint =
  | { kind: 'availability'; participantId: string; weekday: number; startMinute: number; endMinute: number; factId: string }
  | { kind: 'budget_max'; participantId: string; maxCents: number; currency: string; factId: string }
  | { kind: 'area_preference'; participantId: string; area: string; factId: string };

export interface Preference {
  kind: 'area_preference';
  participantId: string;
  area: string;
  factId: string;
}

export interface Candidate {
  id: string;
  title: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  priceCents: number | null;
  currency: string | null;
  area: string | null;
  source: { kind: 'manual'; ref: string };
}

export interface CandidateResult {
  candidateId: string;
  feasible: boolean;
  hardViolations: string[];
  unknowns: string[];
  satisfied: string[];
  preferenceScore: number;
}

export interface Evaluation {
  snapshotRevision: number;
  candidateResults: CandidateResult[];
  rankedCandidateIds: string[];
  evaluatorVersion: string;
}

export interface DecisionSnapshot {
  schemaVersion: typeof SCHEMA_VERSION;
  roomId: string;
  title: string;
  revision: number;
  participants: Participant[];
  facts: Fact[];
  constraints: Constraint[];
  preferences: Preference[];
  candidates: Candidate[];
  evaluation: Evaluation | null;
}

export interface RoomEvent {
  id: string;
  roomId: string;
  revision: number;
  actorId: string;
  type: string;
  payload: unknown;
  createdAt: string;
}

export function emptySnapshot(roomId: string, title: string): DecisionSnapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    roomId,
    title,
    revision: 0,
    participants: [],
    facts: [],
    constraints: [],
    preferences: [],
    candidates: [],
    evaluation: null,
  };
}

export function assertBoundedText(value: string, field: string, max: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw new Error(`${field} must be non-empty and at most ${max} characters`);
  }
  return value.trim();
}

export function assertMinute(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 1440) throw new Error(`${field} must be an integer between 0 and 1440`);
  return value;
}

export function assertWeekday(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 6) throw new Error('weekday must be an integer from 0 to 6');
  return value;
}

export function assertCents(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer`);
  return value;
}
