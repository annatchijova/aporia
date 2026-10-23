import { describe, expect, it } from 'vitest';
import { actionableRequestError, ApiRequestError } from './request-error';

describe('actionableRequestError', () => {
  it('explains provider rate limits without suggesting an immediate retry', () => {
    expect(actionableRequestError(new ApiRequestError('request failed', 'rate_limited'), 'generic', 'wait first'))
      .toBe('wait first');
  });

  it('keeps the existing generic message for unrelated failures', () => {
    expect(actionableRequestError(new ApiRequestError('request failed', 'unavailable'), 'generic', 'wait first'))
      .toBe('generic');
    expect(actionableRequestError(new Error('network failed'), 'generic', 'wait first'))
      .toBe('generic');
  });
});
