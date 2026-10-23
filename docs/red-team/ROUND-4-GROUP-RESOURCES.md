# Red team Round 4 — group and resource behavior

**State:** partial / open. Ordinary 20-person room behavior was exercised locally. Unbounded aggregate state and Gemini spend remain unresolved; no arbitrary product capacity was selected in this round.
**Date:** 2026-10-12.
**Threat model:** a valid participant can send arbitrary authenticated room requests and repeat them; an unauthenticated caller can use public room-entry routes subject to the Round 3 local-IP burst limits. The caller cannot read Worker secrets or alter code.
**Scope:** ordinary group flow, snapshot growth, deterministic evaluation, provider-call paths and retry behavior. No Gemini, email, production D1, Cloudflare edge, or deployed load test was used.

## R4-01 — room state and per-room work have no aggregate ceilings

**CODE FACT:** the `DecisionSnapshot` stores participants, facts, constraints, preferences and candidates as arrays. `participant.added`, `fact.confirmed`, `candidate.added`, `candidate.discovered` and `candidate.accepted` append entries without a count ceiling. `joinRoom` and `commitEvent` clone the full snapshot, evaluate it, and persist the full JSON snapshot. `evaluateSnapshot` checks every candidate against every constraint and preference, then sorts results. The resulting work grows with the product of candidates and constraints, while stored snapshot and event history grow over time.

**CONFIRMED BY INDUCTION — ordinary 20-person flow:** using local Wrangler+D1 at the code revision preceding this report, one synthetic room was created, 19 additional participants joined (20 total), and 20 manual candidates were added sequentially with valid session credentials and current revisions. All 19 joins and 20 candidate additions returned HTTP 200. Join requests took at most 21.23 ms in this local run. Candidate requests took 13.29–20.17 ms; the returned snapshot grew from 2,023 bytes at one candidate to 10,033 bytes at 20. This falsifies the claim that the ordinary 20/20 flow is already slow in this local setup. These timings do not estimate deployed capacity.

**PLAUSIBLE HYPOTHESIS:** a valid participant can keep appending candidates and confirmed facts, making subsequent requests, snapshots and lookup responses grow without a product-level bound. Many distinct IPs can also bypass the per-IP join burst cap over time. Code inspection establishes the missing aggregate ceilings; this round did not induce a resource-exhaustion failure, and does not report one as confirmed.

## R4-02 — Gemini-backed routes had no application quota at the time of this round

**CODE FACT:** both extraction and candidate discovery call `GeminiProvider` after session validation. The routes have no dedicated limiter or durable usage ceiling. A retryable provider failure triggers one retry after a one-second delay; each attempt can wait up to 12 seconds. Extraction also sends every room participant's display name, and candidate discovery sends every stored constraint. Provider output is persisted as proposals. Existing Round 3 bindings cover lookup, create and join only.

**PLAUSIBLE HYPOTHESIS:** a valid participant can repeatedly invoke provider-backed operations and consume shared provider quota or spend. The route and retry structure establishes exposure, but no provider request was made, and this round did not confirm billing impact, provider quota exhaustion, or a retry storm.

**Later disposition (Round 32; status rechecked 2026-10-23):** each operation now has a separate approximate limit of five calls per 60 seconds per room-participant pair. This reduces repeated calls from one key but is not an aggregate quota. Current Cloudflare documentation says binding counters are approximate and location-local; calls can exceed the configured threshold and separate locations do not share a worldwide counter ([Cloudflare Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), checked 2026-10-23). Multiple rooms/participants and provider retries also mean APORIA has no strict global request, token, daily/monthly usage, or spend cap. No live provider/billing behavior was checked. The original induction and timestamped table below remain historical evidence from before the later burst-limit fix.

## Variant analysis

The invariant under review is: **one valid room action must not make stored state or the work of later room actions grow without a deliberate ceiling.** Enumerated sibling paths:

| Path | Code review | Induction in this round |
| --- | --- | --- |
| Participant join → snapshot clone/persist | No per-room count ceiling; Room 3 per-IP burst cap is not an aggregate room cap | Exercised to 20 total participants; no failure observed |
| Manual candidate add → evaluate/persist | No candidate count ceiling | Exercised to 20 candidates; all succeeded |
| AI candidate acceptance → append multiple candidates | No visible aggregate ceiling at the reducer path | Not induced; provider generation not called |
| Claim confirmation → append facts/constraints | No visible aggregate ceiling at the reducer path | Not induced; constructing many proposals would require the provider route |
| Text/image proposal creation → provider call and proposal row | No dedicated application quota | Not induced; Gemini intentionally not called |
| Candidate discovery → provider call with all constraints | No dedicated application quota; input grows with stored constraints | Not induced; Gemini intentionally not called |
| Meeting-code lookup → serialize full snapshot | Existing 30/10s per-IP burst cap; room payload can still grow over time | No large-room lookup payload probe beyond 20/20 |

## Contended revision writes

**CONFIRMED BY INDUCTION:** two simultaneous participant joins both returned HTTP 200 and the resulting snapshot contained both names with revision incremented twice. A separate 16-request candidate-add burst used the same expected revision. Exactly one candidate was stored at the next revision; the other 15 requests returned HTTP 409 for stale revision. A follow-up room read showed one candidate and the matching revision, so the tested write path preserved a single-winner state under this local D1 contention pattern.

Wrangler logged roughly 20.3 seconds for the 15 stale responses in that 16-request burst. This is a local observation, affected by Wrangler's local proxy/D1 scheduling and a dropped-connection retry visible in its logs; it is not a production latency estimate. The test does flag a user-experience question for real multi-location or production load. No retry loop was run by the client.

No attempted variant is marked fixed or falsified without an independent induction. Local cleanup removed all three synthetic rooms and their rows; a D1 query confirmed no fixture rooms remained, and the Wrangler server was stopped.

## Decision needed before aggregate caps

Adding hard participant, fact, or candidate maxima changes the group's product contract. The existing planning scenarios target 2, 4, 12 and 20 people; they do not define a maximum. This report therefore records the unbounded paths and local 20/20 baseline without inventing a retrospective capacity requirement. A deliberate per-room capacity and provider budget are still needed before those ceilings can be implemented responsibly. Per-IP provider burst limits alone would not be a hard global spend quota and could throttle legitimate groups behind one NAT.

## Round status

Round 4 remains partial. Next work: agree a room capacity and provider budget; then implement transactional ceilings/quotas, exercise limit and limit+1 on every sibling write path, and re-run the 20-person flow. Production-sized capacity, concurrent races, distributed callers, and provider billing behavior remain unverified. No source code changed in this round.
