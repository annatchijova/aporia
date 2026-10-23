# Security Audit — APORIA
## Red Team Round 36: preserve provider rate-limit errors in the UI

**Date:** 2026-10-22  **Method:** `red-team-auditing`, `resilient-ui-states`, `non-overwhelming-ux`, `falsifiable-testing`
**Scope:** Worker-to-client handling of Gemini 429 responses for text extraction, screenshot extraction, and candidate discovery.
**Base:** `main` @ `b5194aa` (after Round 35); local mocked Worker/provider and pure client helper tests.

## Threat model

- A participant can make an otherwise-authorized AI request that receives a Gemini 429.
- The participant cannot bypass Worker authorization or make the UI perform an automatic retry.
- Gemini and Worker behavior were simulated locally. No live request, credentials, or billing was used.

## Epistemic legend

`CODE FACT` · `PLAUSIBLE HYPOTHESIS` · `CONFIRMED BY INDUCTION` · `FALSIFIED`

## Executive summary

| ID | Severity | Level | Module | Finding |
|---|---|---|---|---|
| R36-01 | Low | CONFIRMED BY INDUCTION | Worker/client error contract | The Worker preserved `rate_limited`, but the shared client helper discarded the code and the three AI flows showed only “try again.” |

## R36-01 — The client hid the provider rate limit

**Severity:** Low  **Epistemic level:** CONFIRMED BY INDUCTION for the Worker response and pure message mapping; browser rendering not exercised. **Bucket:** usability/reliability hygiene.

- **Surprise:** The Worker sent HTTP 429 with `code: rate_limited` and `retryable: true`, but the shared request helper parsed only `error` and threw a plain `Error`. Text extraction, image extraction, and candidate discovery caught it and displayed generic retry copy.
- **Abduction (ranked):** (1) The helper discards structured error properties; (2) one feature route omits the code; (3) a rendering condition hides an otherwise-specific message. Inspecting the response parser and directly testing the Worker route was the cheapest discriminator.
- **Deduction:** A mocked provider `rate_limited` error should produce HTTP 429 with its code and no proposal write; the client mapping should select the wait-before-retry copy only for that code and preserve generic copy for other failures.
- **Induction:** `worker-image-proposal.test.ts` now verifies HTTP 429, `rate_limited`, `retryable: true`, and zero persisted proposals. `request-error.test.ts` verifies rate-limit mapping and unchanged fallback for unrelated errors. Full typecheck/build and test suites pass. No browser was launched.
- **Causal chain:** Worker returns `{ code: 'rate_limited' }` → `request()` reads but discards `code` → component catches a plain error → generic “Try again” text encourages an immediate retry.
- **Threat-model precondition:** An authorized AI request receives an upstream 429.

## Fix

The shared request helper now throws `ApiRequestError` with the server's structured code. Text extraction, screenshot extraction, and candidate discovery show a localized message asking the user to wait before trying again. The message does not guess a wait duration, and no automatic retry was added. Unrelated errors retain their existing fallback messages.

## Discarded / limited vectors

| Vector | Result | Why |
|---|---|---|
| Automatic client retry | FALSIFIED as present | Code review of these three handlers shows no retry loop; each action runs only on explicit user submission. |
| Proposal persisted on provider 429 | FALSIFIED in local Worker induction | The route returns before persistence; regression test confirms zero inserted rows. |
| Browser-visible text and screen-reader announcement | Not induced | No browser or assistive technology run was performed. |
| Exact retry duration | Left unspecified | Upstream 429 policy may vary; this round has no evidence for a fixed delay. |

## Verification

- Focused tests: `npx vitest run src/client/request-error.test.ts src/worker-image-proposal.test.ts --reporter verbose` — 6 passed.
- General tests: `npm test` — 41 tests across 10 files passed.
- D1 lifecycle suite: `npx vitest run --config vitest.d1.config.mjs --reporter verbose` — 24 passed.
- `npm run typecheck`, `npm run build`, and `git diff --check` passed.

The client error mapping test is a pure helper test, not an end-to-end browser test. The Worker provider response is mocked. No live Gemini, Cloudflare deployment, or email service was involved.
