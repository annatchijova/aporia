import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/red-team/round19-concurrent-delete-d1.mjs'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
