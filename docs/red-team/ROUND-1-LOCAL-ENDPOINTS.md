# Red team Round 1 — local endpoint probe

**State:** partial; confirmed finding fixed and variants checked; round remains open.
**Date:** 2026-10-12.
**Revision:** source state and probe results are included in the implementation commit.
**Threat model:** unauthenticated internet user or room participant can issue arbitrary requests and replay requests; cannot read Worker secrets or alter server code.
**Scope exercised:** room creation and meeting-code lookup, observer message read, participant join, participant chat authorization, five-message limit, idempotency replay, claim attribution, and content-type handling.
**Not exercised:** creator magic-link issuance/consumption, per-claim ownership checks against another uploader, duplicate review, successful Gemini-backed proposal paths, lifecycle transitions, concurrent requests, conflicting content-length/body streams, and actual browser behavior.

## Evidence

Temporary local state only. Applied migrations `0003_meeting_codes_chat.sql` and `0004_creator_accounts_lifecycle.sql` to Wrangler's **local** D1, started `npx wrangler dev --local --port 8787`, ran a one-off Node `fetch` probe against `localhost`, then stopped the Worker. The probe did not call Gemini or email. It created two disposable local rooms; their meeting numbers and tokens are not included here.

| Probe | Observed result | Label |
| --- | --- | --- |
| Create room with valid JSON | HTTP 200; response included room ID, eight-digit meeting code, participant session and revision-1 snapshot | CONFIRMED BY INDUCTION |
| Lookup returned meeting code | HTTP 200 | CONFIRMED BY INDUCTION |
| Lookup malformed short code | HTTP 400 | CONFIRMED BY INDUCTION |
| Read messages without joining | HTTP 200 | CONFIRMED BY INDUCTION |
| Join with a nickname | HTTP 200 | CONFIRMED BY INDUCTION |
| Post five distinct messages under the participant token | Five HTTP 201 responses | CONFIRMED BY INDUCTION |
| Post a sixth message | HTTP 429 with the five-message limit error | CONFIRMED BY INDUCTION |
| Replay an existing idempotency key with altered message text | HTTP 200, original stored message returned, no sixth message created | CONFIRMED BY INDUCTION |
| Post using a fabricated session token | HTTP 401 | CONFIRMED BY INDUCTION |
| Read chat after posts without a participant token | HTTP 200; exactly five messages visible | CONFIRMED BY INDUCTION |
| Invalid JSON body | HTTP 400 with a bounded parse error | CONFIRMED BY INDUCTION |
| Body larger than the 2,100,000-byte cap | HTTP 400, `request body too large` | CONFIRMED BY INDUCTION |
| JSON sent as `text/plain` with `Origin: https://attacker.example` | Before R1-03 fix, room creation returned HTTP 200 with no `Access-Control-Allow-Origin` response header | CONFIRMED BY INDUCTION (request processing); browser behavior not directly run |

The predictions were that the valid room flow would work, invalid meeting codes and fabricated session tokens would fail, observers could read, and the server would enforce the chat cap under a direct API client. The observed results matched those predictions. Reproduction was a temporary `node --input-type=module -e` script issuing the requests listed above; it was not saved as a repository test.

## Finding R1-01 — claim attribution accepted a non-member ID

**Before-fix status:** CONFIRMED BY INDUCTION.
**Impact:** a room participant could create a confirmed fact and evaluator constraint attributed to an ID that was not a member of that room. This can mislead the group about whose availability or budget is represented. It did not grant creator privileges or reveal secrets.
**Root cause:** `confirmClaim` trusted either the client-supplied `participantId` or the provider-stored claim value without checking that the ID existed in `snapshot.participants`.

The first reproduction submitted a valid uploader session, a synthetic pending availability claim, `participantId: "00000000-0000-4000-8000-000000000000"`, and the current revision. Before the fix, the endpoint returned HTTP 200 and the snapshot contained the fake ID in both `facts` and `constraints`, while `participants` did not contain it. A sibling reproduction omitted the override while the stored synthetic claim already had another unknown ID; it also returned HTTP 200 and persisted that ID. No Gemini request was made; proposal rows were synthetic local D1 fixtures.

### Variant analysis and fix verification

Search of all `participantId` inputs and writes found that only `confirmClaim` accepts a client/provider-selected identity for a fact. Chat and joins derive identity from a server-side session or generate it server-side; candidate mutations use the authenticated actor. Within `confirmClaim`, both attribution sources converge on the same membership check added after loading the current room snapshot. The UI now sends `null` when the selector is blank instead of falling back to an unmatched provider string.

| Variant | Post-fix result | Status |
| --- | --- | --- |
| Explicit override to unknown ID | HTTP 400, `participantId must belong to this room` | CONFIRMED BY INDUCTION; fix holds |
| Stored claim contains unknown ID, no override | HTTP 400, `participantId must belong to this room` | CONFIRMED BY INDUCTION; fix holds |
| Blank selector explicitly sends `null` | HTTP 400, attribution required | CONFIRMED BY INDUCTION; fix holds |
| Assign claim to a different participant who is a member of this room | HTTP 200; stored fact points to that room member | CONFIRMED BY INDUCTION; intended behavior preserved |
| Fabricated session token on chat | HTTP 401 | CONFIRMED BY INDUCTION |

