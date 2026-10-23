# Red-team Round 41 — room lifecycle authorization composition

**State:** no new defect confirmed in this review; the integrated local D1 suite passes. This is a cross-round authorization and lifecycle review, not a new exhaustive actor-by-route induction.
**Date:** 2026-10-23.
**Threat model:** a public attendee, an unauthenticated visitor holding an old room identifier, or a creator using a valid session for a different account can call the public Worker API. They cannot alter Worker code, database rows, or server secrets.
**Scope:** compose the actor/resource/action matrix for active, closed, reopened-read-only, trashed, and recovered-read-only rooms; inspect room reads, chat reads/writes, joins, participant writes, creator lifecycle operations, and creator-only recovery reads. No production service or real creator email was used.

## Invariants under review

- An active or closed room remains available for the product's public observer/read-only flow; joining and participant writes are active-room-only.
- Reopening a closed room removes participant identities, room sessions, chat, event history, proposals, and candidate rows before exposing a sanitized archive.
- A trashed room and its meeting number are hidden; its recovery data is restricted to the one-time creator recovery flow.
- A recovered room remains read-only and its snapshot is readable only by a session bound to its creator account.
- Creator lifecycle operations require a creator session bound to the room's owning account.

## Route and variant review

**CODE FACT:** `GET /api/rooms/:id` permits observer reads except for `trashed`, and adds the owner-session check for `recovered_read_only`. `GET /api/rooms/:id/messages` requires a non-trashed room and returns whatever message rows remain; it does not require a creator session for a recovered room. The integrated journey found no messages after reopen/recovery and confirmed zero message rows after recovery, so this public route returned no recovered chat data in the tested lifecycle. All participant writes, joins, proposal routes, candidate routes, and relaxation calculations pass through the active-room gate and participant-session check. Lifecycle routes resolve the creator session against the room's owner account. Recovery consumes a one-time token only when its room is trashed, its recovery window is open, and the token email maps to the owning creator account.

| State / actor | Room snapshot | Chat | Join / participant write | Creator lifecycle |
| --- | --- | --- | --- | --- |
| Active / observer | Public read | Public read | Join allowed; writes require room session | Creator session required |
| Closed / observer or old participant | Public read | Existing chat remains readable | Denied as read-only | Creator session required |
| Reopened read-only / old attendee | Sanitized archive remains readable | Empty after reopen cleanup | Denied; prior participant sessions removed | Creator session required |
| Trashed / anyone with old ID or code | Hidden | Hidden | Denied | Recovery only via valid one-time creator link |
| Recovered read-only / anonymous or unrelated creator | Denied | Empty | Denied | No further lifecycle write; snapshot read requires owner session |
| Recovered read-only / owning creator | Read allowed | Empty | Denied | Room remains read-only |

**CONFIRMED BY INDUCTION (actual Worker + isolated local Wrangler D1, Round 24 journey):** create → lookup → second participant joins → both post chat → creator login → close → reopen → delete → recover. The old room number resolved to the sanitized reopened archive but could not be used to join. Reopen removed names, chat, participant sessions, and events. Trash hid the room, chat route, and meeting number. Recovery returned a read-only snapshot; anonymous snapshot access was denied and the recovered creator session was allowed. See [Round 24](ROUND-24-INTEGRATED-PUBLIC-TO-RECOVERY.md).

**CONFIRMED BY INDUCTION (actual Worker + local D1, Round 5 variants):** anonymous, invalid-token, and unrelated-creator reads of a recovered-room UUID were denied; the owning creator read succeeded; active observer reads remained available. See [Round 5](ROUND-5-RECOVERY-READ-AUTHORIZATION.md).

**RECHECKED:** `npx vitest run --config vitest.d1.config.mjs --reporter dot` passed 26 tests across two files on 2026-10-23. These are local D1 tests and synthetic identities; they do not verify the deployed Worker, live email, frontend/browser behavior, production database, or Cloudflare account settings.

## Variant disposition

- **Old invite/code after close:** still resolves a read-only room; join and writes are gated. The preserved closed-room chat is existing product behavior, not a new finding.
- **Old invite/code after reopen:** the old code resolves only the sanitized archive; chat rows and participant sessions are removed. This is existing behavior, not a new finding.
- **Old invite/code after trash:** route checks hide the room and its meeting code has been cleared.
- **Old room UUID after recovery:** the dedicated room GET gate applies to the primary snapshot path. Contribution/proposal routes pass through the active-state and participant-session checks. The chat GET is public for non-trashed rooms, but the integrated lifecycle removed all chat rows before recovery and confirmed zero rows afterward; no recovered chat was returned.
- **Unrelated creator session:** owner binding is enforced by the creator-session lookup; recovered-room cross-account denial was exercised in Round 5.
- **New creator session after recovery:** its insertion is conditional on the same room still being owned by the matching account and in `recovered_read_only`.

No additional code change was justified by this review. Do not interpret the passing local suite as proof of deployed authorization or provider-side data deletion. The broader capacity question about room and aggregate AI budgets remains open in [Round 40](ROUND-40-AI-IDENTITY-CHURN.md).
