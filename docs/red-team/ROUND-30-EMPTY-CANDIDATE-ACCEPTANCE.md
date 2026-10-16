# Round 30 — empty candidate result during a room revision change

**Status:** Variant regression passes; no additional code change was required.
**Threat model:** An authenticated participant accepts an AI discovery that contains no candidates while another participant changes the room after acceptance prechecks.
**Scope:** The empty-result branch of candidate acceptance, which updates proposal status without creating a room event. Gemini was mocked.

## Reproduction

The test creates a pending discovery with an empty candidate list, pauses the actual Worker immediately before its guarded status update, commits a manual candidate that advances the room revision, then resumes acceptance.

## Result

Acceptance returns 409 and the proposal remains pending. It does not report a successful no-op against a stale room revision. This confirms the one-statement `meta.changes` guard added in R29 covers the no-event branch as well as the event-backed acceptance path.

## Verification and limits

Fifteen actual-Worker/local-Wrangler-D1 integration cases pass; the general suite, typecheck, build, and diff check passed after the R29 change. Synthetic Gemini and a minimal local D1 schema were used. This is regression coverage for R29, not a new production defect or independent code fix. Deployed D1 and browser behavior remain unverified.
