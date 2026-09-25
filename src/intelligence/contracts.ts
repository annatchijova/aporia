import type { InputArtifact, ExtractionProposal } from '../core/model';

export interface ProviderCapabilities {
  name: string;
  model: string;
  textExtraction: boolean;
  imageExtraction: boolean;
  candidateProposal: boolean;
  structuredOutput: boolean;
}

export interface ExtractionRequest {
  artifact: InputArtifact;
  participantNames: string[];
}

export interface CandidateProposalRequest {
  prompt: string;
  knownConstraints: string[];
}

export interface CandidateDraft {
  title: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  priceCents: number | null;
  currency: string | null;
  area: string | null;
}

export interface CandidateProposalResponse {
  candidates: CandidateDraft[];
  provider: { name: string; model: string; requestId?: string };
  warnings: string[];
}

export interface IntelligenceProvider {
  capabilities(): ProviderCapabilities;
  extract(request: ExtractionRequest): Promise<ExtractionProposal>;
  propose(request: CandidateProposalRequest): Promise<CandidateProposalResponse>;
}

export class ProviderError extends Error {
  constructor(public readonly code: 'unavailable' | 'timeout' | 'invalid_output' | 'rate_limited', message: string, public readonly retryable = code === 'timeout' || code === 'rate_limited') {
    super(message);
    this.name = 'ProviderError';
  }
}
