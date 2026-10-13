# APORIA — Red-team round plan

**State:** Round 1 is partially exercised; see current status. No integrated round is complete.
**Product order:** finish the real system first; build the guided demo last.
**Method:** use `red-team-auditing`, `invariant-hunting`, and `variant-analysis` from the project owner's personal skills.

## Evidence rules

Every observation must be labeled `CODE FACT`, `PLAUSIBLE HYPOTHESIS`, `CONFIRMED BY INDUCTION`, or `FALSIFIED`. Code reading alone does not confirm exploitability. Each round states its threat model, scope, and exclusions. A confirmed result includes a reproducible command or script, the code revision, the prediction made before execution, and the observed result.

Each confirmed defect becomes a variant-analysis lead. Record the invariant it violated, enumerate sibling endpoints and state transitions, test candidates independently, apply the fix, rerun the original reproduction, and check that the fix covers every enumerated sibling path. Keep falsified and discarded vectors in the round report.

## Planned rounds

### Round 1 — Local endpoint behavior

Inspect and exercise request parsing, identity and ownership checks, token consumption, per-claim review, chat limits, state transitions, and error handling. Threat model: an unauthenticated internet user or a participant with a valid room token can send arbitrary requests and race their own or other public actions; they cannot change the Worker code or read server secrets.

### Round 2 — State and privacy invariants

Trace room creation, observer entry, joining, posting, image extraction, claim confirmation, close, reopen, delete, recovery, and scheduled purge. Check that room status, owner identity, participant attribution, and deletion policy survive each transition. Include boundary times, retries, duplicate requests, and concurrent lifecycle actions.

### Round 3 — Cross-boundary composition

Exercise separately hosted frontends, exact-origin and optional Vercel-pattern CORS, API-origin configuration, public room lookup, D1 persistence, Gemini requests, email links, and expiry cleanup as one system. CORS is browser policy, not API authorization. Record the operator and provider assumptions needed for a shared backend.

### Round 4 — Group and resource behavior

Exercise the ordinary group flow at 2, 4, 12, and 20 participants, then repeat with conflicting writes, delayed network responses, large inputs, and repeated AI requests. Measure whether quotas, persistence, and user-visible errors remain bounded before exposing a shared deployment.

### Round 5 — Lifecycle authorization transitions

Check the actor × resource × action matrix across active, closed, trashed, and recovered rooms. Include an old attendee link, anonymous and unrelated creator sessions, the owning creator session, and the transition into and out of recovery. Preserve public observer reads where the product requires them; recovery-only data must follow the creator authorization boundary.

### Round 6 — Creator access abuse

Exercise the creator email-link request path with registered, unregistered, and malformed addresses, repeated requests, and multiple source IPs. Check that account existence is not exposed through status/body differences, unknown-address guesses cannot bypass the same source burst cap, and email delivery failures do not create durable orphan tokens. Do not send real email or test against production during local induction.

## Closure rule

A round is complete only when its findings, falsified vectors, reproductions, fixes, and variant coverage are recorded in its report. A fix is not marked solved because its source changed: the original reproduction must fail after the fix, and sibling candidates must be checked independently. The integrated test/build/deployment checks happen after the system levels are complete and the integrated adversarial rounds have been addressed.

## Current status

