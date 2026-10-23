import type { ClaimKind, ClaimProposal, ExtractionProposal, InputArtifact } from '../core/model';
import { assertBoundedText, assertCents, assertMinute, assertWeekday } from '../core/model';
import { ProviderError } from './contracts';

const claimKinds = new Set<ClaimKind>(['availability', 'budget_max', 'area_preference', 'dietary_note', 'proposal']);
const MAX_CLAIMS = 64;
const MAX_AMBIGUITIES = 8;
const MAX_PROVIDER_TEXT = 500;

function parseStringList(value: unknown, maxItems: number, field: string): string[] {
  if (!Array.isArray(value)) return [];
  const strings = value.filter((item): item is string => typeof item === 'string');
  if (strings.length > maxItems || strings.some((item) => item.length > MAX_PROVIDER_TEXT)) {
    throw new ProviderError('invalid_output', `${field} exceeds provider limits`, false);
  }
  return strings;
}

function parseClaim(value: unknown, index: number): ClaimProposal {
  if (!value || typeof value !== 'object') throw new ProviderError('invalid_output', `claim ${index} is not an object`);
  const claim = value as Record<string, unknown>;
  if (typeof claim.id !== 'string' || claim.id.length === 0 || claim.id.length > 128 || typeof claim.kind !== 'string' || !claimKinds.has(claim.kind as ClaimKind)) throw new ProviderError('invalid_output', `claim ${index} has invalid identity`);
  const participantId = claim.participantId === null || typeof claim.participantId === 'string' ? claim.participantId : null;
  const sourceText = typeof claim.sourceText === 'string' ? claim.sourceText.slice(0, 500) : '';
  const confidence = claim.confidence === 'high' || claim.confidence === 'medium' || claim.confidence === 'low' ? claim.confidence : 'unknown';
  const ambiguity = parseStringList(claim.ambiguity, MAX_AMBIGUITIES, `claim ${index} ambiguity`);
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
  if (Array.isArray(body.claims) && body.claims.length > MAX_CLAIMS) throw new ProviderError('invalid_output', 'provider returned too many claims', false);
  const claims = Array.isArray(body.claims) ? body.claims.map(parseClaim) : [];
  if (new Set(claims.map((claim) => claim.id)).size !== claims.length) throw new ProviderError('invalid_output', 'provider returned duplicate claim identifiers', false);
  const warnings = parseStringList(body.warnings, 16, 'provider warnings');
  return { id: crypto.randomUUID(), artifact, claims, warnings, provider, status: 'pending' };
}
