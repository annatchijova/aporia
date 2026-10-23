import { describe, expect, it } from 'vitest';
import { actionableRequestError, ApiRequestError } from './request-error';

describe('actionableRequestError', () => {
  it('explains provider rate limits without suggesting an immediate retry', () => {
    expect(actionableRequestError(new ApiRequestError('request failed', 'rate_limited', 429), 'generic', 'wait first', seconds => `wait ${seconds}`))
      .toBe('wait first');
  });

  it('uses a server Retry-After value for application rate limits without a provider error code', () => {
    expect(actionableRequestError(new ApiRequestError('too many requests', undefined, 429, 60), 'generic', 'wait first', seconds => `wait ${seconds}`))
      .toBe('wait 60');
  });

  it('keeps the existing generic message for unrelated failures', () => {
    expect(actionableRequestError(new ApiRequestError('request failed', 'unavailable', 503), 'generic', 'wait first', seconds => `wait ${seconds}`))
      .toBe('generic');
    expect(actionableRequestError(new Error('network failed'), 'generic', 'wait first', seconds => `wait ${seconds}`))
      .toBe('generic');
  });
});
