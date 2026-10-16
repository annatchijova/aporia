# Red-team Round 24 — integrated public room to recovery

**State:** The public collaboration and creator lifecycle completed as one actual Worker/local D1 journey. The tested state and data invariants held; no defect was confirmed in this path.
**Date:** 2026-10-16.
**Threat model:** A public participant can create or join a room, read its meeting number, and use their own participant token. The creator proves control of the room's email address through a one-time link. Other visitors may retain the invitation code or room UUID. Callers cannot alter Worker code or read secrets.
**Scope:** `create → meeting-code lookup → join → chat → creator email login → close → reopen read-only → delete → recovery-link restore`. Actual exported Worker handlers and isolated local Wrangler D1; synthetic names/messages and mocked email. Scheduled purge is exercised separately in R23; no live provider or deployed environment.

## Combined invariant model

The lifecycle has two terminal branches from trash: creator recovery during the recovery window or scheduled permanent purge after it. The public invite code grants room discovery and joining only while the room is active. Participant sessions authorize contributions; a verified creator session authorizes lifecycle operations. Reopen and delete must revoke old participant sessions and remove attendee-linked records before later reads. Recovery must produce a limited read-only snapshot, and a losing recovery request must not consume its link or create a session (R22).

```mermaid
stateDiagram-v2
    [*] --> active: create / creator is participant
    active --> closed: creator closes; data retained read-only
    closed --> reopened_read_only: creator reopens; attendee identity and chat removed
    closed --> trashed: creator deletes after recovery email succeeds
    reopened_read_only --> trashed: creator deletes after recovery email succeeds
    trashed --> recovered_read_only: owner consumes valid link within 7 days
    trashed --> purged: scheduled cleanup at or after deadline
```

## R24-01 — one public-to-recovery journey

The harness used the real room creation route, discovered its generated meeting number, joined a second participant, posted a message from each participant, requested creator email access, consumed the synthetic login link, and ran the creator lifecycle routes. It then consumed the recovery link from the mocked email.

**CONFIRMED BY INDUCTION (actual Worker + local Wrangler D1):**

- Creation and meeting-number lookup returned the same room. The second participant joined, and both participant sessions could post chat messages.
- The creator email link established an owner-bound creator session. Close and reopen both succeeded.
- Reopen returned a read-only archive with no participant names. The chat was empty, old attendee session use returned 401, and a new participant could not join (409).
- **Observed access behavior:** the old meeting number still resolves to the `reopened_read_only` archive; it cannot be used to join. The archive is still within the original shared-room access boundary and contains sanitized read-only data. This is recorded as behavior, not classified as a defect.
- Delete returned the room to trash and made the room UUID, chat route, and old meeting number return 404.
- Recovery returned a read-only room. Anonymous room GET returned 401, while the recovered creator session returned 200. Participant, session, chat, and event counts were zero after recovery.

## Data and authority trace

| Transition | Authority used | State retained or removed, observed in this journey |
| --- | --- | --- |
| Create / join / chat | Public create; then room-scoped participant sessions | Room snapshot, participant rows, event rows, session hashes, and chat rows |
| Close | Owner-bound creator session | Read-only state; data remains until reopen or delete |
| Reopen | Owner-bound creator session | Generic room snapshot and meeting code remain; attendee names, chat, participant sessions, and event history are removed |
| Delete | Owner-bound creator session plus successful recovery-email response | Room is hidden; meeting code cleared; chat, participants, room sessions, events, and login links removed; allowlisted recovery snapshot retained |
| Recover | Unexpired one-time recovery link plus matching creator account | Read-only recovered snapshot; owner-only room GET; old attendee data remains absent |

This trace covers application rows in the local D1 database only. It does not establish deletion from provider systems, platform backups, logs, or operator-held copies; see Round 9's data-flow limits. The real Resend, Gemini, browser, deployed CORS/Vercel boundary, and production D1 were not exercised.

## Cross-round composition review

- **Room lifecycle serialization:** close, reopen, delete, recovery, and purge each condition their state changes on the current state. The R20 delayed reopen/delete ordering is a valid same-owner sequence; whether a later reopen click should cancel an earlier pending deletion remains a product policy question.
- **Recovery links:** R21 aligns potentially delivered, unconsumed links to the trash deadline after retry; R22 gates token consumption and session creation on the winning room transition. R13 covers replay of the same token.
- **Purge:** R23 forced two scheduled invocations to select one expired room and removed the parent and dependent rows without leftovers. R17/R18 cover recovery-vs-purge and exact expiry ordering.
- **Public authorization:** the old code resolves the reopened sanitized archive but cannot join it; trashed and recovered access behave differently by design (trashed is hidden, recovered GET is creator-only). This distinction is enforced by separate Worker route predicates and observed in this journey.

## Verification and limits

The new journey is retained in the [local D1 integration harness](../../scripts/red-team/round19-20-lifecycle-races-d1.mjs). The dedicated Wrangler D1 config passes six tests, including the full public-to-recovery flow. `npm test` passes 37 tests across 9 files; `npm run build` passes TypeScript checking and Vite bundling; `git diff --check` passes.

The local D1 harness defines a minimal lifecycle schema rather than replaying every migration. Email is intercepted; no real email was sent. This verifies one ordered path and selected race orderings, not every possible interleaving, workerd behavior, provider acceptance, production data retention, or deployment. Rounds 1–23 retain their own scope and limitations; this report does not close their open external or product-policy questions.

See the [round plan](APORIA-ROUND-PLAN.md) and the earlier [public-flow](ROUND-7-INTEGRATED-PUBLIC-FLOW.md) and [recovery journey](ROUND-10-RECOVERY-JOURNEY.md) reports.
