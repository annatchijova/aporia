# ADR-0009 — Reserve candidate-discovery idempotency keys before provider work
Date: 2026-10-16   Status: accepted   Reversibility: two-way (Worker flow; no schema migration)

## Context

Candidate discovery persisted results under a unique `(room_id, idempotency_key)` constraint, but it called Gemini before inserting the row. Two concurrent retries could both observe no row, both call Gemini, then race to store one row. Round 33 induced two provider calls and one D1 row with the production uniqueness rule modeled.

## Decision

Atomically reserve the idempotency key in `candidate_proposals` with status `processing` before provider work. The unique constraint chooses one request as owner. A duplicate while that reservation is live receives HTTP 409 and `Retry-After: 2`; a completed key replays its saved proposal. The owner transitions its reservation to `pending` only if its ID still owns the row and the room is still active at the captured revision.

On provider or persistence failure, delete the reservation on a best-effort basis so the same key can retry. A `processing` reservation older than 120 seconds can be reclaimed by a new request; the request ID acts as a fencing token so the older invocation cannot overwrite the reclaimed row. The provider's current request timeout is 12 seconds per attempt with at most one retry and a one-second delay, so the lease exceeds the normal provider retry window.

No migration was needed: `candidate_proposals.status` is text and the existing migration already supplies the unique idempotency constraint. Existing reads show only `pending` rows; `processing` reservations are not exposed as suggestions.

## Consequences and limits

Concurrent same-key requests no longer duplicate provider work. A duplicate in progress gets a visible conflict and may retry the same key. If reservation cleanup fails, a new attempt can reclaim it after 120 seconds. The lease is an operational recovery mechanism, not a guarantee against a second provider call if an invocation outlives the lease; the fencing token prevents stale persistence but cannot cancel an already-running external request.

## Anchored at

`src/worker.ts` (`discoverCandidates`) and migration `0002_candidate_proposals.sql`. Round 33 includes concurrent same-key, provider-failure retry, and stale-reservation recovery tests against local Wrangler D1.
