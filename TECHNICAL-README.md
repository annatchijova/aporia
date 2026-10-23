# APORIA — Technical README

[English README](README.md) · [Español](README_ES.md)

## Status and epistemic boundary

**Status (2026-10-23):** This repository contains the current React/TypeScript client, Cloudflare Worker API, D1-backed room state, Gemini extraction/discovery, room lifecycle and local red-team coverage. The current workspace version is **not verified as deployed**. The earlier Webflow beta is separate; the planned Vercel frontend with this Worker/D1 backend has not been configured or verified. Local evidence at this revision: 47 unit tests across 11 files; 26 local Wrangler D1 tests across two files; typecheck and production Vite build pass. These checks establish local behavior only. They do not establish current production data, provider settings, deployed configuration, browser behavior, or platform retention. See [the red-team plan](docs/red-team/APORIA-ROUND-PLAN.md) for finding-level evidence and open checks.

The implemented product flow includes meeting-code lookup, observer access, shared chat with a server-side five-message-per-participant cap, screenshot/text proposals with uploader review, candidate discovery and human acceptance, deterministic plan evaluation, dietary notes, and creator close/reopen/delete/recovery. Gemini extraction and discovery have separate configured burst limits of five requests per room-participant pair per 60 seconds. Since each room join creates a new participant ID, joining again yields a fresh limiter key. Cloudflare describes these binding counters as approximate and location-local; they are not a global quota or spend cap, so aggregate calls and spend remain unbounded by APORIA. See [its rate-limit documentation](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

The room-read boundary follows lifecycle state: active and closed rooms retain public observer reads; reopening exposes a sanitized read-only archive through the old room link; trash hides the room; a recovered snapshot requires a creator session bound to the owning account. Participant writes and joins are active-only. The current local D1 evidence is summarized in [Round 41](docs/red-team/ROUND-41-ROOM-LIFECYCLE-AUTHORIZATION-COMPOSITION.md); browser and deployed authorization remain unverified.

The seven-day recovery snapshot is allowlisted, not anonymous by guarantee. It retains candidate title, schedule, price, aggregate registration/attendance counts, and an optional next-room meeting number. A candidate title can contain identifying text, low-count aggregates can enable inference, and the next-room number links records across rooms. The snapshot is visible only to the creator after recovery, but its stored fields should still be treated as potentially identifying data. The PRD's stricter “nonpersonal information only” requirement remains open against this implementation; see [Round 42](docs/red-team/ROUND-42-RECOVERY-SNAPSHOT-IDENTIFIABILITY.md) and the pending [recovery-data question](docs/preguntas.md).

The central AI/data boundary is:

```text
untrusted human/AI input
  → bounded extraction proposal
  → explicit human confirmation
  → typed canonical model
  → deterministic evaluation
  → explainable plan projection
```

An LLM may interpret heterogeneous input or propose candidates. It is never the authority for availability, constraint satisfaction, ranking validity, or consensus.

## Client stack

The client is built with **Vite + React + TypeScript**. Vite builds the browser bundle; React renders room state and interaction; TypeScript expresses client-side command/snapshot contracts. None of these is a trust boundary: the browser is user-controlled and all commands are revalidated server-side.

Gemini credentials, durable persistence, authorization, canonical state transitions, provenance, and deterministic evaluation remain server-side. A `VITE_*` variable must never contain a provider secret.

## Destination

APORIA is intended to become a general collective decision engine. A room has a shareable identity, a sequence of contributed evidence, a confirmed canonical model, evaluated candidate plans, and a verifiable snapshot.

The first coherent product state is a planning room for a concrete group decision. It must already establish the interfaces needed for screenshots, links, polls, minimal relaxation, realtime collaboration, and verification. Later levels extend the same model rather than replacing a text-only prototype.

## Core model

The canonical model should represent, at minimum:

- participants and attribution of each contribution;
- availability intervals and timezone/locale assumptions;
- preferences, vetoes, budgets, travel limits, dietary or other hard constraints;
- candidate places or activities with source and confidence metadata;
- whether a fact is proposed, confirmed, rejected, stale, or superseded;
- a source/proposal reference and extraction record for each proposed fact. Raw submissions are not retained in proposal artifacts after Gemini responds; extracted `sourceText` is retained only while a claim is pending review and cleared when decided.

Illegal states should be rejected at the boundary. A proposed extraction is not a fact until a human confirms it. A candidate is not a valid plan until the deterministic evaluator checks it against the confirmed model.

## Deterministic decision path

The consequential path must use typed values and exact arithmetic:

- integers for counts and discrete indices;
- exact fractions or a pinned decimal representation for ratios and weighted scores;
- no floating-point value in a result that is ranked, explained as a trade-off, or sealed;
- stable ordering and explicit tie-breakers;
- one versioned canonical serializer for snapshots;
- SHA-256 over canonical bytes for the optional Verify surface;
- a determinism check that repeats evaluation with reordered inputs and equivalent fresh processes.

Natural-language explanations are a projection of evaluated facts. They may improve readability but must not introduce a constraint, score, source, or causal explanation absent from the evaluated result.

## Trust boundaries

The client, uploaded files, pasted text, links, realtime messages, and model outputs are untrusted inputs. The extraction service is a proposer, not an authority. The canonical model is accepted only through explicit confirmation. The evaluator receives typed confirmed data and returns a deterministic result. Persistence must atomically store the accepted event, resulting snapshot, and audit record, or store none of them.

The system should fail closed on malformed input, ambiguous confirmation, stale revisions, missing source records, candidate lookup failures, and concurrent writes. A retry must be idempotent; a partial physical or network failure must not create an accepted fact without its provenance.

## Construction levels

### Level 1 — Shared Planning Room

**User-visible capability:** create a room, contribute text, confirm extracted constraints, and see ranked plans with template-derived explanations.

**Architecture introduced:** room identity, typed canonical model, extraction proposal boundary, confirmation state machine, deterministic overlap/evaluation engine, and revisioned persistence.

**Invariants:** no unconfirmed extraction enters the model; no LLM output directly changes a decision; exact arithmetic and stable tie-breaking; every accepted fact has contributor and source provenance; stale writes are rejected or explicitly rebased.

**Adversarial questions:** can a replayed confirmation be applied twice? Can a client claim another participant’s identity? Can malformed intervals, timezones, duplicate keys, or oversized input bypass validation? Does a crash between acceptance and audit leave a phantom fact?

**Next level:** screenshots and links use the same proposal/confirmation contract without changing the canonical model.

### Level 2 — Heterogeneous Evidence

Adds screenshots, pasted conversations, calendar captures, Maps links, and candidate-source records. OCR/vision/LLM output remains a bounded proposal with uncertainty and source coordinates where possible.

### Level 3 — Candidate Discovery

Adds bounded Gemini candidate drafts, explicit human acceptance, provider provenance, typed normalization, and deterministic evaluation. Candidate discovery never creates Facts or Constraints.

### Level 4 — Minimal Relaxation

When no plan satisfies all hard constraints, the evaluator computes bounded relaxation candidates. Each relaxation identifies the exact constraint, old value, new value, cost/order, affected participants, and resulting plans. “Minimal” is meaningful only relative to a documented cost function and tie-break policy.

### Level 5 — Structured Participation

Availability grids and polls become direct typed inputs. They must compile into the same canonical model and preserve authorship, timestamps, revision, and provenance; they do not create a second decision engine.

### Level 6 — Verify

The room can expose a canonical snapshot, schema/canonicalization version, source references, evaluator version, and SHA-256 digest. Verification must be possible independently of the UI and must state exactly what the digest covers and what it does not prove.

## Known design decisions

### Human confirmation is a state transition

Extraction is not ingestion. The system stores a proposal and its evidence, requests confirmation, and records accept/reject/revise as an attributed event. Silence, timeout, or an ambiguous gesture is not acceptance.

### Candidate discovery is separate from evaluation

Search, APIs, and LLMs may produce candidate places or activities. The evaluator checks only returned, typed candidate fields with source metadata. Missing or unverifiable fields remain unknown; they do not become passing values by default.

### “No solution” is a result

The evaluator must be able to return no feasible plan with a reason trace. Relaxation is a separate operation that does not silently weaken the original room constraints.

## Threats and failure modes

- forged participant attribution or source provenance;
- prompt injection in pasted messages, screenshots, or linked pages;
- stale confirmations racing with edits;
- replayed realtime events;
- duplicate or conflicting canonical facts;
- an LLM hallucinating availability, venue attributes, or agreement;
- hidden hard constraints omitted from a plan explanation;
- rankings changing because of unordered collections or floating point;
- candidate APIs returning stale, partial, or adversarial data;
- concurrent room updates producing a plan from a snapshot no participant confirmed;
- a hash being mistaken for truth rather than integrity of a stated payload;
- partial persistence of a fact without its audit/provenance event.

## Evidence status

Local evidence on 2026-10-23: 47 unit tests across 11 files and 25 tests across two local Wrangler D1 integration files pass; typecheck and production Vite build pass. The D1 suite exercises actual local Worker handlers and synthetic data, not a deployed database. Earlier work exercised a separate Webflow-hosted beta, but that does not establish that the current repository revision is deployed. The planned Vercel frontend/current Worker deployment, current Gemini account tier, and production data remain unverified.

Still open: this document does not record a fresh-process determinism run over reordered inputs; browser behavior on the current revision is not verified; global Gemini usage/spend caps and distributed-abuse controls are absent; production configuration and provider tier remain unknown; L5/L6 have no implementation to test. The [red-team plan](docs/red-team/APORIA-ROUND-PLAN.md) tracks more application-level adversarial tests and their limits.

## Non-goals for the first coherent state

The first state does not need to solve every group decision domain, guarantee perfect extraction, or expose cryptographic detail to ordinary participants. It does need to preserve the authority boundary and provide an honest path from evidence to confirmed model to evaluated plan.
