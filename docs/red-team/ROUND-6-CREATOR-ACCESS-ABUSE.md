# Round 6 — Creator access request abuse

**Date:** 2026-10-12 (local time)  
**Baseline revision:** `a81e94c` (`fix: restrict recovered room reads to creator`)  
**Threat model:** an unauthenticated caller can request a creator email link for a room and choose the submitted address. The caller cannot read Worker secrets or change deployed configuration.  
**Scope:** `POST /api/rooms/:id/creator-access`, its response behavior, D1 token creation, and per-source-IP burst limiting.  
**Excluded:** real email delivery, production services, deployed Cloudflare edge behavior, distributed source IPs, and browser UX.

## Prediction before induction

At baseline, a registered creator email with local email delivery unconfigured would take the send-error branch and return 503, while an unknown email would return the generic 200 response. Unknown addresses also returned before the D1 token cooldown check. After mitigation, registered and unregistered addresses should receive the same response through the first five requests from one source IP, and the sixth request should receive 429. No durable token should be created when delivery configuration is absent.

## Finding R6-01 — account-existence response oracle and cooldown bypass

**CONFIRMED BY INDUCTION (baseline):** with a synthetic closed room and synthetic creator account in local Wrangler D1, the registered address returned HTTP 503 `{"error":"could not send verification email"}` while an unregistered address returned HTTP 200 `{"sent":true}`. The room-level recent-token check followed account matching, so unknown-address guesses did not reach that cooldown. The local configuration had no Resend bindings. A D1 query showed zero tokens after the registered-address failure, falsifying the orphan-token hypothesis: `sendCreatorLink` checks configuration before inserting a token.

The result disclosed whether the guessed address was registered to that room when email configuration was broken. The cooldown ordering also meant repeated unknown-address guesses were not rate-limited by the D1 token check.

## Fix and variant coverage

- Added a dedicated native Worker Rate Limiting binding for `POST /api/rooms/:id/creator-access`: 5 requests per 60 seconds per `cf-connecting-ip`, using the existing fail-closed limiter path. Both registered and unregistered addresses pass through the same edge cap.
- Email delivery/configuration failures now log a generic server-side message and return `{"sent":true}` with HTTP 200, matching the unknown-address response. This prevents the delivery failure from distinguishing account existence.
- Checked the route variants independently with an alternating sequence of known and unknown synthetic addresses. Requests 1–5 returned HTTP 200 with `{"sent":true}`; request 6 returned HTTP 429 and `Retry-After: 60`.
- Sent eight mixed known/unknown address requests concurrently from one synthetic IP in a separate local window. Exactly five returned HTTP 200 with `{"sent":true}` and three returned HTTP 429. This exercises the local limiter's concurrent boundary; it does not override Cloudflare's documented eventual-consistency limitation in production.
- Invalid address syntax remains rejected with HTTP 400 by request validation; that behavior is independent of account existence. Missing room and unregistered account responses remain generic success-shaped responses.
- The failed-delivery path created zero auth tokens before and after the change because local Resend configuration is absent. No email was sent.

## Timing variant

**PLAUSIBLE HYPOTHESIS (local only):** after the response fix, I measured 40 randomized requests for a registered synthetic email and 40 for an unregistered one against local Wrangler. Each request used a distinct synthetic source IP so the per-IP cap did not censor the sample. Full client-observed round-trip p50 was 14.61 ms for the registered address and 11.81 ms for the unknown address; p90 was 16.84 ms and 13.13 ms respectively. Unknown-address samples included a 63.92 ms outlier. The registered branch performs additional D1 work and reaches the configured-email failure path, which is consistent with the median difference, but local timing is noisy and does not prove a usable remote classifier. Production email delivery was not configured or called. No timing-equalization change was made because a local difference alone does not establish an exploitable production signal, and an artificial delay could add latency without reliably hiding provider-dependent timing.

## Reproduction

With a local Wrangler server on port 8791, a synthetic account/room fixture, and one synthetic IP, the post-fix boundary probe was:

```sh
node --input-type=module -e 'for (let i=1;i<=6;i++){const email=i%2?"wrong@example.invalid":"r6-owner@example.invalid";const r=await fetch("http://127.0.0.1:8791/api/rooms/r6-fixture-room/creator-access",{method:"POST",headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.77"},body:JSON.stringify({email})});console.log(i,r.status,r.headers.get("retry-after"),await r.text())}'
```

Observed output was five `200 null {"sent":true}` responses followed by `429 60 {"error":"too many requests; try again shortly"}`. The synthetic rooms and accounts used in the sequential, timing, and concurrent probes were deleted afterward; local D1 queries verified their counts were zero. Wrangler was stopped.

## Limits and status

`npm run typecheck` and `git diff --check` passed. This is a local induction of Worker behavior, not proof of production Cloudflare behavior. Native limiter counters are location-local and eventually consistent; callers with multiple IPs or locations can exceed the effective limit. A shared NAT can also cause legitimate creators to share the cap. The generic response avoids a direct email-existence signal but hides email delivery failures from the caller. Real delivery, logging/monitoring, browser behavior, and deployment remain unverified.

**Disposition:** The HTTP status/body account-existence oracle is fixed and locally rechecked. Round 6 remains partial until deployed behavior, failure observability, response-timing variants under realistic network/provider conditions, and distributed-IP variants are reviewed.
