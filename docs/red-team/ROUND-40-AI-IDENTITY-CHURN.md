# Red team Round 40 — AI burst-limit identity churn

**Date:** 2026-10-23  **Method:** `resource-exhaustion-review`, `red-team-auditing`, `variant-analysis`
**Base:** `main` @ `c1921a3` (README and quota disclosure update; test/report additions follow)
**Scope:** room join identity creation, participant-session authorization, and extraction burst-limit key construction. Gemini was mocked; Cloudflare rate-limit bindings and any provider account were not accessed.

## Threat model and prediction

A caller knows an active room link and can submit the public join request more than once. Joining does not require personal authentication. The API issues a participant session, then accepts provider-backed operations authorized by that session.

Prediction: each successful rejoin will receive a fresh participant ID; because that ID is part of the Gemini limiter key, the same synthetic caller can receive a new per-participant allowance after rejoining. This would mean the limit controls identities, not people or total room usage.

## Evidence

- **CODE FACT:** `joinRoom` generates `crypto.randomUUID()` for each participant and creates a new session on each successful request. It does not return an existing participant by display name or otherwise deduplicate a returning caller.
- **CODE FACT:** `enforceAiBurstLimit` keys extraction and candidate-discovery counters on operation, room ID, and participant ID. The public join cap is keyed by source IP, but has a 60-per-10-second configuration; it is not a durable per-room participant or usage ceiling.
- **CONFIRMED BY LOCAL D1 INDUCTION:** a synthetic client joined one room twice with the same display name. The Worker returned two distinct participant IDs and session tokens. A text-extraction request under each session returned 200; the AI limiter stub observed two different keys and the mocked extraction method ran twice.
- **LIMIT:** the test exercised Worker handlers and local Wrangler D1, while the join and AI limiters were deterministic stubs. It confirms identity churn and key construction, not Cloudflare's live counters, a human's account identity, Gemini billing, or a financial loss.

The candidate-discovery path uses the same key helper and therefore has the same code-level identity property. This round did not separately induce two rejoined sessions through candidate discovery.

## Finding and disposition

**R40-01 — the per-participant burst limit can be refreshed by rejoining.** The five-calls-per-minute cap is per generated participant ID, not per person or room. A room-level cap and aggregate cap are absent. Cloudflare's current documentation says Worker rate-limit counters are approximate and separate by location; that further prevents treating them as strict global accounting ([Cloudflare Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), checked 2026-10-23).

**Severity:** resource/cost exposure; aggregate impact and actual spend are unverified. This is a confirmed identity/key behavior, not a confirmed provider-billing incident.

No numeric cap was added. The project's pending capacity question asks for a participant maximum and a per-room Gemini usage budget; choosing either would change the product contract, and no value is recorded as approved. The current controls remain useful burst protection for one ID but do not promise aggregate limits. The open decision is recorded in [`docs/preguntas.md`](../preguntas.md) and faithfully translated in [`docs/questions.md`](../questions.md).

## Verification

The D1 suite now contains a regression for this behavior. On 2026-10-23, `npx vitest run --config vitest.d1.config.mjs` passed 26 tests across two files, including the two-join/two-key induction. No real Gemini call, Cloudflare edge request, deployment, or billing configuration was used. The current app and service deployment status remain as stated in the [Technical README](../../TECHNICAL-README.md).

## Open follow-up

After a room capacity and Gemini budget are explicitly chosen, design a strict room-level/shared quota with atomic reservation, retry accounting, expiry, and user-visible exhaustion behavior. Test limit and limit-plus-one across both extraction and candidate discovery, concurrent requests, rejoin, multiple rooms, and retry paths. Until then, do not call the existing burst limits a global provider quota or spend cap.