- Round 1 local endpoint probe: **partial / open**; direct Worker+D1 probes exercised room lookup, observer reads, join, chat authorization, the five-message cap including its concurrent boundary, idempotent replay, claim attribution/ownership, creator-link single use, close/reopen, recovery, expiry purge, malformed JSON, byte caps, JSON types, content-type handling, and local HTTP/1.1 framing variants. Findings R1-01 (non-member claim attribution), R1-02 (wrong-type coercion), and R1-03 (ignored request media type) were reproduced, fixed, and checked across sibling paths. A short declared length did not bypass JSON parsing, an oversized chunked body was rejected, and an eight-request race at four messages persisted only one additional message. Cloudflare deployed framing, memory pressure, live email issuance, successful delete/email flow, expiry boundaries, broader concurrency, and actual browser behavior remain unverified. See [Round 1 report](ROUND-1-LOCAL-ENDPOINTS.md).
- Round 2 state/privacy: **partial / open**; found and fixed retention of an image content hash, MIME type, and byte length after byte redaction. Migration 0005 was applied to local D1 and replayed against a synthetic legacy row. CORS preflight probes passed for an exact origin and a Vercel origin, and rejected a lookalike. The successful image extraction path, Gemini provider handling, browser behavior, and lifecycle races remain untested. See [Round 2 report](ROUND-2-STATE-PRIVACY.md).
- Round 3 public abuse: **partial / open**; reproduced no burst cap on public room lookup/create, then added and exercised local limits of 30 lookups/10s, 3 creates/60s, and 60 joins/10s per synthetic IP. Local limit+1 calls returned 429. The native Worker limiter is location-local/eventually consistent, so global enumeration resistance, provider quotas, deployed edge behavior, and shared-NAT impact remain open. See [Round 3 report](ROUND-3-PUBLIC-ABUSE.md) and [ADR-0006](../decisions/ADR-0006-cloudflare-worker-burst-limits.md).
- Round 4 group/resources: **partial / open**; locally exercised 20 participants and 20 manual candidates, all successful, with candidate-request latency 13.29–20.17 ms and a 10,033-byte final snapshot. Code review found no per-room ceilings on participants, facts, candidates, or Gemini-backed calls; actual exhaustion and provider spend were not induced. Do not set hard capacity numbers until the group and provider budgets are explicit. See [Round 4 report](ROUND-4-GROUP-RESOURCES.md).
- Round 5 recovery read authorization: **finding fixed and locally rechecked**; an anonymous old UUID could read a seeded recovered-room snapshot including its next-room code. The Worker now requires the owning creator session for recovered-room GETs; local checks denied anonymous, invalid-token, and unrelated-creator reads while allowing the owner and preserving active-room observer reads. Browser/email reauthentication and deployment remain unverified. See [Round 5 report](ROUND-5-RECOVERY-READ-AUTHORIZATION.md).
- Round 6 creator access abuse: **HTTP finding fixed and locally rechecked; timing hypothesis open**; with email delivery unconfigured, a registered address returned 503 while an unregistered address returned 200, and the latter bypassed the D1 token cooldown. Email delivery failure now returns a generic response, and a dedicated 5-per-60-second source-IP burst cap covers all creator-access attempts. A sequential mixed-address probe returned 200 for requests 1–5 and 429 on request 6; an eight-request local concurrent burst returned five 200s and three 429s. A separate randomized 40+40 local timing sample had a 2.80 ms p50 gap, too noisy and unlike production to confirm remote account enumeration. No email or production service was used. Distributed and deployed edge behavior remain unverified. See [Round 6 report](ROUND-6-CREATOR-ACCESS-ABUSE.md).
- Integrated red-team Round 7: **partial**; local Wrangler+D1 induction confirmed create → meeting-number lookup → second-person join → two authenticated chat posts → anonymous read with correct author attribution → synthetic creator login → close/read-only behavior. A fresh chat write after close returned 409; a pre-close idempotent replay returned the original result without a new row. Delete failed closed with 503 when local email was unavailable, preserving the closed room and its message. Cleanup verified and Wrangler stopped. Successful delete/recovery, browser behavior, staging, and provider-backed behavior remain open. See [Round 7 report](ROUND-7-INTEGRATED-PUBLIC-FLOW.md).
- Integrated red-team Round 8: **partial; client polling overlap addressed**. The three React refresh loops now schedule after completion and ignore responses after effect cleanup. Three focused tests pass, along with typecheck; delayed HTTP behavior in a real browser remains unverified. See [Round 8 report](ROUND-8-CLIENT-POLLING.md).
- Integrated red-team Round 9: **application-side screenshot flow mapped; email-token rejection cleanup fixed and mocked**. Raw image bytes are redacted before D1 persistence, while extracted claims/source snippets remain in proposals. Close retains room data; reopen/delete/purge have narrower cleanup behaviors. The earlier artifact-retention ADR is marked superseded. Provider, platform-backup/log, and operator-copy retention remain unknown; whether to redact `sourceText` after review awaits a product decision. Explicit email-provider rejection now removes the unused creator token; network delivery ambiguity remains. See [Round 9 report](ROUND-9-SCREENSHOT-DATA-FLOW.md).
- Variant analysis: **partial**; R1-01's client/stored attribution sources and empty-selector path were checked; R1-02's text/number coercion sites were enumerated; R1-03's shared body parser was checked across routes; R1 body framing checked declared-short, absent-length chunked, and oversized chunked requests locally; the chat cap's four-to-five concurrent boundary accepted exactly one of eight writes; R2-01 covered new response, new persistence, and historical migration paths; R3-01 has separate lookup/create/join limit keys and boundary inductions; R6-01 checked registered/unknown email and shared route-limit behavior. Cloudflare edge framing, memory-pressure, lifecycle concurrency, cross-location, production timing, and distributed variants remain open.
- Source-reading preflight: found lifecycle ordering and concurrency concerns during construction; these were patched, but no exploit reproduction was run, so they are not reported as confirmed findings.
- Current local verification: `npm run typecheck` and `git diff --check` pass; migrations 0003–0005 were applied to local D1. Synthetic creator-link consumption, room close/reopen, recovery, scheduled purge, image-metadata migration, CORS preflight, and the four configured rate-limit boundaries were exercised locally. Live email issuance, Gemini image extraction/provider quotas, real browser behavior, Cloudflare edge behavior, and deployment have not been exercised.
