# Round 29 — concurrent room writes and AI review

**Status:** Finding fixed and checked across shared-write, claim-confirmation, and AI-candidate-acceptance paths.
**Threat model:** Two authenticated participants submit revision-based writes from the same room revision; one request reaches its D1 batch after the other has already committed.
**Scope:** `commitEvent`, `confirmClaim`, `acceptCandidateProposal`, event revision uniqueness, and D1 batch atomicity. Gemini output was mocked.

## Reproduction

The test pauses one request after its reads and before its D1 batch. A second participant write commits a new room revision, then the first request resumes with its stale snapshot. The regression covers a manual candidate write racing another manual write, claim confirmation racing a manual candidate write, and Gemini candidate acceptance racing a manual candidate write.

An initial run against the synthetic test schema showed duplicate-revision events and a proposal marked accepted despite a 409. That was not valid production evidence: the fixture lacked the production schema's unique `(room_id, revision)` constraint. The harness now installs that index, including in its already-persisted local database. Against the corrected fixture and the pre-fix Worker, the acceptance race instead returned 400 when the unique constraint rejected the stale event insert. D1 rolled back the batch, but the API surfaced an internal constraint failure as a client error instead of the expected conflict.

## Fix

Each D1 batch now makes dependent writes conditional on `changes() = 1` from the immediately preceding successful write. A lost room-revision update therefore prevents its event, claim decision, and proposal-status update from being inserted. Shared `commitEvent` raises a typed conflict so the Worker returns HTTP 409. AI candidate acceptance has equivalent event/status gates; the zero-candidate path now checks its guarded update result too.

## Post-fix results

- A stale shared room mutation returns 409; only the winning option is in the snapshot and exactly one event exists for the new revision.
- A stale claim confirmation returns 409; it creates no fact, claim decision, or duplicate event, and the proposal stays pending.
- A stale AI candidate acceptance returns 409; it adds no generated candidate and does not mark the proposal accepted.
- The close-versus-confirm orderings from R28 continue to pass.

## Verification and limits

Fourteen actual-Worker/local-Wrangler-D1 integration cases pass, including the forced races; the general suite passes 37 tests. Typecheck, build, and `git diff --check` pass. The race harness uses a minimal synthetic schema plus the production revision uniqueness constraint, not full migration replay. Gemini was mocked; deployed Cloudflare D1/workerd behavior and browser retry UX remain unverified.
