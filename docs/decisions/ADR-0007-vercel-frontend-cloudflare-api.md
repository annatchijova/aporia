# ADR-0007 — Host the new APORIA frontend on Vercel and keep its API on Cloudflare

**Date:** 2026-10-14
**Status:** accepted as the deployment direction; public deployment not yet verified
**Reversibility:** two-way; the Vite frontend can be moved without migrating the API database.

## Forces at the time

- The previous APORIA beta is hosted on Webflow; the user wants this new version to be hosted on Vercel.
- The current repository builds a Vite/React SPA and already implements its API in `src/worker.ts`.
- The Worker owns D1 access and server-side Gemini/email credentials. No request has been made to replace that backend.
- The frontend already accepts `VITE_APORIA_API_ORIGIN`; the Worker already supports an explicit allowed-origin list.
- Public hosting, custom domain, deployment credentials, cost ceiling, and production secrets have not been verified in this repository session.

## Decision

Deploy the static Vite frontend on Vercel. Keep the API, D1 database, scheduled cleanup, and server-side provider credentials on the existing Cloudflare Worker. Configure `VITE_APORIA_API_ORIGIN` at frontend build time to the selected Worker API origin, and configure that exact frontend origin in the Worker’s `APORIA_ALLOWED_ORIGINS`. Keep the Webflow beta separate.

This record captures the user's stated hosting direction and the architecture already supported by the code. It does not claim a Vercel project or public deployment exists.

## Alternatives considered

- **Keep the previous Webflow deployment:** not selected because the user identified the previous version as a beta and wants this version on Vercel. Best argument: it may reuse an existing deployment setup.
- **Host the SPA and API together on Cloudflare:** not selected because the requested direction is Vercel for this version and the API is already implemented as a Worker. Best argument: same-origin hosting could remove CORS configuration.
- **Move the API to Vercel functions:** not selected because that would replace a working Worker/D1 backend and require a separate migration of persistence, schedules, and server-side secrets. Best argument: one provider could simplify deployment management.

## Assumption this rests on

The selected Vercel project can serve the Vite SPA and provide the API origin as a build-time environment variable, while the existing Worker remains publicly reachable and accepts the exact Vercel origin. Verify both during deployment; do not assume preview deployments are allowed by production CORS.

## Consequences

- The browser talks directly to the Cloudflare Worker API from the Vercel origin, so CORS must allow the exact production origin.
- `VITE_APORIA_API_ORIGIN` is public bundle configuration, not a secret. Provider credentials stay in Worker secrets.
- Vercel previews may need a separate test configuration or an explicit temporary origin; avoid enabling a broad `*.vercel.app` rule in production without a deliberate review.
- Deployment settings, current provider pricing/limits, custom domain, and secret provisioning remain unverified and will be checked when preparing the deployment.

## Revisit trigger

Reopen this ADR if Vercel cannot serve the SPA with the required API-origin setting, if cross-origin deployment creates an unacceptable operational burden, or if the user chooses to consolidate hosting. Before launch, verify the Vercel build/output settings, the exact production origin, Worker reachability, CORS, and a complete room-flow smoke test.

## Anchored at

- Frontend API origin: `src/client/App.tsx` (`apiBase`).
- Worker CORS allowlist: `src/worker.ts` (`isAllowedOrigin` and `corsResponse`).
- Existing self-hosting and separate-origin notes: `README.md`, “Privacy and hosting”.
