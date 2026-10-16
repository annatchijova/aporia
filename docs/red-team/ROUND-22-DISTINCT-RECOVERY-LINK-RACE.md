# Red-team Round 22 — concurrent recovery with distinct links

**State:** A recovery race was reproduced against the actual Worker and local Wrangler D1, fixed, and rechecked.
**Date:** 2026-10-16.
**Threat model:** The verified room creator has two different valid, unused recovery emails for one room and opens both links at nearly the same time.
**Scope:** Room recovery state transition, consumption of two distinct tokens, creator-session creation, and HTTP/database consistency. Synthetic account, room, and links; no provider, production D1, or deployed Worker.

## Prediction before induction

Round 13 proved that replaying one recovery token produces one creator session. Distinct links are different credentials, though, and both requests can pass their initial token and trashed-room reads before either D1 batch executes. The first batch should change `trashed` to `recovered_read_only`; the second should lose without consuming its token or creating a session. I inspected the batch predicates and suspected the token update in a losing batch could still proceed because it checked only that the room was already recovered.

## R22-01 — losing distinct link was consumed and created a session

The D1 integration test seeded two distinct recovery hashes and held both actual Worker requests immediately before their recovery batches until both had reached the gate.

**CONFIRMED BY INDUCTION (pre-fix, actual Worker + local Wrangler D1):** Results were HTTP 200 and HTTP 409; the room ended `recovered_read_only`, but both tokens had `used_at` set and two creator sessions existed. The losing request's room update changed zero rows, but its following token update matched the already recovered room and consumed its own valid link. The session insert then followed that token update. The route's final result check returned 409 only after those side effects.

## Fix and variant analysis

The recovery-token `UPDATE` now includes `changes() = 1`, which refers to the immediately preceding room-transition statement in the same D1 batch. The token can therefore be consumed only by the request whose batch changed the room from `trashed` to `recovered_read_only`. The existing session insert remains conditional on the immediately preceding token update; the outer result check still returns a conflict to the loser.

**CONFIRMED BY INDUCTION (fixed):** The controlled race returned one HTTP 200 and one HTTP 409. D1 contained one consumed recovery token and one creator session. The regression initially failed with two consumed tokens instead of one; the pre-fix version then explicitly asserted and observed two sessions as well. After the fix, the one-token/one-session invariant passed against local Wrangler D1.

Adjacent paths checked:

- Replaying the same recovery token remains separately covered by Round 13.
- Two different creator login links are a distinct flow and were previously observed to create two sessions in Round 15; this patch is scoped to recovery tokens and does not change that behavior.
- Recovery racing the scheduled purge and exact deadline arbitration remain covered by R17/R18. The current probe uses an unexpired room and does not claim deployed scheduling behavior.

## Verification and limits

`npx vitest run --config vitest.d1.config.mjs --reporter verbose` passes four local Wrangler D1 tests: concurrent delete cooldown, delayed reopen/delete ordering, ambiguous-email retry expiry, and this distinct-link recovery race. `npm test` passes 37 tests across 9 files, `npm run build` passes TypeScript checking and Vite bundling, and `git diff --check` passes.

The D1 harness uses a minimal synthetic schema and an explicit barrier before the actual Worker batch. It does not replay all migrations or run inside deployed workerd. No real email, production D1, or Cloudflare deployment was used.

See [Round 13](ROUND-13-RECOVERY-REDEMPTION-RACE.md), the [round plan](APORIA-ROUND-PLAN.md), and the [local D1 harness](../../scripts/red-team/round19-20-lifecycle-races-d1.mjs).
