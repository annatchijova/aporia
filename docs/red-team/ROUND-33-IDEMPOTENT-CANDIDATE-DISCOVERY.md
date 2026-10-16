# Round 33 — duplicate candidate-discovery retries

**Date:** 2026-10-16  
**Threat model:** a room participant retries the same candidate-discovery operation concurrently with the same idempotency key.  
**Scope:** actual Worker handlers and local Wrangler D1; Gemini is mocked. No provider request or charge was made.

## Prediction

The unique database key should preserve one stored suggestion, but because the route called Gemini before attempting the insert, two requests that both pass the initial lookup could perform duplicate provider work.

## Evidence

- **CODE FACT:** candidate discovery checked for an existing idempotency row, called Gemini, and only then used `INSERT OR IGNORE` to persist the result.
- **CONFIRMED BY INDUCTION (pre-fix):** two concurrent requests with the same session and idempotency key both returned HTTP 200 and invoked the mocked provider twice. With the production `(room_id, idempotency_key)` unique constraint modeled, D1 retained only one row. The user-visible state was deduplicated; provider work was not.
- The first harness run lacked that production unique constraint and stored two rows, so that run was discarded as fixture-invalid. After adding the migration's unique key, the authoritative pre-fix induction showed two provider calls and one row.
- **CONFIRMED BY INDUCTION (post-fix):** one concurrent request reserves the key and invokes the provider; its duplicate receives 409 with `Retry-After: 2`. After completion, the same key replays the stored result without another provider call.
- Additional tests show a provider failure frees the same key for retry, and a `processing` row older than 120 seconds can be reclaimed after an interrupted Worker. The new request ID fences a late completion from overwriting the recovered reservation.

## Fix

Reserve the existing unique key in D1 as `processing` before Gemini. Only the reservation owner calls the provider. Completion updates that exact reservation to `pending` if the room remains active at the captured revision. Best-effort cleanup releases failures; a 120-second stale lease allows recovery without a migration. The existing candidate list only returns `pending` rows, so incomplete reservations are not exposed as finished suggestions.

## Variant analysis

- Candidate discovery is the only current path that uses an idempotency key for an AI provider operation; contribution extraction does not claim an idempotent API contract.
- Checked concurrent same-key ownership, completed-key replay, provider exception/retry, stale lease reclamation, room revision/status guard, and pending-list visibility.
- D1 uniqueness does not prevent two external calls when the insert occurs after the call; the reservation moves that uniqueness decision before the expensive work.
- A request that somehow runs longer than the 120-second lease could overlap a reclaimed request. The newer reservation ID prevents stale persistence but cannot cancel an external Gemini call. Current provider timeout and retry path normally finish within about 25 seconds.

## Verification

`npx vitest run --config vitest.d1.config.mjs --reporter verbose`: 21 tests passed, including the three new reservation/race cases. `npm test`: 38 tests across 9 files passed. `npm run typecheck`, `npm run build`, and `git diff --check` passed. Wrangler production and staging dry-runs both exited successfully and listed the rate-limit bindings; neither deployed. Local D1 used the actual Worker handlers and modeled production unique constraints; Gemini and Cloudflare rate-limit bindings were stubs.

## Disposition

The confirmed duplicate provider work for same-key retries is closed for concurrent requests within the lease. See [ADR-0009](../decisions/ADR-0009-candidate-discovery-idempotency-reservation.md). This does not change contribution-extraction behavior, which has no idempotency key.
