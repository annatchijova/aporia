# Round 25 — pending contribution recovery and privacy

**Status:** Finding fixed and locally rechecked.
**Threat model:** A participant has a valid session for one room; another room participant may also hold a valid session. The browser can reload or lose in-memory state.
**Scope:** Gemini-backed text/image contribution persistence, contributor attribution, pending claim approval, and room snapshot isolation. Gemini itself was mocked.

## Prediction

The Worker stores a pending proposal and its extracted source text, but the client only holds one proposal in React state. If no authenticated read route exists, a reload loses the ability to inspect or approve it while its source remains in D1. A second submission may overwrite the first in-memory proposal.

## Reproduction and evidence

The regression in `scripts/red-team/round19-20-lifecycle-races-d1.mjs` invokes the actual Worker against local Wrangler D1. It creates a room, submits a synthetic Gemini result, verifies that the private source text is persisted in a pending proposal, and then requests the proposal list. Before the fix, this request returned 404. The public room snapshot remained unchanged, confirming that the claim was not approved implicitly.

## Finding and fix

**Confirmed:** Pending contributions could become inaccessible to their submitter after a reload, while extracted source text remained stored. Multiple proposals were also allowed by the API but the client represented only one.

Added `GET /api/rooms/:id/proposals`. It requires an active room and a valid participant session, and returns only pending proposals whose stored artifact identifies that participant. The client reloads that list on room entry, keeps multiple proposals, appends new text/image results, and removes each only after all its claims are reviewed. Existing approval ownership and revision checks remain in force. No schema or architecture change was needed.

## Regression results

- Submitter GET returns its own pending proposal after reload.
- A second participant receives an empty list.
- Anonymous GET returns 401.
- The room snapshot still has no fact until claim confirmation.
- The existing integrated lifecycle and concurrency tests continue to pass.

## Verification and limits

`npx vitest run --config vitest.d1.config.mjs --reporter verbose` passes seven local D1 tests; `npm run typecheck` and `npm run build` pass. Synthetic Gemini output and a minimal local D1 schema were used. No real Gemini call, production data, browser reload, or deployed Worker was involved. Provider-side retention and the time for which pending source text should be retained remain product/privacy policy questions.

**Later disposition (Round 39, 2026-10-23):** the pending source text remains available to its uploader while awaiting review, then is cleared atomically with its confirmation/duplicate decision. New raw text/image submissions are not retained in proposal artifacts after provider processing. This does not change the original Round 25 evidence or verify provider/platform copies; see [Round 39](ROUND-39-SOURCE-RETENTION.md).
