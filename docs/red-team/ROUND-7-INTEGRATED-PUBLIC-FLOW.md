# Red team Round 7 — integrated public room flow

**State:** partial; local public-room, creator-login, and close/read-only paths were exercised. Successful delete/recovery, browser behavior, and provider-backed behavior remain open.
**Date:** 2026-10-13.
**Baseline revisions:** public-room path at `58c9c5e` (`docs: draft Devpost submission`); creator lifecycle path at `f170a8c` (documentation-only advance).
**Threat model:** an unauthenticated visitor can create a room, learn its meeting number, join as a participant, and call the public read APIs. Participants can send arbitrary authenticated chat requests. The caller cannot read Worker secrets or modify code.
**Scope:** local Worker+D1 creation, meeting-number lookup, joining, two participant chat posts, anonymous chat read, synthetic creator-link consumption, close, read-only enforcement, and delete failure handling. No production or staging D1, real email, Gemini, Cloudflare edge, or real browser was used.

## Prediction before induction

A room created through the public API should be discoverable by its returned eight-digit meeting number. A second person should join through the room ID returned by that lookup, post with their own session, and both participants' messages should appear in the anonymous room chat with the correct display names.

## R7-01 — integrated public room and chat path

**CONFIRMED BY INDUCTION (local):** on revision `58c9c5e`, Wrangler local D1 returned HTTP 200 for room creation, HTTP 200 for meeting-number lookup with the same room ID, HTTP 200 for the second participant join, HTTP 201 for each of two participant posts, and HTTP 200 for anonymous chat read. The read returned exactly two messages, attributed to `R7 creator` and `R7 attendee` in post order.

The probe used only synthetic names and chat text. It made no Gemini or email request. The generated meeting number, participant/session tokens, room, and child rows were removed from local D1 afterward; Wrangler was stopped. Cleanup ran nine SQL statements successfully.

## R7-02 — creator close and deletion failure boundary

**CONFIRMED BY INDUCTION (local):** a synthetic creator account and hashed, one-time login token were seeded in local D1; the app consumed the token, issued a creator session, and closed the room with HTTP 200. The public room read remained available with status `closed`. A new chat post using the participant session and a fresh idempotency key returned HTTP 409 `this room is read-only`; the stored message count stayed at one.

An exact retry of the message accepted before closure returned HTTP 200 with the original result and did not add another row. This is idempotent replay, not a new post after close. The first setup attempt had a malformed synthetic expiry timestamp and did not authenticate; a pre-close message from that attempt made the later exact-key retry useful as an idempotency variant. The corrected ISO timestamp allowed the intended lifecycle probe. The setup error is not reported as an application defect.

The owner then requested deletion. With email delivery unconfigured in local Wrangler, the endpoint returned HTTP 503 `could not send recovery email; room was not deleted`. The room remained `closed`, and the prior message remained available. This confirms the local fail-closed deletion boundary under missing email configuration; it does not verify successful recovery-email delivery or the transition into trash.

The synthetic room, participant, creator account, auth token, creator session, message, and child rows were deleted afterward. A local D1 query returned zero for both the room and account fixture counts, and Wrangler was stopped. No external request was made.

## Variant analysis

Invariant: **a room's public invitation path must lead all attendees to the same room, while chat reads must preserve each writer's attribution and must not require a participant token.**

| Variant | Result in this round |
| --- | --- |
| Create → lookup by returned meeting number | Confirmed; same room ID returned |
| Join looked-up room as a second participant | Confirmed; HTTP 200 and participant session returned |
| Post from creator session | Confirmed; HTTP 201 |
| Post from attendee session | Confirmed; HTTP 201 |
| Read messages without a session | Confirmed; HTTP 200 and both names/messages present |
| Reuse or guess another room's meeting number | Not exercised here; lookup bounds and rate limits are covered separately in Round 3 |
| Closed room chat read | Confirmed; room and message reads remained HTTP 200 |
| New chat write after close | Confirmed rejected with HTTP 409; message count unchanged |
| Exact retry of pre-close message after close | Returned HTTP 200 replay; no new row was added |
| Delete with email delivery unconfigured | Confirmed fail-closed; HTTP 503 and room/message data remained |
| Successful delete, recovery, and scheduled purge in one journey | Not exercised here; see Rounds 1, 2, and 5 for narrower local probes |

## Limits and next work

This induction establishes public creation, code lookup, join, shared-chat, synthetic creator-link consumption, and close/read-only behavior in local Wrangler+D1. It does not establish real browser navigation, multi-device polling, real creator email authentication, successful delete/recovery as one continuous user journey, staging configuration, or production Cloudflare behavior. Gemini was not called, and the presence of a local secret was not used as authorization to call it.

No code change was required by these results. Round 7 remains partial. Next integrated work should exercise successful close → delete → recovery with a local-only email substitute or synthetic recovery token, then cover frontend polling and origin configuration without calling providers.