The original non-member override reproduction was rerun after the fix and returned HTTP 400. `npm run typecheck` and `git diff --check` passed. Afterward, both temporary rooms created for the probes and all their synthetic child rows were removed from local D1. No production instance was queried.

Replaying the same chat idempotency key with different text returned the original write; this is expected duplicate suppression, but clients must use a new key for a genuinely new message.

## Finding R1-02 — wrong JSON value types were silently coerced

**Before-fix status:** CONFIRMED BY INDUCTION.
**Impact:** direct API callers could store malformed but plausible text/options. For example, an object title became `"[object Object]"`, an object chat message became `"[object Object]"`, and numeric strings/object fields became a candidate with stringified values. This is data integrity and usability damage, not privilege escalation.
**Root cause:** multiple endpoints called `String(...)` or `Number(...)` on untrusted parsed JSON before validating the expected type.

Before the fix, a room-creation request `{ "title": { "unexpected": "object" }, "displayName": 42 }` returned HTTP 200 and persisted `"[object Object]"` and `"42"`. A chat request with an object message returned HTTP 201 and stored `"[object Object]"`. A candidate request accepted an object title/area/currency and numeric strings, returning HTTP 200 with the coerced values.

### Variant analysis and fix verification

`rg` over every `String(input.*)` and `Number(input.*)` call found the same coercion family in room creation, join, chat, text proposals, idempotency keys, candidate fields/revisions, creator email/token parsing, attendance count, and next-room code. The fix adds shared boundary helpers for text and numeric values; candidate optionals must be null or the declared type. The creator delete form now sends its attendance count as a number. Existing browser form code already sends candidate numeric fields and expected revisions as numbers.

| Variant | Post-fix result | Status |
| --- | --- | --- |
| Object/number room title and display name | HTTP 400 | CONFIRMED BY INDUCTION; fix holds |
| Object participant display name | HTTP 400 | CONFIRMED BY INDUCTION; fix holds |
| Object chat message or idempotency key | HTTP 400 | CONFIRMED BY INDUCTION; fix holds |
| Object text proposal content | HTTP 400 before provider call | CONFIRMED BY INDUCTION; fix holds |
| Object candidate title/area or non-text currency | HTTP 400 | CONFIRMED BY INDUCTION; fix holds |
| Numeric strings or null revision | HTTP 400 | CONFIRMED BY INDUCTION; fix holds |
| Object email or creator token | HTTP 400 before email send or creator-link consumption | CONFIRMED BY INDUCTION; fix holds |
| Valid create, join, chat, and numeric candidate fields | HTTP 200 / 201 as expected | CONFIRMED BY INDUCTION; valid path preserved |
| Malformed JSON and payload above 2,100,000 bytes | HTTP 400 for both before and after fix | CONFIRMED BY INDUCTION; no defect |

Afterward, the four temporary rooms created during this probe and their child rows were removed from local D1. No provider was called and no production database was accessed. `npm run typecheck` and `git diff --check` pass.

## Finding R1-03 — body parsing ignored the request media type

**Before-fix status:** CONFIRMED BY INDUCTION for server-side processing; browser impact remains a protocol-level inference.
**Impact:** a request labeled `text/plain` but containing JSON could create a room even when it supplied an unapproved `Origin`; the API did not block the request, although the response omitted CORS permission. Since room creation is intentionally public, this does not cross a login or ownership boundary. It makes a simple cross-origin browser request a potential way to consume shared resources. It does not stop direct scripts or bots; signup/resource controls remain open work.
**Root cause:** the common JSON body parser parsed JSON bytes without checking `Content-Type`; the CORS wrapper only decorates responses and does not block request processing by origin.

Before the fix, `POST /api/rooms` with `Origin: https://attacker.example`, `Content-Type: text/plain`, and a valid JSON body returned HTTP 200 and created a room. This was induced with Node `fetch`, not a real browser. After the fix, the same request returns HTTP 400 with `content-type must be application/json`. `application/json; charset=utf-8` still succeeds. The common parser also returned HTTP 400 for `text/plain` requests to chat, proposal, and creator-access endpoints, so one boundary check covers all body-parsing routes. Actual browser preflight/response behavior remains untested.

This narrows the browser-based simple-request path; it is not an abuse-control system. A direct client can still call the public endpoint with `application/json`, so rate limits and resource quotas remain required before arbitrary shared-backend traffic.

## Round status

The tested subset had no remaining confirmed finding. This is not a pass for the whole round because creator-link consumption, claim ownership checks against another uploader, duplicate review, malformed/oversized body boundaries, races, and lifecycle transitions remain untested.

## Next probes

1. Exercise creator-link token single-use, expiry, room ownership and fresh-session behavior with seeded local D1 rows; do not send email.
2. Exercise claim approval by the submitting participant versus another participant, duplicate review and stale revisions.
3. Exercise body/content-length mismatch, unusual content types, and error serialization beyond the basic malformed JSON and size-cap probes.
4. Exercise competing chat requests at the five-message boundary and competing state updates.
5. Record each confirmed defect separately, perform variant analysis across sibling paths, then replay the original induction after fixes.
