export class ApiRequestError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export function actionableRequestError(error: unknown, fallback: string, rateLimited: string): string {
  return error instanceof ApiRequestError && error.code === 'rate_limited' ? rateLimited : fallback;
}
