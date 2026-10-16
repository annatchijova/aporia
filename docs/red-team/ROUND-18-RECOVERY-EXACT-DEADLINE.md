# Red-team Round 18 — recovery at exact deadline equality

**State:** Exact equality and both winners were checked with Worker handlers and a real local Wrangler D1 binding; no production-code defect was confirmed.
**Initial probe:** 2026-10-14. **Local D1 follow-up:** 2026-10-16.
**Code revision:** `efa3bea` (`fix: align recovery link and purge deadlines`); boundary test added at `768d071` (`test: cover exact room recovery deadline`).
**Threat model:** A creator submits a recovery link at the exact instant when both the token and the room recovery window expire, while the hourly purge begins.
**Scope:** The two expiry comparisons, token consumption, room transition, session insertion, and scheduled purge. All accounts and rooms were synthetic. No provider, production database, or deployed Worker was used.

## Prediction before induction

The accepted interval is open at its upper bound: recovery requires both `expires_at > now()` and `recovery_until > now()`. At equality, neither credential nor room is recoverable. The purge uses the complementary inclusive comparisons (`<= now()`), so token removal and room deletion should remain consistent regardless of which operation reaches the database adapter first.

## R18-01 — simultaneous consume and scheduled purge at equality

**CONFIRMED BY INDUCTION (actual Worker handlers + synthetic D1 adapter):** The test freezes time, creates a recovery token and room with the same expiry timestamp, advances the clock to that timestamp, then starts link consumption and the scheduled Worker handler together. Consumption returned HTTP 400. The scheduled handler completed; final state was `purged`, with no recovery token or creator session. The purge adapter also recorded the room deletion.

The expiry conditions in the live Worker agree at the boundary: recovery checks strict `>`, while cleanup uses inclusive `<=`. No recovery/purge inconsistency was confirmed in this simulated interleaving.

**CONFIRMED BY INDUCTION (direct local Wrangler D1):** Seeded a synthetic room and recovery token with the same literal expiry timestamp, then evaluated both comparisons against that exact value. D1 returned `token_recoverable=0`, `room_recoverable=0`, `token_purge_due=1`, and `room_purge_due=1`. The recovery-shaped conditional update changed zero rows; the purge-shaped token/room deletes left zero rows. This checked D1's exact comparison semantics and foreign-key-free base case; it did not invoke the Worker against D1.

## R18-02 — recovery commits immediately before the deadline

**CONFIRMED BY INDUCTION (actual Worker handlers + Wrangler `getPlatformProxy` D1 binding):** With a frozen clock at one millisecond before the shared token/room deadline, the Worker consumed the link and committed recovery. At the deadline, the scheduled handler ran against the same D1 binding. It removed the expired token but preserved the room as `recovered_read_only` and preserved the one creator session.

## R18-03 — purge wins after recovery prechecks

**CONFIRMED BY INDUCTION (actual Worker handlers + Wrangler `getPlatformProxy` D1 binding):** The recovery request ran all reads at one millisecond before expiry and paused immediately before submitting its three-statement D1 batch. The clock advanced to the exact deadline; the scheduled handler purged the room and token. After releasing the paused batch, the recovery request returned HTTP 409. Follow-up D1 reads found no room, token, or creator session. The late conditional update could not restore data after purge.

## Test integrity and limits

The R18-01 concurrent test uses the actual exported Worker `fetch` and `scheduled` handlers, a fixed clock, and a synthetic storage adapter. The local D1 follow-ups ran those same imported Worker handlers in Node with a Wrangler `getPlatformProxy` D1 binding and a fixed clock. A narrow wrapper paused only the recovery batch in R18-03; all reads, writes, and scheduled cleanup ran on the D1 binding. The temporary experiment used a minimal synthetic schema for the lifecycle tables rather than replaying every migration. It validates D1 statement conditions and both controlled orderings; it does not establish workerd's runtime clock behavior, Cloudflare's deployed scheduling, or provider/browser behavior.

The first targeted run exposed a test-adapter mismatch: it modeled deletion of login links as deletion of recovery links too. The adapter now preserves recovery tokens on the login-only cleanup path. A negative-control mutation changing the token boundary from `<=` to `<` made the exact-boundary test fail (400 became 410); the mutation was reverted before the green run.

`npm test` passes 37 tests across 9 files; `npm run build` and `git diff --check` pass. No production code changed. The local D1 follow-up was a temporary experiment, removed after the run; the deterministic handler regression remains in `src/worker-room-recovery.test.ts`.

See the [round plan](APORIA-ROUND-PLAN.md).
