# Red-team Round 14 — creator login-link replay race

**State:** Same-token concurrent replay was falsified against local Wrangler D1; no defect confirmed.
**Date:** 2026-10-14.
**Code revision:** `c707e10` (`fix: prevent duplicate sessions in recovery races`).
**Threat model:** A caller submits one valid creator login link repeatedly in parallel, including after all requests have passed the initial token read.
**Scope:** Login token consumption, creator-account creation, room ownership linking, and session insertion. All rows and token material were synthetic. No email, provider, production database, or deployed Worker was used.

## Prediction before induction

One login token is single-use. At most one concurrent request should return 200; all others should fail, and D1 should contain one consumed token, one creator account for the synthetic email, and one creator session.

## R14-01 — repeated consumption of the same login token

**FALSIFIED (actual Worker handlers + local Wrangler D1):** 32 simultaneous requests to `/api/creator-links/consume` returned one HTTP 200 and 31 HTTP 409 responses. Follow-up SQL showed the token consumed, the room linked to one creator account, exactly one account for the synthetic email, and exactly one creator session for that room's account.

This result is consistent with the login path's conditional `used_at IS NULL` token update and its check that the update changed exactly one row before it continues to link the room and create a session. No code change was made.

## Reproduction

Use a fresh local D1 store with migrations applied, then seed [the synthetic fixture](fixtures/ROUND-14-CREATOR-LOGIN-RACE.sql). The raw token is `synthetic-r14-creator-login-token-20261014-single` and its SHA-256 is stored in the fixture.

```sh
npx wrangler d1 migrations apply aporia --local --persist-to /tmp/aporia-round14-repro --env-file /dev/null
npx wrangler d1 execute aporia --local --persist-to /tmp/aporia-round14-repro --env-file /dev/null --file docs/red-team/fixtures/ROUND-14-CREATOR-LOGIN-RACE.sql --yes
node --input-type=module -e 'import { unstable_dev } from "wrangler"; const token="synthetic-r14-creator-login-token-20261014-single"; const worker=await unstable_dev("src/worker.ts",{config:"wrangler.json",local:true,persist:true,persistTo:"/tmp/aporia-round14-repro",envFiles:["/dev/null"],experimental:{disableExperimentalWarning:true}}); try { const results=await Promise.all(Array.from({length:32},async()=>{const response=await worker.fetch("/api/creator-links/consume",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token})}); return response.status;})); console.log(JSON.stringify({success:results.filter(status=>status===200).length,conflict:results.filter(status=>status===409).length})); } finally { await worker.stop(); }'
npx wrangler d1 execute aporia --local --persist-to /tmp/aporia-round14-repro --env-file /dev/null --command "SELECT r.id, r.creator_account_id, t.used_at, (SELECT COUNT(*) FROM creator_accounts a WHERE a.email='r14-synthetic@example.invalid') AS account_count, (SELECT COUNT(*) FROM creator_sessions s WHERE s.account_id=r.creator_account_id) AS session_count FROM rooms r JOIN creator_auth_tokens t ON t.room_id=r.id WHERE r.id='r14-login-room';"
```

Expected counts: one 200, 31 conflicts, one account, and one session. D1 generates the creator account UUID, so the final query scopes the session count through the room's linked account.

## Limits and next variants

This checks repeated use of one token in the installed local Wrangler/D1 path. Two separately issued, still-valid login links for the same room are covered in [Round 15](ROUND-15-DISTINCT-CREATOR-LOGIN-LINKS.md). Concurrent room deletion, expiry equality, and Cloudflare's deployed Worker remain separate candidates; no result here establishes their behavior.
