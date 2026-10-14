# Red team Round 10 — recovery journey

**State:** Worker-route journey exercised with a synthetic D1 adapter and a mocked email provider. This does not verify SQLite/D1 transaction semantics or provider delivery.
**Date:** 2026-10-14.
**Code revision:** `2c89f42` (`feat: explain the room planning flow`), before adding this round's test harness.
**Threat model:** A legitimate room creator requests deletion and later follows the one-time recovery link. A former attendee or unauthenticated visitor may still know the room URL and try to read it. The caller cannot alter Worker code or access secrets.
**Scope:** Worker `delete` and creator-link consume routes, state transition, recovery snapshot filtering, anonymous/creator read authorization, replay behavior. D1 calls were represented by an in-memory synthetic adapter; email `fetch` was replaced with a mock that returned HTTP 200 and captured the generated link. No real D1, email, Gemini, staging, production, or browser was used.

## Prediction before induction

A closed room's owner should be able to move it to trash after a recovery link is accepted by the email provider. The room's public URL should stop resolving while trashed. Consuming that link once should restore a read-only room with the approved recovery summary and candidate details, while removing participants, facts, chat, the original event title, and candidate location. Anonymous reads of the recovered room should fail; the creator session should work; replay should fail.

## R10-01 — close-state deletion and one-time recovery

**CONFIRMED BY INDUCTION (Worker handlers with synthetic storage):** the actual Worker handlers returned HTTP 200 for delete and link consumption. The state moved `closed → trashed → recovered_read_only`. The delete batch issued child-row deletions for messages, claim decisions, proposals, candidate proposals, candidates, events, participant sessions, participants, and login tokens. While trashed, the old room GET returned 404.

The mock email provider captured one recovery link. Recovery produced a new snapshot with no participants, facts, constraints, or preferences; it retained one candidate with its area removed and a summary with two registered people. The original event title, synthetic attendee names, private note, and precise location were absent. Anonymous GET of the recovered room returned 401; GET with the returned creator session returned 200. Replaying the same recovery token returned 400. The mock provider was called once.

## Variant analysis

Invariant: **recovery restores only the limited data approved for recovery, and a former public room URL does not bypass creator authorization after recovery.**

| Variant | Result |
| --- | --- |
| Delete a closed room with provider acceptance | Worker returned `trashed`; synthetic adapter observed the expected delete statements |
| Public GET while room is trashed | HTTP 404 |
| Consume emailed recovery token | HTTP 200; state became `recovered_read_only` |
| Verify personal and location data in recovered snapshot | Original title, names, fact text, and candidate area absent |
| Read recovered room without creator session | HTTP 401 |
| Read recovered room with returned creator session | HTTP 200 |
| Replay the recovery token | HTTP 400; no second provider request |
| Explicit provider rejection | Not repeated here; existing `creator-link.test.ts` covers token cleanup on non-2xx response |
| Expired recovery period/token, simultaneous token replay, and transaction rollback | Not exercised |

## Limits and next work

The test is a Worker-handler integration with a synthetic D1 adapter, not a local SQLite/D1 induction. Its adapter records the statements but cannot prove that Cloudflare D1's batch transaction, foreign keys, or concurrent conditional updates behave as assumed. Email link delivery, expiry boundaries, simultaneous replay, purge ordering, and browser hash-link handling remain open. No production code change was justified by this round.

Reproduction: `npm test -- src/worker-room-recovery.test.ts`. See [the test harness](../../src/worker-room-recovery.test.ts) and [Round 7](ROUND-7-INTEGRATED-PUBLIC-FLOW.md) for the earlier local Wrangler+D1 flow, where deletion correctly failed closed because email was unavailable.
