# ADR-0008 — Limit AI provider bursts per room participant
Date: 2026-10-16   Status: accepted   Reversibility: two-way (Worker bindings and Wrangler config; no data migration)

## Context

The contribution-extraction and candidate-discovery endpoints invoke Gemini after validating an active room session. They had no application rate limit. In Round 32, six concurrent extraction requests from one valid participant session all reached the mocked provider and returned success. This established unbounded calls per session in the Worker path; it did not call Gemini or incur provider charges.

The project has no production request or spend telemetry, no stable user account for participants, and no chosen monthly spend ceiling. Room creation is already limited per client IP, but room creation limits do not bound requests within a room.

## Decision

Apply independent Cloudflare Worker rate-limit bindings to each participant and room pair:

- Gemini contribution extraction: 5 calls per 60 seconds.
- Gemini candidate discovery: 5 calls per 60 seconds.

The limit runs after session validation and request/revision checks, immediately before a provider call. Existing candidate-discovery idempotency replays do not consume a provider-call allowance. Return HTTP 429 with `Retry-After: 60` when the binding rejects a call. If the binding errors, fail closed with HTTP 503.

## Limits of this control

These are burst controls, not financial quotas or a global spend ceiling. The existing Cloudflare rate-limit model is location-scoped and eventually consistent. Multiple participants, rooms, identities, or locations can exceed the practical aggregate limit. This decision does not estimate or cap monthly Gemini charges and does not add provider-cost telemetry. A hard budget needs a separate design for shared accounting, retry/refund semantics, retention, and operator alerts.

Cloudflare documents the location scope and accounting limitation in its [Workers Rate Limiting binding reference](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) (checked 2026-10-16).

## Consequences

A participant can receive 429 after five provider requests in a minute, including legitimate repeated use. Extraction and discovery have independent allowances. The limit is keyed by room and participant ID, so it remains stable across tabs sharing that participant session; issuing or obtaining another participant identity creates another key.

## Revisit trigger

Revisit after measured event usage, a legitimate participant hitting the cap, before opening the shared backend to arbitrary traffic, or before promising a hard provider-spend ceiling.

## Anchored at

`src/worker.ts` (`enforceAiBurstLimit`, `createProposal`, `discoverCandidates`) and `wrangler.json` (production and staging `AI_PROPOSAL_LIMITER`, `AI_DISCOVERY_LIMITER`). Round 32 provides the pre-fix induction and post-fix regression evidence.
