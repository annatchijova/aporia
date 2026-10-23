# Round 44 — Duplicate claim identifiers across extraction and review

**Status:** Confirmed in the mocked Worker handler and fixed at provider parsing and confirmation boundaries. The D1 binding was mocked; no browser, live Gemini, production Worker, or production data was used.

## Threat model

- **Attacker/input capability:** the external extraction provider returns two distinct claims with the same string identifier. The same invalid shape could also exist in a previously stored proposal.
- **Cannot:** modify Worker code, write the database directly, or control the authenticated review request beyond selecting a claim ID and participant.
- **Trust boundary:** external structured AI output → pending proposal → contributor review → canonical fact/event.

## Finding R44-01 — A duplicate ID made the visible claim and confirmed fact disagree

**Severity:** P2 integrity/correctness. **Bucket:** software defect; no direct account or room authorization bypass was demonstrated.

### Abduction and deduction

The provider parser checked that each claim ID was a string but did not require uniqueness. The browser used each ID as the React key and sent it to the confirmation endpoint. The Worker used `claims.find(item => item.id === input.claimId)`, while decision rows and source-snippet cleanup also use `(proposal_id, claim_id)` as an identity.

**Prediction before the test:** if two claims with different kinds/values share an ID, clicking either rendered row cannot identify which one the user selected; a confirmation request for that ID will resolve to the first array entry. The duplicate key also prevents distinct durable review decisions and can leave the proposal pending.

### Induction

At base `0cbba19`, a synthetic pending proposal was seeded in the mocked Worker+D1 test fixture with two claims sharing `duplicate-id`: first a `proposal` fact (`First claim`), then a `dietary_note` (`Second claim`). Posting the standard confirmation body with that ID returned HTTP 200 and the response snapshot contained the first claim. This reproduced the ambiguous-ID resolution in the Worker handler. It does not prove behavior of a real D1 deployment or browser rendering.

Separate regression expectations were then run before the fix: the schema test accepted duplicate IDs and the Worker test returned 200 instead of the predicted 409. Both failed as expected.

### Fix and variant coverage

- The extraction parser rejects any response with duplicate claim IDs as non-retryable `invalid_output`, before `createProposal` persists it.
- The confirmation handler checks all stored claim IDs for uniqueness and returns HTTP 409 before any D1 batch if a malformed/legacy row reaches review.
- Regression tests cover both boundaries: duplicate provider output is rejected; a seeded ambiguous pending row is blocked with no writes.
- The same parser is used for text and screenshot extraction. Candidate discovery has a different data model and does not use claim IDs.

**CONFIRMED BY INDUCTION:** the pre-fix mismatch and post-fix rejection are exercised in local tests against synthetic provider output and a mocked D1 binding. The change does not claim browser-level verification.

After the fix, `npx vitest run src/intelligence/schema.test.ts src/worker-image-proposal.test.ts` passed 13 tests, including the new fail-closed path. The full `npm test` suite passed 56 tests across 12 files; `npx vitest run --config vitest.d1.config.mjs --reporter dot` passed 26 local D1 tests across two files; `npm run typecheck`, `npm run build`, and `git diff --check` passed. The local D1 suite does not contain the duplicate-claim scenario.

## Adjacent display vector

**CODE FACT:** chat bodies, warning strings, source snippets, candidate titles, and room fields are rendered through React child expressions. A source scan found no application use of `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, or `insertAdjacentHTML`.

**Not tested:** a live browser render with hostile HTML text. Therefore this source review is not reported as an induction or a confirmed browser XSS result.
