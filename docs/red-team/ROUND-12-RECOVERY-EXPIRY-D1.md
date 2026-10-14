# Red team Round 12 — recovery expiry against local D1

**State:** Both expiry gates were exercised through the actual Worker handlers with Wrangler's local D1. No defect was confirmed.
**Date:** 2026-10-14.
**Code revision:** `5b02c61` (`docs: record scheduled purge D1 finding`).
**Threat model:** A caller submits a recovery token. The token may have expired, or its room's seven-day recovery window may have expired first. The caller cannot change Worker code or database rows.
**Scope:** Token expiration check, room recovery-window check, and persisted state after each rejection. Tokens and rooms were synthetic. No email provider, Gemini, production database, or production Worker was used.

## Prediction before induction

A token whose `expires_at` is in the past must return HTTP 400 before room recovery. A token whose own expiry is in the future but whose room has `recovery_until` in the past must return HTTP 410. Both rejected requests should leave the room in `trashed`, leave the token unused and recovery snapshot intact, and create no creator session.

## R12-01 — expired token and expired room window

**CONFIRMED BY INDUCTION (actual Worker handlers + local D1):** The expired token returned `400 {"error":"invalid or expired link"}`. The unexpired token for a room past its recovery deadline returned `410 {"error":"recovery period has expired"}`. A follow-up D1 query showed both rooms still `trashed`, one unused token per room, recovery snapshots present, and zero creator sessions for the fixture account.

No email message was sent: the synthetic tokens were inserted directly into the isolated D1 database. The Worker was started with `envFiles: ["/dev/null"]` and local-only bindings.

## Reproduction

Run from the repository root with Wrangler installed. The D1 persistence directory must be fresh:

```sh
CI=1 npx wrangler d1 migrations apply aporia --local --persist-to /tmp/aporia-round12-repro --env-file /dev/null
npx wrangler d1 execute aporia --local --persist-to /tmp/aporia-round12-repro --env-file /dev/null --file docs/red-team/fixtures/ROUND-12-RECOVERY-EXPIRY.sql --yes
node --input-type=module -e 'import { unstable_dev } from "wrangler"; const worker=await unstable_dev("src/worker.ts",{config:"wrangler.json",local:true,persist:true,persistTo:"/tmp/aporia-round12-repro",envFiles:["/dev/null"],experimental:{disableExperimentalWarning:true}}); try { for (const token of ["synthetic-r12-expired-token-string-at-least-40-bytes","synthetic-r12-window-expired-token-string-at-least-40-bytes"]) { const response=await worker.fetch("/api/creator-links/consume",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token})}); console.log(JSON.stringify({status:response.status,body:await response.json()})); } } finally { await worker.stop(); }'
npx wrangler d1 execute aporia --local --persist-to /tmp/aporia-round12-repro --env-file /dev/null --command "SELECT r.id, r.status, (SELECT COUNT(*) FROM creator_auth_tokens t WHERE t.room_id = r.id AND t.used_at IS NULL) AS unused_tokens, (SELECT COUNT(*) FROM creator_sessions s WHERE s.account_id = r.creator_account_id) AS creator_sessions, r.recovery_snapshot_json IS NOT NULL AS recovery_retained FROM rooms r WHERE r.id IN ('r12-expired-token', 'r12-expired-window') ORDER BY r.id;" --json
```

Expected handler statuses are 400 and 410. The final query should show two trashed rooms, one unused token per room, zero creator sessions, and `recovery_retained: 1` for both.

## Limits

This demonstrates local Worker/D1 behavior for timestamps clearly before or after the deadline. It does not check equality at the exact clock boundary, concurrent redemption, production clock behavior, or real email delivery. Round 10's successful email-backed lifecycle journey still uses synthetic storage; Round 11 separately exercised the scheduled purge against local D1.
