# Round 32 — repeated AI provider calls from one participant

**Date:** 2026-10-16  
**Threat model:** a person with a valid participant session repeatedly submits contribution extraction or candidate discovery to the shared Worker.  
**Scope:** actual Worker handlers and local Wrangler D1; synthetic content; Gemini methods mocked. No provider call or charge was made.

## Prediction

Because `createProposal` and `discoverCandidates` were not covered by ADR-0006's public-entry rate limiter, six concurrent valid requests from one session would all invoke the corresponding Gemini method. After remediation, five calls in each operation would be admitted and the sixth rejected before the provider method ran.

## Evidence

- **CODE FACT:** `enforcePublicBurstLimit` covered room lookup, creation, joining, and creator access only. Both authenticated AI routes bypassed it.
- **CONFIRMED BY INDUCTION (pre-fix):** six concurrent extraction requests using one valid session returned six HTTP 200 responses and invoked the mocked provider six times. The test ran before the Worker/config fix; no Gemini network request was made.
- **CONFIRMED BY INDUCTION (post-fix):** six concurrent extraction requests returned five HTTP 200 and one HTTP 429 with `Retry-After: 60`; the mocked extraction ran five times. Six candidate-discovery requests produced the same five/one split and five mocked provider calls. Thus the rejected request did not reach the provider method.
- The test limiter is a deterministic local stub. It proves Worker route wiring and behavior when the binding rejects; it does not reproduce Cloudflare's production counter placement or consistency.

## Fix

Added separate `AI_PROPOSAL_LIMITER` and `AI_DISCOVERY_LIMITER` bindings at 5 requests per 60 seconds per room/participant key in both production and staging config. A binding failure returns 503 (fail closed). Checks run immediately before provider invocation, after request validation and candidate-discovery idempotency/revision checks. The handler exposes 429 rather than silently retrying.

## Resource review

| path | untrusted work | observed before | bound now |
|---|---|---:|---|
| `POST /api/rooms/:id/proposals` | Gemini extraction for text (max 12,000 chars) or image input (request body capped at 2,100,000 bytes) | 6 provider calls for 6 concurrent requests from one participant | 5 admitted per 60 seconds per room/participant |
| `POST /api/rooms/:id/candidate-discovery` | Gemini candidate generation from bounded room state | No route-level call cap | 5 admitted per 60 seconds per room/participant |

The tested ratio is request count to provider invocations: pre-fix 6:6; post-fix 6:5. CPU, memory, live provider latency, and token/cost usage were not measured. Input caps and these rate bindings do not constitute a monthly financial quota.

## Variant analysis

- Checked both routes that invoke `GeminiProvider`: extraction and candidate discovery.
- Checked candidate idempotency replay ordering: existing replay returns before it needs a new provider call or consumes the AI allowance.
- Confirmed proposal review, candidate acceptance, and list/read endpoints do not invoke Gemini and were not placed under these provider-call limits.
- Multi-identity, multi-room, distributed-location, and global monthly-spend paths remain open. The binding is not exact cross-location accounting.

## Verification

`npx vitest run --config vitest.d1.config.mjs --reporter verbose`: 18 tests passed, including both 6-request boundary inductions. `npm test`: 38 tests across 9 files passed. `npm run typecheck`, `npm run build`, `git diff --check`, and JSON parse passed. `npx wrangler deploy --dry-run` and `npx wrangler deploy --env staging --dry-run` both listed the new bindings and exited successfully; neither command deployed.

## Disposition

The confirmed per-session unbounded-call gap is closed with an approximate burst limit. **Global provider spend remains unbounded by a shared quota** and must not be described as protected by this fix. See [ADR-0008](../decisions/ADR-0008-ai-provider-burst-limits.md).
