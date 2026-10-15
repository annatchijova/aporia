# Red-team Round 18 — recovery at exact deadline equality

**State:** Exact equality was checked in both the Worker handler test and direct local D1 predicates; the tested race ended in a complete purge. No production-code defect was confirmed.
**Date:** 2026-10-14.
**Code revision:** `efa3bea` (`fix: align recovery link and purge deadlines`).
**Threat model:** A creator submits a recovery link at the exact instant when both the token and the room recovery window expire, while the hourly purge begins.
**Scope:** The two expiry comparisons, token consumption, room transition, session insertion, and scheduled purge. The Worker handlers ran with the suite's synthetic D1 adapter and a frozen clock; no production database, provider, or deployed Worker was used.

## Prediction before induction

The accepted interval is open at its upper bound: recovery requires both `expires_at > now()` and `recovery_until > now()`. At equality, neither credential nor room is recoverable. The purge uses the complementary inclusive comparisons (`<= now()`), so token removal and room deletion should remain consistent regardless of which operation reaches the database adapter first.

## R18-01 — simultaneous consume and scheduled purge at equality

**CONFIRMED BY INDUCTION (actual Worker handlers + synthetic D1 adapter):** The test freezes time, creates a recovery token and room with the same expiry timestamp, advances the clock to that timestamp, then starts link consumption and the scheduled Worker handler together. Consumption returned HTTP 400. The scheduled handler completed; final state was `purged`, with no recovery token or creator session. The purge adapter also recorded the room deletion.

The expiry conditions in the live Worker agree at the boundary: recovery checks strict `>`, while cleanup uses inclusive `<=`. No recovery/purge inconsistency was confirmed in this simulated interleaving.

**CONFIRMED BY INDUCTION (direct local Wrangler D1):** Seeded a synthetic room and recovery token with the same literal expiry timestamp, then evaluated both comparisons against that exact value. D1 returned `token_recoverable=0`, `room_recoverable=0`, `token_purge_due=1`, and `room_purge_due=1`. The recovery-shaped conditional update changed zero rows; the purge-shaped token/room deletes left zero rows. This checked D1's exact comparison semantics and foreign-key-free base case; it did not invoke the Worker against D1.

## Test integrity and limits

The concurrent test uses the actual exported Worker `fetch` and `scheduled` handlers, a fixed clock, and a synthetic storage adapter that serializes batches. It proves the code's exact timestamp predicates and final state under that adapter. The separate Wrangler D1 probe checked the exact SQL comparison semantics using the same literal timestamp. Running the Worker and cron concurrently against D1 at the exact boundary remains open; so does deployed Cloudflare scheduling.

The first targeted run exposed a test-adapter mismatch: it modeled deletion of login links as deletion of recovery links too. The adapter now preserves recovery tokens on the login-only cleanup path. A negative-control mutation changing the token boundary from `<=` to `<` made the exact-boundary test fail (400 became 410); the mutation was reverted before the green run.

`npm test` passes 37 tests across 9 files; `npm run build` and `git diff --check` pass. No production code changed.

See the [round plan](APORIA-ROUND-PLAN.md).
