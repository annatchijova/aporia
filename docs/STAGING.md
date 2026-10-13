# Cloudflare staging

Staging is an isolated copy of APORIA for private product checks. It is separate from the production configuration and has no production data or third-party credentials.

## Current state — 2026-10-12

- Cloudflare D1 database `aporia-staging` was created in the account and migrations `0001` through `0005` were applied remotely.
- Worker `aporia-staging` and the built static assets were uploaded.
- Staging has its own D1 binding and rate-limit namespaces in `wrangler.json`.
- `workers_dev` is disabled, so the Worker has no public URL or route. Wrangler reports “No targets deployed”.
- The staging cron is empty until the account has a `workers.dev` subdomain. Expired-room cleanup therefore does not run in staging yet.
- No Gemini or Resend secrets were configured in Cloudflare. Local `.env` values are not part of this deployment.
- The deployment token has no Access-management scope. Access must be enabled from the Cloudflare dashboard.

## Enable private access

1. In Cloudflare, open **Workers & Pages** to initialize the account's `workers.dev` subdomain.
2. Open the `aporia-staging` Worker and enable **Protect this Worker behind Access**. Require sign-in for the owner's email address. Complete Zero Trust setup if Cloudflare prompts for it.
3. After confirming the Access policy is active, enable the Worker’s `workers.dev` URL under **Settings → Domains & Routes**.
4. Once the private URL works, restore the staging hourly cleanup cron in the staging environment and deploy again. Keep the production D1 binding untouched.

Do not enable the `workers.dev` URL before Access is active. Staging is for synthetic data and internal checks; it is not the public hackathon demo.

## Local checks

```sh
npm run build
npx wrangler deploy --dry-run --env staging
```

Apply schema changes to staging with:

```sh
npx wrangler d1 migrations apply aporia-staging --remote --env staging
```
