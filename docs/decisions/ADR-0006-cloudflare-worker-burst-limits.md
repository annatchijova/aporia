# ADR-0006 — Apply edge burst limits to public room entry
Date: 2026-10-12   Status: accepted   Reversibility: two-way (Worker code and Wrangler configuration; no data migration)

## Forces at the time

- The owner instructed us to preserve the existing Cloudflare Worker/D1 architecture and build a shared event room service.
- Meeting-number lookup intentionally returns a room snapshot to anyone who knows the code. The code has eight decimal digits.
- Before this change, a local probe created 20 rooms in 272 ms and completed 200 invalid meeting-number lookups without a 429 response.
- The room creator and attendee flows are anonymous at entry, so a stable user account cannot identify a caller before these routes run.
- No production request-volume measurements exist. The Round 4 plan exercises groups of 2, 4, 12, and 20 people; those are planned scenarios, not a measured traffic profile or maximum group size.
- Cloudflare's current Worker Rate Limiting binding accepts a key and allows 10- or 60-second windows. Its counters are local to a Cloudflare location and eventually consistent; the documentation says they are not an accurate accounting system. Checked 2026-10-12: [Cloudflare Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

## Decision

Use native Worker Rate Limiting bindings keyed by Cloudflare's client-IP header for public room lookup, room creation, and participant joining:

- meeting-number lookup: 30 calls per 10 seconds per client IP;
- room creation: 3 calls per 60 seconds per client IP;
- room joining: 60 calls per 10 seconds per client IP.

Return HTTP 429 with `Retry-After` when a cap is reached. If a limiter binding errors, fail closed with HTTP 503. Do not persist IP addresses in D1. These are burst caps, not monthly quotas or a global abuse-control system.

## Alternatives rejected

- **D1 fixed-window counters:** rejected for this first cap because every anonymous lookup would create a durable write in the same database used by rooms, and the design would need bucket cleanup and IP-retention decisions. Best argument for it: shared database counters could provide more consistent cross-location accounting than the native binding.
- **A Durable Object per client or route:** rejected because it adds a stateful service and namespace lifecycle for a reversible first-pass cap. Best argument for it: a single serialized object can coordinate counters more closely for a key.
- **An external hosted rate-limit service:** rejected because it adds a provider, an outbound dependency, and a new failure path to the Worker. Best argument for it: a mature external service may offer more centralized policy and monitoring.

Cloudflare remains the provider because the existing Worker architecture is an explicit constraint from the owner; this record does not claim a general Cloudflare-versus-provider evaluation.

## Assumption this rests on

The selected windows allow ordinary groups to enter while reducing low-effort bursts from one source IP. Clients behind one NAT may share a limit, and an attacker with multiple IPs or requests served in multiple Cloudflare locations can exceed the effective global rate.

## Consequences

Accepted now: traffic from a shared IP can receive 429 during a legitimate burst; the control is probabilistic and geographically partitioned, so it must not be used for billing, monthly quotas, or exact abuse accounting.

Deferred: provider-call quotas, total room/member quotas, distributed abuse detection, and production telemetry remain separate work. No room lookup, create, or join endpoint is advertised as globally protected.

## Revisit trigger

Revisit before opening the shared backend to arbitrary public traffic, or sooner if a legitimate event hits a 429, production logs show repeated code-guessing bursts, or Gemini spend needs a hard ceiling.

## Anchored at

`src/worker.ts` (`enforcePublicBurstLimit`) and `wrangler.json` (`ratelimits`).
