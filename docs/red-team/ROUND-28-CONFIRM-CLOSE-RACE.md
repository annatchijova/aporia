# Round 28 — claim confirmation racing room close

**Status:** Both controlled orderings exercised; no defect confirmed.
**Threat model:** A room participant submits and reviews an AI-extracted claim while the owning creator closes the room in another request.
**Scope:** `confirmClaim`'s room revision/status predicates, claim-decision insert, event write, room snapshot update, and owner close transition. Gemini output and creator login are synthetic.

## Controlled race: close wins

The test pauses the actual Worker after claim review has passed its prechecks and immediately before its D1 batch. The owner closes the room, then the confirmation batch resumes. Confirmation returns 409; D1 remains `closed`, contains no new fact or claim decision, and leaves the proposal pending. No partial event or fact is committed.

## Reverse ordering: confirmation wins

A second actual Worker/D1 flow commits the claim first, then closes the room. Both operations return 200; the final room is closed and contains exactly the confirmed fact, and the proposal status is `confirmed`. Close preserves the winning update instead of restoring an older snapshot.

## Disposition

No application change was warranted. The two outcomes match the invariant: a confirmation either commits before close and is preserved, or close wins and the late confirmation has no side effects. The creator's explicit close is the state boundary; stale/unreviewed contributions remain pending and become inaccessible until the room is reopened, which clears event data under the existing lifecycle policy.

## Verification and limits

The R28 tests use actual Worker handlers, local Wrangler D1, a forced pre-batch gate for the close-wins ordering, synthetic proposal text, and a seeded creator session. The full dedicated D1 harness passes 11 tests; the general suite passes 37 tests; typecheck, build, and diff check pass. The harness uses a minimal lifecycle schema, not full migration replay or deployed workerd. No production service, real Gemini, email, or browser was used.
