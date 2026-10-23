import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/red-team/round19-20-lifecycle-races-d1.mjs', 'scripts/red-team/round39-source-retention-d1.mjs'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
