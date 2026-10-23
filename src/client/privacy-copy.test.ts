import { describe, expect, it } from 'vitest';
import { privacyCopy } from './privacy-copy';

describe('AI privacy disclosure copy', () => {
  it('names the external processor and the data sent for each AI action in Spanish', () => {
    expect(privacyCopy.es.aiProcessingNotice).toContain('Gemini');
    expect(privacyCopy.es.aiProcessingNotice).toContain('nombres visibles del grupo');
    expect(privacyCopy.es.aiProcessingNotice).toContain('restricciones confirmadas');
    expect(privacyCopy.es.screenshotConsent).toContain('acepto enviarla a Gemini');
    expect(privacyCopy.es.aiProcessingNotice).toContain('Evitá datos sensibles');
  });

  it('provides the same disclosure in English', () => {
    expect(privacyCopy.en.aiProcessingNotice).toContain('Gemini');
    expect(privacyCopy.en.aiProcessingNotice).toContain('display names');
    expect(privacyCopy.en.aiProcessingNotice).toContain('confirmed constraints');
    expect(privacyCopy.en.screenshotConsent).toContain('agree to send it to Gemini');
    expect(privacyCopy.en.aiProcessingNotice).toContain('Avoid sensitive information');
  });
});
