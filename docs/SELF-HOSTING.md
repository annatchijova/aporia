# Self-hosting APORIA

This guide describes how to create an independent APORIA deployment from this repository. It is a configuration guide based on the current source and `wrangler.json`; it is **not** evidence that a fresh account deployment has been completed or validated. The repository's `staging` environment points to the maintainer's Cloudflare D1 database. Do not deploy that environment or reuse its database ID.

## Recommended: one Cloudflare Worker for the app and API

The current Worker configuration serves the built Vite app from `dist` and exposes the API from the same origin. This avoids a separate frontend origin and CORS setup.

1. Fork or clone the repository and install its locked dependencies:

   ```sh
   git clone https://github.com/<your-account>/aporia.git
   cd aporia
   npm ci
   npx wrangler login
   ```

2. Create a D1 database in your own Cloudflare account:

   ```sh
   npx wrangler d1 create aporia-<your-name>
   ```

   Put the returned database name and ID into the **top-level** `d1_databases` entry in `wrangler.json`, keeping the binding name `DB` and `migrations_dir` set to `migrations`. Replace the Worker `name` with a name available in your account. Do not copy the maintainer's `staging` database ID.

3. Give each of the six top-level rate-limit bindings a positive integer `namespace_id` unique within your Cloudflare account. The IDs in this repository are examples for the maintainer's account; Cloudflare shares counters between bindings that reuse a namespace ID. Keep each binding's existing `name` and limit settings. Review [Cloudflare's rate-limit scope and behavior](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

4. Apply the schema to your remote database:

   ```sh
   npx wrangler d1 migrations apply aporia-<your-name> --remote
   ```

   Review the migration output and confirm it targets your database. D1's [getting-started guide](https://developers.cloudflare.com/d1/get-started/) and [Wrangler commands](https://developers.cloudflare.com/d1/wrangler-commands/) document database creation and migrations.

5. Add your Gemini key as a Worker secret; never put it in client-side `VITE_*` variables or commit it:

   ```sh
   npx wrangler secret put GEMINI_API_KEY
   ```

   The configured Google project, model, quota, tier, pricing, and data terms are your responsibility. APORIA's per-participant burst limits are not a global quota or spend ceiling. Check Google's current [Gemini API key guidance](https://ai.google.dev/gemini-api/docs/api-key), [pricing](https://ai.google.dev/gemini-api/docs/pricing), and [terms](https://ai.google.dev/gemini-api/terms). A free tier is not a promise of zero cost or suitable data handling.

6. If you want creator login and recovery links by email, configure these Worker values in Cloudflare: `RESEND_API_KEY` as a secret, plus `CREATOR_EMAIL_FROM` and `APORIA_APP_ORIGIN` as variables. The origin must be the public origin where this deployment serves the app. Without these values, creator email flows are unavailable. Follow Resend's current account, sender-verification, pricing, and data terms.

7. Build and deploy the default environment after reviewing the config and secrets:

   ```sh
   npm run build
   npx wrangler deploy
   ```

   Wrangler publishes the Worker and configured static assets together; see [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/). The generated `dist` directory is the frontend. Your resulting `workers.dev` or custom-domain origin is an independent deployment. Check your Cloudflare plan, current usage, and billing settings before making it public.

## Optional: frontend on Vercel, API on your Worker

Use this only if you want a separate Vercel frontend. First deploy your own Worker and database using the steps above. Then import the repository as a Vite project in Vercel and set the build-time variable:

```text
VITE_APORIA_API_ORIGIN=https://<your-worker-origin>
```

Set the Worker variable `APORIA_ALLOWED_ORIGINS` to the exact production Vercel origin, for example `https://<your-project>.vercel.app` (no path or trailing slash). Do not enable a broad preview wildcard unless you have intentionally reviewed the access it grants. CORS controls browser access; it is not API authentication. Keep Gemini and email credentials only on the Worker. See Vercel's [Vite deployment guide](https://vercel.com/docs/frameworks/frontend/vite) and [environment-variable guide](https://vercel.com/docs/environment-variables).

## Before sharing your instance

- Complete the room lifecycle and email flow with synthetic data on your own deployment; this guide has not been verified against a newly provisioned account.
- Read [APORIA's data-flow and provider policy](PRIVACY-DATA-FLOW.md). Room links and meeting numbers are public access paths; do not promise anonymity.
- Confirm the Gemini API tier and terms, email sender setup, Cloudflare limits, and billing alerts yourself. The app does not enforce a shared provider budget.
- Your deployment has its own rooms, database, credentials, retention, and operator. Cloning the repository does not grant access to APORIA's official instance, database, or provider keys.

Official references were checked on October 24, 2026. Provider plans, prices, quotas, product behavior, and terms can change; re-check them when deploying.
