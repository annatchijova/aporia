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

## Closure rule

A round is complete only when its findings, falsified vectors, reproductions, fixes, and variant coverage are recorded in its report. A fix is not marked solved because its source changed: the original reproduction must fail after the fix, and sibling candidates must be checked independently. The integrated test/build/deployment checks happen after the system levels are complete and the integrated adversarial rounds have been addressed.

## Current status

- Round 1 local endpoint probe: **partial / open**; direct Worker+D1 probes exercised room lookup, observer reads, join, chat authorization, the five-message cap, idempotent replay, claim attribution/ownership, creator-link single use, close/reopen, recovery, expiry purge, malformed JSON, byte caps, JSON types, and content-type handling. Findings R1-01 (non-member claim attribution), R1-02 (wrong-type coercion), and R1-03 (ignored request media type) were reproduced, fixed, and checked across sibling paths. Live email issuance, successful delete/email flow, expiry boundaries, duplicate claim review, body-stream/content-length discrepancies, concurrency, and actual browser behavior remain untested. See [Round 1 report](ROUND-1-LOCAL-ENDPOINTS.md).
- Round 2 state/privacy: **partial / open**; found and fixed retention of an image content hash, MIME type, and byte length after byte redaction. Migration 0005 was applied to local D1 and replayed against a synthetic legacy row. CORS preflight probes passed for an exact origin and a Vercel origin, and rejected a lookalike. The successful image extraction path, Gemini provider handling, browser behavior, and lifecycle races remain untested. See [Round 2 report](ROUND-2-STATE-PRIVACY.md).
- Round 3 public abuse: **partial / open**; reproduced no burst cap on public room lookup/create, then added and exercised local limits of 30 lookups/10s, 3 creates/60s, and 60 joins/10s per synthetic IP. Local limit+1 calls returned 429. The native Worker limiter is location-local/eventually consistent, so global enumeration resistance, provider quotas, deployed edge behavior, and shared-NAT impact remain open. See [Round 3 report](ROUND-3-PUBLIC-ABUSE.md) and [ADR-0006](../decisions/ADR-0006-cloudflare-worker-burst-limits.md).
- Round 4 group/resources: **partial / open**; locally exercised 20 participants and 20 manual candidates, all successful, with candidate-request latency 13.29–20.17 ms and a 10,033-byte final snapshot. Code review found no per-room ceilings on participants, facts, candidates, or Gemini-backed calls; actual exhaustion and provider spend were not induced. Do not set hard capacity numbers until the group and provider budgets are explicit. See [Round 4 report](ROUND-4-GROUP-RESOURCES.md).
- Round 5 recovery read authorization: **finding fixed and locally rechecked**; an anonymous old UUID could read a seeded recovered-room snapshot including its next-room code. The Worker now requires the owning creator session for recovered-room GETs; local checks denied anonymous, invalid-token, and unrelated-creator reads while allowing the owner and preserving active-room observer reads. Browser/email reauthentication and deployment remain unverified. See [Round 5 report](ROUND-5-RECOVERY-READ-AUTHORIZATION.md).
- Formal integrated red-team rounds: **not started**.
- Variant analysis: **partial**; R1-01's client/stored attribution sources and empty-selector path were checked; R1-02's text/number coercion sites were enumerated; R1-03's shared body parser was checked across routes; R2-01 covered new response, new persistence, and historical migration paths; R3-01 has separate lookup/create/join limit keys and boundary inductions. Cross-location and distributed variants remain open.
- Source-reading preflight: found lifecycle ordering and concurrency concerns during construction; these were patched, but no exploit reproduction was run, so they are not reported as confirmed findings.
- Current local verification: `npm run typecheck`, `git diff --check`, and `npx wrangler types` pass; migrations 0003–0005 were applied to local D1. Synthetic creator-link consumption, room close/reopen, recovery, scheduled purge, image-metadata migration, CORS preflight, and all three rate-limit boundaries were exercised locally. Live email issuance, Gemini image extraction/provider quotas, real browser behavior, Cloudflare edge behavior, and deployment have not been exercised.
