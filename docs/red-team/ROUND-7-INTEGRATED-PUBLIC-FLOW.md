# Red team Round 7 — integrated public room flow

**State:** partial; one local end-to-end public-room path was exercised. Creator lifecycle, recovery, browser behavior, and provider-backed behavior remain open.
**Date:** 2026-10-13.
**Baseline revision:** `58c9c5e` (`docs: draft Devpost submission`).
**Threat model:** an unauthenticated visitor can create a room, learn its meeting number, join as a participant, and call the public read APIs. Participants can send arbitrary authenticated chat requests. The caller cannot read Worker secrets or modify code.
**Scope:** local Worker+D1 creation, meeting-number lookup, joining, two participant chat posts, and anonymous chat read. No production or staging D1, email, Gemini, Cloudflare edge, or real browser was used.

## Prediction before induction

A room created through the public API should be discoverable by its returned eight-digit meeting number. A second person should join through the room ID returned by that lookup, post with their own session, and both participants' messages should appear in the anonymous room chat with the correct display names.

## R7-01 — integrated public room and chat path

**CONFIRMED BY INDUCTION (local):** on revision `58c9c5e`, Wrangler local D1 returned HTTP 200 for room creation, HTTP 200 for meeting-number lookup with the same room ID, HTTP 200 for the second participant join, HTTP 201 for each of two participant posts, and HTTP 200 for anonymous chat read. The read returned exactly two messages, attributed to `R7 creator` and `R7 attendee` in post order.

The probe used only synthetic names and chat text. It made no Gemini or email request. The generated meeting number, participant/session tokens, room, and child rows were removed from local D1 afterward; Wrangler was stopped. Cleanup ran nine SQL statements successfully.

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
| Closed room chat read and write | Not exercised in this integrated pass; prior endpoint/lifecycle probes cover selected state transitions, but the full creator-authenticated close path remains open |
| Deleted/recovered room access and scheduled purge | Not exercised in this round; see Rounds 1, 2, and 5 for narrower local probes |

## Limits and next work

This induction establishes the public creation, code lookup, join, and shared-chat path only in local Wrangler+D1. It does not establish real browser navigation, multi-device polling, creator email authentication, close/delete/recovery as one continuous user journey, staging configuration, or production Cloudflare behavior. Gemini was not called, and the presence of a local secret was not used as authorization to call it.

No code change was required by this result. Round 7 remains partial. Next integrated work should exercise creator authentication and the close → read-only → delete → recovery state transitions using synthetic local auth rows, then cover frontend polling and origin configuration without calling providers.
