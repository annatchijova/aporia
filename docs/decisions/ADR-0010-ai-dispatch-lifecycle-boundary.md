# ADR-0010 — Linearize AI provider dispatch against room lifecycle
Date: 2026-10-16   Status: accepted   Reversibility: two-way (Worker checks only; no schema migration)

## Context

After the AI burst limits, both provider routes awaited a rate-limit binding after checking that the room was active. The candidate-discovery route also inserted a `processing` reservation. A lifecycle action could close/reopen/delete the room while that await was suspended; both handlers then proceeded to Gemini using previously captured state. A later persistence guard rejected the output, but did not prevent the provider call.

Round 34 induced this for both candidate discovery and contribution extraction. In the candidate flow, close → reopen → delete won before the limiter returned, yet the mocked provider was called once. The response was 409 and no row remained. In the extraction flow, close won before the limiter returned, yet the mocked provider was called once; the later insert guard returned 409 and stored no proposal.

## Decision

Define provider dispatch as authorized by a conditional D1 write immediately after rate-limit admission:

- Candidate discovery refreshes its owned `processing` reservation only if its ID/status still match and the room remains active at the captured revision.
- Contribution extraction performs a conditional no-op room update only if the room remains active at the captured revision.

D1 serializes these checkpoints against lifecycle and room-state writes. If close/reopen/delete or a revision change wins first, the checkpoint affects zero rows, the handler returns 409, and it does not call Gemini. If the dispatch checkpoint wins first, the AI operation is considered in flight; a subsequent lifecycle action cannot cancel an external provider request already authorized. Existing post-provider persistence checks remain in force, so output is not persisted after a lifecycle transition.

## Consequences

There is no schema migration. Extraction retains its existing privacy behavior: image artifacts remain redacted before persistence, and a failed dispatch does not create a proposal row. Candidate discovery releases its reservation if the checkpoint fails. A real request that has crossed the checkpoint may still incur provider cost even if the room closes immediately afterward; Cloudflare/Gemini calls cannot be rolled back.

## Anchored at

`src/worker.ts` (`createProposal`, `discoverCandidates`) and Round 34's controlled lifecycle interleavings in the local Wrangler D1 harness.
