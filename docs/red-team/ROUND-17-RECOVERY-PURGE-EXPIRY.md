# Red-team Round 17 — recovery versus scheduled purge and link expiry

**State:** Concurrent purge invariant held in local D1. A recovery-link/recovery-window mismatch was reproduced and fixed.
**Date:** 2026-10-14.
**Pre-fix revision:** `5aecd2c` (`fix: explain recovery link timing window`).
**Threat model:** A creator opens a recovery link while the scheduled seven-day purge is acting on the same room; separately, email delivery is delayed long enough that the recovery token's original seven-day TTL ends before the room's recovery deadline.
**Scope:** Recovery-link consumption, room recovery deadline, auth-token expiry, scheduled purge, and dependent-row cleanup. Every account, room, token, and child row was synthetic. No provider, production database, or deployed Worker was used.

## Prediction before induction

For an expired trashed room, concurrent recovery and purge must end in one complete state: either the room is restored before expiry, or the room and its dependent data are purged. It must not leave a recovered room whose data was deleted, nor a trashed room missing its recovery token before its advertised recovery deadline.

## R17-01 — recovery requests concurrent with scheduled purge

**CONFIRMED BY INDUCTION (actual local Wrangler Worker + D1):** Thirty-two recovery requests were launched at the same time as the Worker scheduled handler for an already expired room. The cron returned 200; all 32 recovery attempts returned 400 because the purge's first batch removed the auth token. Follow-up D1 queries found zero room, recovery token, and creator account rows. In a separate run with synthetic participant, session, message, proposal, claim-decision, candidate, event, and candidate-proposal rows, the purge removed all eleven checked categories as well.

The result was a complete purge. No room or dependent data remained, and no recovery request created a creator session. The race did not confirm a partial-state defect. Because the recovery window was already expired before the requests began, this is not evidence about a request that passed its initial checks immediately before the exact deadline; exact-boundary scheduling remains open.

## R17-02 — link expires before the room's recovery deadline

**CONFIRMED BY INDUCTION (actual local Wrangler Worker + D1):** A synthetic trashed room with a future `recovery_until` and a recovery token whose `expires_at` was in the past received 32 concurrent consume requests; all returned 400. The scheduled handler removed the expired token but preserved the room and its recovery snapshot because the room deadline was still in the future. Before the fix, that room could no longer be recovered with its only token.

The timing mismatch was present in production code: `sendCreatorLink` started the token's seven days before the provider call returned, while the delete handler started the room's seven days afterward. A sufficiently delayed provider response therefore made the token expire before the room. The local induction seeded that state directly; it did not induce an eight-day network delay against a real provider.

## Fix

`sendCreatorLink` now returns the stored token hash to its caller. After the email provider accepts a recovery email, the delete batch sets that specific unused token's expiry to the same timestamp as the room's `recovery_until`, guarded on the room transition having reached `trashed`. Recovery-token duration now exactly matches the room's seven-day retention window. Login-link TTLs are unaffected.

## Regression and verification

The Worker regression advances a synthetic clock by eight days while the mocked email request is pending, then verifies that the token remains valid through the room's full seven-day recovery window and successfully restores the room. `npm test` passes 36 tests across 9 files; `npm run build` and `git diff --check` pass.

The local D1 concurrent-purge run used Wrangler's scheduled test endpoint and an isolated store at `/tmp/aporia-round17-d1`. The separate token-gap run also used that isolated D1. No real secrets or email were loaded.

## Limits and follow-up

This does not establish exact deadline equality behavior under Cloudflare scheduling, a live provider's delivery delay, deployed D1 concurrency, or browser behavior. Recovery remains gated by both `token.expires_at > now()` and `room.recovery_until > now()`; both now share the same configured deadline. Continue with exact-boundary and other lifecycle variants in a later round.

See the [synthetic fixture](fixtures/ROUND-17-RECOVERY-PURGE-EXPIRY.sql) and [round plan](APORIA-ROUND-PLAN.md).
