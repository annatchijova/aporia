# Security Audit — APORIA
## Red Team Round 35: Gemini 429 retry amplification

**Date:** 2026-10-22  **Method:** `red-team-auditing`, `beyond-the-fix`, `variant-analysis`, `falsifiable-testing`, `git-discipline`
**Scope:** Gemini adapter retry behavior and its existing unit tests. No Worker or architecture changes.
**Base:** `main` @ `10922cda` (pre-fix); **reproduction:** `npx vitest run src/intelligence/gemini.test.ts --reporter verbose`

## Threat model

- Attacker can cause otherwise-authorized AI requests to reach Gemini, for example by participating in rooms and submitting permitted extraction or discovery requests.
- Attacker cannot control Gemini's response status or bypass the Worker authorization, rate limits, or D1 dispatch checks.
- Provider behavior was simulated with local `fetch` mocks. No real Gemini calls, credentials, billing, or production service were used.

## Epistemic legend

`CODE FACT` · `PLAUSIBLE HYPOTHESIS` · `CONFIRMED BY INDUCTION` · `FALSIFIED`

## Executive summary

| ID | Severity | Level | Module | Finding |
|---|---|---|---|---|
| R35-01 | Low | CONFIRMED BY INDUCTION | Gemini adapter | A provider HTTP 429 caused an immediate second POST after a fixed one-second delay. |

## R35-01 — Retry amplified a provider rate limit

**Severity:** Low  **Epistemic level:** CONFIRMED BY INDUCTION  **Bucket:** reliability/resource hygiene

- **Surprise:** ADR-0002 says 429 is exposed as `rate_limited`; the adapter also treated that error as eligible for its generic internal retry.
- **Abduction (ranked):** (1) `retryable` is overloaded as both “caller may retry later” and “adapter should retry now”; (2) 429 is intentionally retried once; (3) the retry loop is outside this adapter. The cheapest discriminator was a mocked 429 and exact fetch-call count.
- **Deduction (before execution):** On the pre-fix revision, one 429 response should produce two provider POST attempts; after the fix, it should produce one, while a 503 should still receive one bounded retry.
- **Induction:** Added an assertion to the existing `ProviderError` test. Before the fix, `npx vitest run src/intelligence/gemini.test.ts --reporter verbose` failed: expected one fetch, observed two. After the fix, the same command passed all 9 tests. Existing tests also confirmed 503 still retries once, including retry-then-success and retry-then-failure cases.
- **Causal chain:** HTTP 429 → `ProviderError('rate_limited', ..., true)` → generic `retryable` branch → fixed one-second wait → duplicate POST → second response.
- **Threat-model precondition:** An authorized request reaches the adapter and Gemini responds 429.

## Fix

The adapter now excludes `rate_limited` from its automatic retry branch. The error remains marked retryable so the route/caller can report a retryable rate limit; transient 502/503/504 and timeouts retain their existing one-retry behavior. No schema, Worker route, provider contract, or dependency changed.

## Discarded / limited vectors

| Vector | Result | Why |
|---|---|---|
| Temporary 503 overload retry | FALSIFIED as a defect | Existing tests prove exactly one retry remains, including success and repeated failure outcomes. |
| Real Gemini `Retry-After` semantics or billing impact | Not induced | No live provider access was used; this round proves adapter call count only. |
| Route-level 429 response headers and client retry timing | Out of scope / open | Requires a separate Worker-to-UI contract audit. |

## Verification limits

The induction used Vitest 5.0.2 with mocked global `fetch`; no external request occurred. Local test evidence does not establish how Gemini accounts for retries, the real provider's quota policy, or aggregate spend. The route still exposes a 429, and the client experience/backoff contract remains a follow-up candidate.
