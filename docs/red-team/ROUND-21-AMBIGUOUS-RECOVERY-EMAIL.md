# Red-team Round 21 — ambiguous recovery-email failure and retry

**State:** One bounded recovery-link expiry defect was reproduced against the actual Worker and local Wrangler D1, fixed, and rechecked.
**Date:** 2026-10-16.
**Threat model:** The room creator requests deletion. The email provider may accept a recovery email but the request connection fails before APORIA receives the response. The creator retries after the 60-second cooldown.
**Scope:** Recovery-token persistence on provider exceptions, delete retry, the seven-day trash deadline, and recovery-link consumption. Synthetic room/account data, frozen local clock, and intercepted `fetch`; no provider inbox, production D1, or deployed Worker.

## Prediction before induction

`sendCreatorLink` stores the hashed token before calling the provider. A thrown fetch error leaves that token in D1 because APORIA cannot know whether the provider accepted the message. On a later successful delete, the room's seven-day window starts at that later time. The delete batch appeared to extend only the latest token, so I predicted an earlier possibly delivered link could expire while the room was still recoverable.

## R21-01 — earlier possibly delivered link expires before room

The local integration test made the first provider call throw after capturing its synthetic email body, then advanced the clock by 61 seconds and returned success for the retry. The first request returned 503 and left the room closed with its token; the second returned 200 and trashed the room.

**CONFIRMED BY INDUCTION (pre-fix):** The first token expired seven days after the failed attempt, while the room deadline was seven days after the successful retry. At `recovery_until - 1 ms`, consuming the first link returned HTTP 400 even though the room remained within its recovery period. The second link was the only link extended to the room deadline.

This is an ambiguity simulation, not proof that a real provider accepted the first message. It establishes the consequence if that acceptance happened despite a lost response.

## Fix and variant coverage

The delete D1 batch now extends every unconsumed recovery token that is still valid at the delete commit, plus the token just sent by this delete attempt, to the exact `recovery_until`. The just-sent token is included even if a provider response took longer than its nominal token TTL (the delayed-send case covered in Round 17). Older expired tokens and already used tokens are excluded, so the retry does not revive stale credentials. The update remains conditional on the same room entering `trashed` with the expected `deleted_at` value.

The regression checks both current recovery links have the room deadline and then consumes the first link one millisecond before that deadline. It succeeds and recovers the room. The same D1 update is scoped to recovery tokens for this room; login tokens use another purpose and are not extended. The SQL predicate preserves expired-token exclusion while explicitly including the just-issued token; used tokens remain excluded. No additional provider behavior is inferred.

**CONFIRMED BY INDUCTION (fixed):** The focused test passes against the actual Worker handlers and isolated local Wrangler D1. The first, potentially delivered link can restore the room through the complete recovery window.

## Verification and limits

The regression failed before the patch with HTTP 400 for the old link at `recovery_until - 1 ms`; after the patch it passed with HTTP 200. The dedicated D1 suite passed all three tests: concurrent delete cooldown, delayed reopen/delete ordering, and this ambiguous-send retry. `npm test` passed 37 tests across 9 files, `npm run build` passed TypeScript checking and Vite bundling, and `git diff --check` passed.

This harness uses a minimal synthetic schema and a frozen Node clock, not a full migration replay or deployed workerd runtime. The provider call is mocked; no real email was sent and actual provider acceptance after a connection loss cannot be established locally.

See the [round plan](APORIA-ROUND-PLAN.md) and [D1 harness](../../scripts/red-team/round19-20-lifecycle-races-d1.mjs).
