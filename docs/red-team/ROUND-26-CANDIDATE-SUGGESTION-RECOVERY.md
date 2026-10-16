# Round 26 — candidate suggestion recovery and review

**Status:** Finding fixed and locally rechecked.
**Threat model:** Any participant with a valid session may review suggestions intended for the shared room; anonymous users must not retrieve them. Room state can change while a suggestion is pending.
**Scope:** Gemini candidate discovery, D1 persistence, authenticated reload, cross-participant review, and revision-bound acceptance. Gemini was mocked.

## Prediction and reproduction

Candidate discovery persists generated drafts in `candidate_proposals`, but the client held one suggestion in memory. A reload was expected to lose the suggestion while leaving a pending database row. The R26 regression invokes the actual Worker against local Wrangler D1: create a room, join a second participant, generate one synthetic suggestion, query the authenticated list, and accept it from the other participant.

Before the fix, the GET returned 404 while D1 retained the pending draft. A first acceptance experiment then returned 409 because joining the second person after generation changed the room revision. That is correct stale-state protection, not a defect; the fixture was corrected to join both participants before generating the proposal.

## Finding and fix

**Confirmed:** A successful AI discovery could not be restored after reload, leaving a paid/provider-backed result pending but inaccessible and encouraging a duplicate AI request.

Added an authenticated GET for pending suggestions at the current room revision. Candidate suggestions are shared with all authenticated room participants; anonymous requests receive 401. The client restores a list, appends new results, refreshes it when room revision changes, and removes accepted proposals. Existing revision checks remain authoritative, and suggestions based on an older revision are omitted from the list.

## Regression results

- Both participants can read the current pending suggestion after reload.
- Anonymous access is denied.
- A different participant can accept at the suggestion's current base revision.
- After acceptance increments the room revision, the old pending list is empty.
- R25's contributor-private proposal behavior still passes.

## Verification and limits

Eight dedicated local D1 integration tests, the 37-test general suite, typecheck, build, and `git diff --check` pass. The harness uses a minimal synthetic D1 schema and mocked Gemini. No browser reload, real Gemini call, production D1, or deployed Worker was used. Abandoned stale rows remain stored until the room lifecycle cleanup; this round only prevents them from being presented as currently actionable.
