import type { InputArtifact } from '../core/model';
import { ProviderError, type CandidateProposalRequest, type CandidateProposalResponse, type ExtractionRequest, type IntelligenceProvider, type ProviderCapabilities } from './contracts';
import { parseExtractionResponse } from './schema';

interface GeminiEnv { GEMINI_API_KEY?: string; GEMINI_MODEL?: string; }

export class GeminiProvider implements IntelligenceProvider {
  private readonly model: string;
  constructor(private readonly env: GeminiEnv) {
    this.model = env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  }

  capabilities(): ProviderCapabilities {
    return { name: 'gemini', model: this.model, textExtraction: true, imageExtraction: false, candidateProposal: false, structuredOutput: true };
  }

  private async generate(contents: unknown[], schema: Record<string, unknown>): Promise<{ data: unknown; requestId?: string }> {
    if (!this.env.GEMINI_API_KEY) throw new ProviderError('unavailable', 'Gemini is not configured server-side');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.env.GEMINI_API_KEY },
        body: JSON.stringify({ contents, generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0 } }),
        signal: controller.signal,
      });
      if (response.status === 429) throw new ProviderError('rate_limited', 'Gemini rate limit reached');
      if (!response.ok) throw new ProviderError('unavailable', `Gemini request failed with status ${response.status}`);
      const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; responseId?: string };
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new ProviderError('invalid_output', 'Gemini returned no structured content');
      try { return { data: JSON.parse(text), requestId: payload.responseId }; } catch { throw new ProviderError('invalid_output', 'Gemini returned invalid JSON'); }
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') throw new ProviderError('timeout', 'Gemini request timed out');
      throw new ProviderError('unavailable', 'Gemini request could not be completed');
    } finally { clearTimeout(timeout); }
  }

  async extract(request: ExtractionRequest) {
    const schema = { type: 'OBJECT', properties: { claims: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: { type: 'STRING' }, kind: { type: 'STRING', enum: ['availability', 'budget_max', 'area_preference', 'proposal'] }, participantId: { type: 'STRING', nullable: true }, value: { type: 'OBJECT', properties: { weekday: { type: 'INTEGER' }, startMinute: { type: 'INTEGER' }, endMinute: { type: 'INTEGER' }, maxCents: { type: 'INTEGER' }, currency: { type: 'STRING' }, area: { type: 'STRING' }, text: { type: 'STRING' } } }, sourceText: { type: 'STRING' }, confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] }, ambiguity: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['id', 'kind', 'value', 'sourceText', 'ambiguity'] } }, warnings: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['claims', 'warnings'] };
    const prompt = `Extract proposed planning claims from this human input. Do not decide truth or confirmation. Use participantId only when the text identifies one of these participants: ${request.participantNames.join(', ') || 'unknown'}. For ambiguous claims, add a warning or ambiguity and leave participantId null. Input:\n${request.artifact.content}`;
    const result = await this.generate([{ role: 'user', parts: [{ text: prompt }] }], schema);
    return parseExtractionResponse(result.data, request.artifact, { name: 'gemini', model: this.model, requestId: result.requestId });
  }

  async propose(_request: CandidateProposalRequest): Promise<CandidateProposalResponse> {
    throw new ProviderError('unavailable', 'Gemini candidate proposal is not implemented in L1');
  }
}
