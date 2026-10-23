# Security Audit — APORIA
## Red Team Round 37: local AI limiter Retry-After variant

**Date:** 2026-10-22  **Method:** `beyond-the-fix`, `variant-analysis`, `resilient-ui-states`, `falsifiable-testing`
**Scope:** The app-owned AI burst limiter's 429 response and client handling. This is a variant audit of Round 36.
**Base:** `main` @ `001dddd` (after Round 36); local mocked limiter and pure client helper tests.

## Threat model

- A participant can exceed APORIA's per-room/per-participant AI request burst allowance.
- The participant cannot bypass the route checks or make a rejected request call Gemini.
- Limiter responses were induced with a local stub. Cloudflare's deployed behavior was not exercised.

## Epistemic legend

`CODE FACT` · `PLAUSIBLE HYPOTHESIS` · `CONFIRMED BY INDUCTION` · `FALSIFIED`

## Executive summary

| ID | Severity | Level | Module | Finding |
|---|---|---|---|---|
| R37-01 | Low | CONFIRMED BY INDUCTION | AI request limiter/client | APORIA's own 429 omitted the provider code used by Round 36 and carried `Retry-After: 60`; the client discarded both status and header. |

## R37-01 — The sibling 429 source bypassed the new guidance

**Severity:** Low  **Epistemic level:** CONFIRMED BY INDUCTION for local Worker and client helper behavior; deployed Cloudflare timing unverified. **Bucket:** usability/resource hygiene.

- **Surprise:** The app-level AI limiter returns 429 with `Retry-After: 60`, but no `code: rate_limited`. Round 36's code-only UI mapping did not match this response, while the generic request parser discarded the header.
- **Abduction (ranked):** (1) The app limiter is a sibling source of 429; (2) the endpoint has no structured indication of throttling; (3) the UI deliberately hides server wait hints. `enforceAiBurstLimit` and one forced local rejection distinguish these cheaply.
- **Deduction:** A rejected app limiter should return 429 and `Retry-After: 60`, with zero provider calls and writes; client error mapping should use the supplied wait value even without a provider-specific code.
- **Induction:** The new Worker test forces the proposal limiter to return `success: false`; it observed HTTP 429 and `Retry-After: 60`, no Gemini call, and no inserted proposal. The helper unit test maps an `ApiRequestError` with status 429 and `retryAfterSeconds: 60` to the localized duration message. General suite, D1 suite, typecheck, build, and diff check pass.
- **Causal chain:** app limiter rejects → Worker emits 429 + `Retry-After: 60` without provider code → old client ignored status/header → generic “try again” fallback.
- **Threat-model precondition:** A participant has consumed the local AI burst allowance.

## Fix

The request error now retains HTTP status and a valid numeric delta-seconds `Retry-After`. Any 429 receives a localized wait message; when the server supplies a numeric duration, the UI displays it. No client retry is added. The provider's 429 response still has no forwarded duration, so it gets the generic wait-a-bit message.

## Discarded / limited vectors

| Vector | Result | Why |
|---|---|---|
| Local limiter request reaches Gemini | FALSIFIED in local Worker induction | The limiter returns before provider dispatch; test spy remained untouched. |
| Local limiter writes an extraction proposal | FALSIFIED in local Worker induction | Handler returns before provider work or proposal insert; test records zero rows. |
| Provider rate limit has a numeric `Retry-After` in APORIA's current adapter | FALSIFIED by code inspection | Adapter maps status to `rate_limited` but does not carry response headers; no duration is available to the client. |
| Cloudflare deployed limiter window is exactly 60 seconds everywhere | Not induced | Stubbed Worker binding does not prove deployed edge timing or cross-location behavior. |

## Verification

- Focused: `npx vitest run src/client/request-error.test.ts src/worker-image-proposal.test.ts --reporter verbose` — 8 passed.
- General: `npm test` — 43 passed across 10 files.
- D1 lifecycle suite: `npx vitest run --config vitest.d1.config.mjs --reporter verbose` — 24 passed.
- `npm run typecheck`, `npm run build`, and `git diff --check` passed.

No browser, Gemini, or deployed Cloudflare service was used. The browser-visible duration is established by pure helper mapping plus source wiring, not by a rendered UI test.
