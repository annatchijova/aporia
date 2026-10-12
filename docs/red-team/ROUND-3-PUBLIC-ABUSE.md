# Red team Round 3 — public lookup and burst abuse

**State:** partial; one unbounded public-entry finding reproduced and partially mitigated. No integrated round is complete.
**Date:** 2026-10-12.
**Threat model:** an unauthenticated internet client can call the public Worker routes and vary requests; it cannot read Worker secrets or alter server code.
**Scope:** meeting-code lookup, room creation, participant joining, and the new rate-limit bindings. Gemini/email costs, deployed Cloudflare behavior, browser CORS, and distributed attacks were not exercised.

## Finding R3-01 — public room discovery and creation had no burst caps

**Before-fix status:** CONFIRMED BY INDUCTION for the local Worker behavior. The public lookup returned an entire room snapshot for a valid meeting code; anyone with the link or code can read the room by product design. Before the fix, the Worker accepted 20 room creations in 272 ms and answered 200 concurrent lookups for one invalid code with HTTP 404; none returned 429. The 200 misses took 1.659 seconds on this local Worker/D1 setup. This confirms no application burst cap on those paths; it does not measure production capacity or complete a full code-space scan.

The eight-digit meeting number is an invitation capability. Unbounded guesses can turn the valid/invalid response into an enumeration oracle, and repeated public creation/join requests can consume shared Worker/D1 resources. A successful code lookup returns the full shared room snapshot, including participant display names and confirmed planning data.

### Fix and variant verification

Added three Cloudflare Worker Rate Limiting bindings, keyed by `CF-Connecting-IP`, with distinct limits for meeting-code lookup, room creation, and joining. Requests over their limits receive HTTP 429 and `Retry-After`; a binding error returns 503. OPTIONS preflight is not counted. The design does not store client IPs in D1.

| Probe after fix | Expected cap | Observed | Result |
| --- | ---: | --- | --- |
| Repeated lookup from one synthetic IP | 30 per 10 seconds | 30 HTTP 404 responses, then HTTP 429 | CONFIRMED BY INDUCTION; cap holds |
| Repeated room creation from one synthetic IP | 3 per 60 seconds | 3 HTTP 200 responses, then HTTP 429 | CONFIRMED BY INDUCTION; cap holds |
| Repeated participant join from one synthetic IP | 60 per 10 seconds | 60 HTTP 200 responses, then HTTP 429 | CONFIRMED BY INDUCTION; cap holds |

The probe called local Wrangler/D1 with synthetic `cf-connecting-ip` values and applied no email or Gemini calls. It created three rooms for the create-cap test and one for the join-cap test; all four rooms and child rows were deleted afterward. The Worker was stopped. `npm run typecheck`, `git diff --check`, and `npx wrangler types` passed; the generated type file was removed because it is not part of this change.

### Limits and remaining vectors

Cloudflare documents that Worker Rate Limiting counters are local to a Cloudflare location, eventually consistent, and not accurate accounting. This is a per-source burst brake, not a global quota; a multi-IP or multi-location client can exceed it. IP caps can also affect many legitimate people behind the same NAT. These controls do not bound Gemini spend, daily room creation, total room membership, or long-term resource use. The live edge behavior and Cloudflare-provided client IP cannot be verified from the local probe. [Cloudflare Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

The endpoint mapping uses the same normalized route path as the API handler; query-string changes do not change the key. Separate bindings prevent lookup traffic from consuming the creation or join bucket. The returned 429 is still CORS-decorated only for configured origins; CORS is not authorization.

**Round status:** the tested limits hold locally. Round 3 remains open for real Cloudflare edge behavior, shared-NAT impact, multiple-location behavior, provider spend quotas, and integrated frontend/API-host composition. Do not interpret this result as readiness for arbitrary public traffic.
