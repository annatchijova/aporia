# Red-team Round 19 — concurrent room deletion and recovery email reservation

**State:** Two defects were reproduced against the actual Worker handlers and isolated local Wrangler D1, fixed, and rechecked.
**Date:** 2026-10-16.
**Threat model:** The room owner submits two delete requests at nearly the same time, such as a double click or retried request. Both requests carry the same valid creator session.
**Scope:** Delete request binding, recovery-token reservation, email count, room transition, and token expiry. Synthetic account/room data and a mocked email provider only; no live email, production D1, or deployed Worker.

## Prediction before induction

The room update is conditional, so only one request should move `closed` to `trashed`. The 60-second recovery-email cooldown is a separate read followed by token insertion. If both requests read the empty window before either inserts, both may send a link even though one room update loses. I also predicted the losing request should not change the winning recovery deadline or leave a second email that looks successful to the owner.

## R19-01 — delete batch parameter count

**CONFIRMED BY INDUCTION (actual Worker + local Wrangler D1):** The first local delete attempt returned HTTP 400 for both requests with `D1_ERROR: Wrong number of parameter bindings for SQL query.` Inspection of the deletion `UPDATE rooms` found 10 SQL placeholders and 12 bound values. The extra room IDs shifted the recovery snapshot and owner parameters as well as causing the D1 error, so a successful delete had not been exercised through this route on the local D1 path.

**Fix:** Removed the two surplus room-ID bindings. The existing fields now map to the SQL placeholders in order, including the JSON recovery snapshot, optional attendance count, room ID, and creator account ID.

## R19-02 — check-then-insert cooldown race

After correcting the binding count, a narrow local D1 wrapper held both delete requests at the recovery-token cooldown read until each had returned zero. Both then continued against the actual imported Worker and D1 binding.

**CONFIRMED BY INDUCTION (pre-fix):** Both requests sent a recovery email and inserted a recovery token. The responses were HTTP 200 and HTTP 409; the room ended `trashed`, with two recovery tokens. The 409 response therefore did not mean that no recovery email had been sent. The two concurrent requests bypassed the intended one-email-per-60-second cooldown.

**Fix:** Moved the cooldown into the recovery-token insertion itself using one conditional `INSERT ... SELECT ... WHERE NOT EXISTS`. D1 decides the reservation in the same atomic statement that inserts the token. The request that cannot reserve a token returns 429 before calling the email provider. The later room transition still controls which request can move the room.

**CONFIRMED BY INDUCTION (fixed):** The integration regression pauses both requests immediately before their conditional token insert, then releases both against local Wrangler D1. Results: one HTTP 200 and one HTTP 429; one mocked email call; one recovery token; room status `trashed`; token expiry equal to `recovery_until`.

## Variant sweep

- The only other `sendCreatorLink` call is creator login. It still uses an ordinary insert; it does not share the recovery-token cooldown, and its endpoint is covered by the separate creator-access burst limiter. This round did not establish an account-wide email quota requirement.
- A sequential delete retry after the first request trashes the room is rejected by the existing room-status check before token reservation. The forced race covers the case where both requests read the closed room first.
- Recovery-token consumption is a different race: the single-token replay/session-insertion variant was independently exercised in Round 13.

## Negative control and verification

The regression was run after temporarily replacing the conditional reservation with an unconditional insert. It failed as expected: the concurrent responses became HTTP 200 and HTTP 409 instead of HTTP 200 and HTTP 429. That mutation was reverted before the passing run.

`npx vitest run --config vitest.d1.config.mjs` passed against the actual exported Worker handler and a Wrangler `getPlatformProxy` D1 binding. The test uses a minimal synthetic lifecycle schema and a mocked `fetch` for the email provider; it does not replay every migration or run inside deployed workerd. The D1 integration is intentionally separate from `npm test`, whose Vitest worker pool cannot open Wrangler's local loopback binding in this sandbox. `npm test` passed 37 tests across 9 files; `npm run build` and `git diff --check` passed. The same D1 harness now includes a separate lifecycle-ordering probe in [Round 20](ROUND-20-REOPEN-DURING-DELETE.md).

No provider inbox, production D1, Cloudflare scheduler, browser, or deployed worker was used. The cooldown protects an individual room's recovery-link issuance; it is not a distributed email quota for all rooms owned by one account.

See the [round plan](APORIA-ROUND-PLAN.md).
