# Red-team Round 13 — concurrent recovery-link redemption

**State:** Finding reproduced against local Wrangler D1 and fixed; rerun passed.
**Date:** 2026-10-14.
**Pre-fix revision:** `1da6fc2` (`docs: record recovery expiry D1 induction`).
**Threat model:** A caller with a valid, unused recovery link submits it multiple times concurrently, or two requests race after passing the initial token lookup.
**Scope:** Recovery token consumption, room state transition, creator-session insertion, and response/state consistency. All account, room, and token data were synthetic. No provider or production service was used.

## Prediction before induction

The one-time link should produce at most one successful recovery and exactly one creator session. Every losing request should fail without creating a session. The room should end in `recovered_read_only` and the token should be consumed.

## R13-01 — losing recovery requests created sessions

**CONFIRMED BY INDUCTION (actual Worker + local Wrangler D1):** Against the pre-fix code, 32 concurrent POSTs to `/api/creator-links/consume` produced one HTTP 200 and 31 HTTP 409 responses, but D1 recorded 32 creator sessions. The response check caught the losing requests only after their session insert had already run.

The recovery batch now inserts a creator session only when SQLite reports that the immediately preceding token-consumption `UPDATE` changed one row (`changes() = 1`), while retaining the recovered-room ownership/status predicate. D1 batches execute statements in order; the local Worker/D1 rerun of the same 32-request race produced one HTTP 200, 31 HTTP 409, and one additional session. No schema migration was needed.

## Variant analysis

- **Recovery replay after completion:** The recovery path shares this guarded batch; the regression test submits the same link concurrently and checks that only one session exists.
- **Creator login link:** Login consumes the token in its own batch and checks the update result before proceeding. It creates the session only after a later ownership-link batch; it does not use the recovery transition, and the new `changes()` guard was not applied there. Concurrent login-link behavior remains a separate candidate for a future local D1 induction.
- **Close, reopen, delete, and scheduled purge:** These use different state transitions and are outside this token-redemption finding. The scheduled purge's recovery-window predicate remains covered by Round 11.
- **Exact expiry boundary and distributed/deployed D1 behavior:** Not tested here.

## Regression-test integrity

- **Oracle:** invariant — 8 concurrent requests yield exactly one 200, every other response is a rejection (400/409/410), the room reaches recovered read-only, and the fake store contains exactly one creator session.
- **Red first:** The new test failed on the unfixed code with 8 sessions instead of 1. The real local D1 induction independently showed 32 instead of 1.
- **Negative control:** Temporarily removing `changes() = 1` made the regression fail again with 8 sessions. The guard was restored before the green run.
- **Mocks:** The automated test uses the existing synthetic DB adapter, extended to serialize batches and model `changes()`; actual SQL batch semantics were separately exercised in local Wrangler D1.
- **Limits:** The test does not model Cloudflare's distributed production placement or live browser/email timing. It does establish the D1 predicate on the installed local Wrangler engine.

## Reproduction data

The raw link token below is synthetic. Its SHA-256 is stored in D1; the handler receives the raw token.

```text
raw token: synthetic-r13-recovery-race-token-20261014-second
SHA-256:   20205a12be32896ae1f0e7df19b5c9bccc289c9b32a8dbfa40854b97e8676bca
room:      r13-race-room-2
account:   r13-account
```

The initial failing induction used the same process against `1da6fc2` with the synthetic token `synthetic-r13-recovery-race-token-20261014-very-long`; it returned 1×200 and 31×409 while leaving 32 sessions. The fixed induction seeded a fresh room/token and then issued 32 simultaneous requests. Fixtures lived only in `/tmp/aporia-round11-d1`.

## Verification

After the fix, `npm test` passed 34 tests in 9 files, `npm run build` passed, and `git diff --check` passed. No production database, email provider, Gemini, or Cloudflare deployment was used.
