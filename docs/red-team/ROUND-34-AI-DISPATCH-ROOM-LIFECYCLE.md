# Round 34 — AI dispatch composed with room close, reopen, and delete

**Date:** 2026-10-16  
**Base:** `main` at `1a412eb7a4ce54a2d47c44d7825a292760221df4` (Round 34 checkpoints absent).  
**Threat model:** a valid room participant starts an AI request while the authorized creator closes, reopens, or deletes that same room. The participant can submit normal bounded input and retry requests; cannot modify Worker code or D1 state.  
**Scope:** both Gemini invocation routes, actual Worker handlers, and local Wrangler D1; provider calls and email are mocked. No live Gemini request or charge was made.

## Prediction

The R33 reservation correctly fences persistence after Gemini returns. However, the AI rate-limit binding is awaited after the initial active-room check. If a lifecycle transition commits during that await, the route might still invoke Gemini with previously captured room data even though later persistence is rejected.

## Evidence

- **CODE FACT:** `createProposal` and `discoverCandidates` both awaited their rate-limit binding after `requireActive`. Candidate discovery had a processing reservation; extraction had not yet persisted a proposal. Both called their provider without a final lifecycle check.
- **CONFIRMED BY INDUCTION (candidate discovery, pre-fix):** the test paused the rate-limit binding after a `processing` reservation appeared, then the creator closed, reopened, and deleted the room. Releasing the binding caused one mocked `GeminiProvider.propose` call despite the room being trashed. The handler returned 409 afterward and D1 contained no candidate proposal. Reproduction: `npx vitest run --config vitest.d1.config.mjs --reporter verbose -t "does not dispatch reserved Gemini work after room close"` at the base SHA above.
- **CONFIRMED BY INDUCTION (contribution extraction, pre-fix):** the same controlled close-before-provider ordering caused one mocked `GeminiProvider.extract` call; the later insert guard returned 409 and stored no proposal. Reproduction: `npx vitest run --config vitest.d1.config.mjs --reporter verbose -t "does not start contribution extraction"` at the same base SHA.
- **CONFIRMED BY INDUCTION (provider already running):** a separate test held the provider after invocation, then closed, reopened, and deleted the room. The late result returned 409 and did not restore a candidate row or leak generated option data into the recovery snapshot.
- The fixture uses synthetic room titles, participant content, candidate names, and areas. Gemini and Resend are mocked; no external service received them.

## Fix

Added a conditional D1 dispatch checkpoint after limiter admission in both routes. The candidate route refreshes the reservation only while it still owns the processing row and the room remains active at the original revision. The extraction route executes a conditional no-op update of the active room at its captured revision. If the lifecycle transition wins first, either checkpoint affects zero rows and the handler returns 409 without invoking Gemini. If dispatch wins first, the operation is considered in flight; output persistence remains guarded by current room state. No migration or architecture change was needed.

## Variant analysis

| provider sink | pre-fix lifecycle ordering | post-fix result |
|---|---|---|
| `GeminiProvider.propose` in candidate discovery | close → reopen → delete while rate-limit call waited | 409, zero provider calls, no reservation remains |
| `GeminiProvider.extract` in contribution submission | close while rate-limit call waited | 409, zero provider calls, no proposal stored |
| either provider already dispatched before lifecycle | close/reopen/delete while provider is held | late result cannot persist after lifecycle changes |

The conditionally updated room row and candidate reservation serialize the dispatch decision against D1 lifecycle writes. A lifecycle action that starts after the checkpoint cannot cancel the already-authorized external call; this boundary is explicit in [ADR-0010](../decisions/ADR-0010-ai-dispatch-lifecycle-boundary.md).

## Verification

Post-fix targeted D1 run passed all three lifecycle cases. Final checks: `npx vitest run --config vitest.d1.config.mjs --reporter verbose` passed 24 tests; `npm test` passed 38 tests across 9 files; `npm run typecheck`, `npm run build`, and `git diff --check` passed. Runtime: Node v22.23.2, Vitest 5.0.2, Wrangler 4.140.0. Repro fixture/script: `scripts/red-team/round19-20-lifecycle-races-d1.mjs`, SHA-256 `51bf7c192c0a802e104da7543f0fbc951298ff23a95e4ad3d44493bbdc9334f0`. D1 was local Wrangler with synthetic rows and mocked providers; production D1, browser behavior, email delivery, real Gemini, and deployed Cloudflare ordering were not exercised.

## Disposition

The confirmed “lifecycle wins before provider dispatch, but Gemini is still called” gap is fixed in both current Gemini sinks. A provider call whose D1 checkpoint wins before the lifecycle action remains in flight and may still incur cost; its late result is discarded if the room is no longer active. This is not a hard cancellation guarantee.
