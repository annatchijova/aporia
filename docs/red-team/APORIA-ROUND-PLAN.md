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

## Closure rule

A round is complete only when its findings, falsified vectors, reproductions, fixes, and variant coverage are recorded in its report. A fix is not marked solved because its source changed: the original reproduction must fail after the fix, and sibling candidates must be checked independently. The integrated test/build/deployment checks happen after the system levels are complete and the integrated adversarial rounds have been addressed.

## Current status

- Round 1 local endpoint probe: **partial / open**; direct Worker+D1 probes exercised room lookup, observer reads, join, chat authorization, the five-message cap, idempotent replay, claim attribution/ownership, creator-link single use, close/reopen, recovery, expiry purge, malformed JSON, byte caps, JSON types, and content-type handling. Findings R1-01 (non-member claim attribution), R1-02 (wrong-type coercion), and R1-03 (ignored request media type) were reproduced, fixed, and checked across sibling paths. Live email issuance, successful delete/email flow, expiry boundaries, duplicate claim review, body-stream/content-length discrepancies, concurrency, and actual browser behavior remain untested. See [Round 1 report](ROUND-1-LOCAL-ENDPOINTS.md).
- Formal integrated red-team rounds: **not started**.
- Variant analysis: **partial**; R1-01's two attribution sources and empty-selector path were traced and tested after the fix. Variant analysis for later findings has not started.
- Source-reading preflight: found lifecycle ordering and concurrency concerns during construction; these were patched, but no exploit reproduction was run, so they are not reported as confirmed findings.
- Current local verification: `npm run typecheck` and `git diff --check` pass; migrations 0003 and 0004 were applied to local D1. Synthetic creator-link consumption, room close/reopen, recovery, and scheduled purge were exercised locally. Live email issuance, browser behavior, and deployment have not been exercised.
