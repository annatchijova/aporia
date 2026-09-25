import type { ClaimKind, ClaimProposal, ExtractionProposal, InputArtifact } from '../core/model';
import { assertBoundedText, assertCents, assertMinute, assertWeekday } from '../core/model';
import { ProviderError } from './contracts';

const claimKinds = new Set<ClaimKind>(['availability', 'budget_max', 'area_preference', 'proposal']);

function parseClaim(value: unknown, index: number): ClaimProposal {
  if (!value || typeof value !== 'object') throw new ProviderError('invalid_output', `claim ${index} is not an object`);
  const claim = value as Record<string, unknown>;
  if (typeof claim.id !== 'string' || typeof claim.kind !== 'string' || !claimKinds.has(claim.kind as ClaimKind)) throw new ProviderError('invalid_output', `claim ${index} has invalid identity`);
  const participantId = claim.participantId === null || typeof claim.participantId === 'string' ? claim.participantId : null;
  const sourceText = typeof claim.sourceText === 'string' ? claim.sourceText.slice(0, 500) : '';
  const confidence = claim.confidence === 'high' || claim.confidence === 'medium' || claim.confidence === 'low' ? claim.confidence : 'unknown';
  const ambiguity = Array.isArray(claim.ambiguity) ? claim.ambiguity.filter((item): item is string => typeof item === 'string').slice(0, 8) : [];
  const raw = claim.value;
  if (!raw || typeof raw !== 'object') throw new ProviderError('invalid_output', `claim ${index} has no typed value`);
  const typed = raw as Record<string, unknown>;

  let parsedValue: ClaimProposal['value'];
  if (claim.kind === 'availability') {
    parsedValue = { weekday: assertWeekday(typed.weekday as number), startMinute: assertMinute(typed.startMinute as number, 'startMinute'), endMinute: assertMinute(typed.endMinute as number, 'endMinute') };
    if (parsedValue.endMinute <= parsedValue.startMinute) throw new ProviderError('invalid_output', `claim ${index} availability interval is empty`);
  } else if (claim.kind === 'budget_max') {
    parsedValue = { maxCents: assertCents(typed.maxCents as number, 'maxCents'), currency: assertBoundedText(String(typed.currency ?? ''), 'currency', 8).toUpperCase() };
  } else if (claim.kind === 'area_preference') {
    parsedValue = { area: assertBoundedText(String(typed.area ?? ''), 'area', 80) };
  } else {
    parsedValue = { text: assertBoundedText(String(typed.text ?? ''), 'proposal text', 300) };
  }

  return { id: claim.id, kind: claim.kind as ClaimKind, participantId, value: parsedValue, sourceText, confidence, ambiguity };
}

export function parseExtractionResponse(raw: unknown, artifact: InputArtifact, provider: { name: string; model: string; requestId?: string }): ExtractionProposal {
  if (!raw || typeof raw !== 'object') throw new ProviderError('invalid_output', 'provider response is not an object');
  const body = raw as Record<string, unknown>;
  const claims = Array.isArray(body.claims) ? body.claims.map(parseClaim) : [];
  const warnings = Array.isArray(body.warnings) ? body.warnings.filter((item): item is string => typeof item === 'string').slice(0, 16) : [];
  return { id: crypto.randomUUID(), artifact, claims, warnings, provider, status: 'pending' };
}
