# Red team Round 5 — recovered-room read authorization

**State:** finding reproduced, patched, and locally rechecked. The browser and live email flows remain unverified.
**Date:** 2026-10-12.
**Threat model:** an old attendee or anyone who still has the room UUID can call public APIs without a participant or creator session, or can use a different creator account's valid token. The caller cannot read secrets or change Worker code.
**Scope:** room snapshot GET across recovered and active states; creator session ownership; client reauthentication path. No production D1, email provider, Gemini, or deployed Worker was used.

## R5-01 — recovered summary was readable through the old room UUID

**Invariant:** only the creator may restore a deleted room; data retained for that recovery must not become public merely because another attendee still has the old room link.

**Before-fix status: CONFIRMED BY INDUCTION.** The room GET route excluded only `trashed` rows and returned the full snapshot for every other state. A synthetic D1 row in `recovered_read_only` was requested by UUID without any credential. The Worker returned HTTP 200, including the recovered summary and the `nextMeetingCode` value. No live recovery email was used; the state was explicitly seeded in local D1 to isolate the read authorization decision.

The room ID is present in an attendee's old invite URL. The summary deliberately excludes participant names and chat, but its next-room code can grant entry to a different active room. The creator's one-time recovery action did not protect subsequent reads.

## Fix and variant verification

The Worker now checks the owner-bound creator session on `GET /api/rooms/:id` only when the room status is `recovered_read_only`. Missing, invalid, or unrelated creator credentials receive HTTP 401 with `creator access required`; a valid session for the room's creator receives the snapshot. Active and closed rooms stay publicly readable for observer access. The client sends the creator token on initial and periodic room reads and shows a creator email-link request screen when the recovered-room read requires reauthentication.

| Actor and resource | Before fix | After fix |
| --- | --- | --- |
| Anonymous → recovered-room UUID GET | 200, full recovery summary | 401, no summary |
| Arbitrary invalid token → recovered-room UUID GET | 200 | 401, no summary |
| Valid session of a different creator → recovered-room UUID GET | Not separately tested before fix | 401, no summary |
| Valid creator session → recovered-room UUID GET | Not separately tested before fix | 200, summary returned |
| Anonymous → active-room UUID GET | 200, observer snapshot | 200, observer snapshot |

**Sibling paths:** meeting-code lookup requires an eight-digit code and selects by `meeting_code`; deletion clears the recovered room's code. Room-message rows are removed when a room is moved to trash, so the recovery route does not restore chat. These are code-path findings; the meeting-code and empty-message variants were not separately induced in this round. Other authenticated contribution and lifecycle routes retain their existing session/creator checks and reject writes to read-only rooms.

The client can request another creator login link through the existing `/creator-access` route. Its response is generic for matching and non-matching emails. The endpoint's email delivery was not invoked, and the new browser reauthentication screen was typechecked but not browser-tested.

The synthetic recovered room, active observer control room, owner and unrelated creator accounts, and both creator sessions were deleted from local D1; a final query confirmed zero fixture rooms and accounts. Wrangler was stopped. No external service was called.

## Status and remaining work

R5-01 is fixed for the exercised local Worker route and its principal authorization variants. This is not deployed verification. Recovery-link consumption, creator reauthentication by email, expiration behavior, browser rendering, and any custom frontend/backend origin combination still need local/browser or deployment checks in later integrated rounds.
