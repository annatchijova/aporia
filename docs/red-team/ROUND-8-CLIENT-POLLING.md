# Red team Round 8 — client polling under slow responses

**State:** overlapping refreshes were identified by code review and removed; the scheduler's concurrency and cleanup behavior passed focused local tests. Delayed HTTP behavior in a real browser remains unverified.
**Date:** 2026-10-13.
**Baseline revision:** `eb41c14` (`docs: extend integrated room lifecycle red-team round`).
**Threat model:** a participant has APORIA open while the shared API responds slowly or intermittently. The participant does not control the Worker or other users' credentials.
**Scope:** React refresh loops for observer room status, participant room snapshots, and chat. No browser, staging, production, or external provider was used.

## R8-01 — periodic refresh could overlap a still-pending request

**CODE FACT (before fix):** all three refresh loops used `setInterval`, at 5 seconds for room status/snapshot and 2 seconds for chat. The shared fetch helper times out after 15 seconds. A slow API could therefore leave multiple requests from one mounted view in flight at once; the chat path could start as many as eight refreshes before that timeout. The room snapshot callback also relied on an active-effect guard to avoid applying a response after its room/revision effect had been replaced.

**PLAUSIBLE HYPOTHESIS (before fix):** under sustained latency, overlapping requests add avoidable Worker/D1 load, and responses can arrive out of order. No delayed HTTP/browser induction was run, so this is not reported as a confirmed production impact.

## Fix and local verification

- Replaced the three fixed intervals with `pollAfterCompletion`: it begins immediately, schedules the next poll only after the current refresh settles, and clears the timer on cleanup.
- The callback receives an active-state check. Room/status/chat effects apply results only while that effect is still current, preserving the prior stale-response guard.
- Added focused tests that hold one refresh pending while advancing time, unmount during a pending refresh, and verify that neither case starts another poll or treats the stale response as active.
- `npm test -- src/client/polling.test.ts`: 3 tests passed. `npm run typecheck` and `git diff --check` passed. `rg` confirmed no `setInterval` remains in the client refresh paths.

No API behavior or product limit changed. This verifies the scheduler in isolation, not the complete React/HTTP behavior in a browser or a deployed environment. Round 8 remains partial until a delayed-response browser probe is available.
