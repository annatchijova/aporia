export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export function actionableRequestError(
  error: unknown,
  fallback: string,
  rateLimited: string,
  retryAfter: (seconds: number) => string,
): string {
  if (!(error instanceof ApiRequestError) || (error.code !== 'rate_limited' && error.status !== 429)) return fallback;
  return error.retryAfterSeconds === undefined ? rateLimited : retryAfter(error.retryAfterSeconds);
}
