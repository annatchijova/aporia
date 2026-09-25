import { assertBoundedText, assertCents, assertMinute, assertWeekday } from '../core/model';
import { ProviderError } from './contracts';
import type { CandidateDraft } from './contracts';

export function parseCandidateProposalResponse(raw: unknown): { candidates: CandidateDraft[]; warnings: string[] } {
  if (!raw || typeof raw !== 'object') throw new ProviderError('invalid_output', 'candidate proposal is not an object', false);
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.candidates)) throw new ProviderError('invalid_output', 'candidate proposal has no candidates', false);
  const candidates: CandidateDraft[] = body.candidates.slice(0, 8).map((item, index) => {
    if (!item || typeof item !== 'object') throw new ProviderError('invalid_output', `candidate ${index} is not an object`, false);
    const value = item as Record<string, unknown>;
    const price = value.priceCents === null || value.priceCents === undefined ? null : assertCents(Number(value.priceCents), `candidate ${index} priceCents`);
    const currency = price === null ? null : assertBoundedText(String(value.currency ?? ''), `candidate ${index} currency`, 8).toUpperCase();
    return {
      title: assertBoundedText(String(value.title ?? ''), `candidate ${index} title`, 120),
      weekday: assertWeekday(Number(value.weekday)),
      startMinute: assertMinute(Number(value.startMinute), `candidate ${index} startMinute`),
      endMinute: assertMinute(Number(value.endMinute), `candidate ${index} endMinute`),
      priceCents: price,
      currency,
      area: value.area === null || value.area === undefined || value.area === '' ? null : assertBoundedText(String(value.area), `candidate ${index} area`, 80),
    };
  });
  if (candidates.some((candidate) => candidate.endMinute <= candidate.startMinute)) throw new ProviderError('invalid_output', 'candidate interval is empty', false);
  const warnings = Array.isArray(body.warnings) ? body.warnings.filter((item): item is string => typeof item === 'string').slice(0, 16) : [];
  return { candidates, warnings };
}
