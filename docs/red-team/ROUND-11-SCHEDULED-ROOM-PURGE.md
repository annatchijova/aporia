# Red team Round 11 — scheduled room purge

**State:** The D1 foreign-key failure was reproduced locally, fixed, and rechecked through the actual Worker scheduled handler against Wrangler's local D1. This is a data-retention/reliability defect, not an authorization bypass.
**Date:** 2026-10-14.
**Before-fix revision:** `f895dbb` (`docs: record recovery expiry variants`).
**Fixed revision:** `fc01a98` (`fix: purge expired rooms with dependent data`).
**Threat model:** The system's own scheduled event permanently purges rooms whose seven-day recovery window has elapsed. No attacker capability is required. The relevant guarantee is that expired room data is removed, while a room still inside its recovery window remains intact.
**Scope:** D1 foreign-key behavior for the scheduled purge, dependency deletion order, and selection of expired versus unexpired rooms. No production database, external provider, Gemini, or customer data was used.

## Prediction before induction

With an expired `trashed` room that still has participants and child rows, the old purge's parent deletion should fail because the migrations declare foreign keys without `ON DELETE CASCADE`. The old two-statement batch should preserve the room and its children on failure. After the fix, the scheduled handler should delete the expired room and its dependent rows in order. A second `trashed` room with a future recovery deadline should remain unchanged.

## R11-01 — parent room blocked by retained child rows

**CODE FACT:** Before the fix, `purgeExpiredRooms()` selected expired rooms, then batched deletion of recovery tokens followed immediately by deletion of the room. The schema has foreign keys from participants, sessions, events, proposals, candidates, candidate proposals, messages, and creator-auth tokens to their parent rows; proposal claim decisions also reference proposals. These constraints do not declare `ON DELETE CASCADE`.

**CONFIRMED BY INDUCTION (local D1):** A synthetic expired room was seeded with a participant, session, event, proposal and claim decision, candidate, candidate proposal, message, creator account/session, and recovery token. Executing the old two-statement deletion sequence returned `SQLITE_CONSTRAINT_FOREIGNKEY`. A subsequent query showed the room and its recovery token, participant, message, and proposal still present. This probe exercised the old SQL against local D1; it did not run the pre-fix Worker scheduled handler.

**Fix:** The scheduled handler now deletes messages and proposal decisions before their parents, then candidates/events/sessions/participants/tokens, and finally the room. Every child deletion rechecks that the parent is still `trashed` and expired; the same cutoff timestamp is used throughout the per-room batch. This keeps a room that no longer qualifies from having its child rows removed.

**CONFIRMED BY INDUCTION (Worker scheduled handler + local D1):** After the fix, Wrangler's local Worker test-scheduled endpoint returned HTTP 200. The expired fixture room was absent afterward. A second fixture with a 2099 recovery deadline remained `trashed` with its participant, session, and message intact. All data was synthetic and stored under `/tmp/aporia-round11-d1`.

## Reproduction

The committed seed file is [ROUND-11-PURGE-SEED.sql](fixtures/ROUND-11-PURGE-SEED.sql). Use a fresh temporary persistence directory for each run:

```sh
CI=1 npx wrangler d1 migrations apply aporia --local --persist-to /tmp/aporia-round11-repro --env-file /dev/null
npx wrangler d1 execute aporia --local --persist-to /tmp/aporia-round11-repro --env-file /dev/null --file docs/red-team/fixtures/ROUND-11-PURGE-SEED.sql --yes
node --input-type=module -e 'import { unstable_dev } from "wrangler"; const worker=await unstable_dev("src/worker.ts",{config:"wrangler.json",local:true,persist:true,persistTo:"/tmp/aporia-round11-repro",envFiles:["/dev/null"],experimental:{testScheduled:true,disableExperimentalWarning:true}}); try { const response=await worker.fetch("/__scheduled?cron=0+*+*+*+*",{method:"GET"}); console.log(JSON.stringify({status:response.status,body:await response.text()})); } finally { await worker.stop(); }'
npx wrangler d1 execute aporia --local --persist-to /tmp/aporia-round11-repro --env-file /dev/null --command "SELECT id, status, (SELECT COUNT(*) FROM participants p WHERE p.room_id = rooms.id) AS participants, (SELECT COUNT(*) FROM sessions s WHERE s.room_id = rooms.id) AS sessions, (SELECT COUNT(*) FROM room_messages m WHERE m.room_id = rooms.id) AS messages FROM rooms WHERE id IN ('r11-purge-fixture', 'r11-not-expired') ORDER BY id;" --json
```

Expected: the query returns only `r11-not-expired`, with one participant, session, and message. The expired room is permanently removed.

## Verification and limits

- `npm test`: 33 passed across 9 files.
- `npm run build`: TypeScript check and Vite production build passed.
- `git diff --check`: passed.
- Wrangler local D1 migrations 0001–0005 applied to the isolated test store.
- No live provider calls or production database access occurred.
- This demonstrates the local Wrangler/D1 behavior and the actual Worker scheduled handler. It does not establish production Cloudflare scheduling, a race between a concurrent recovery and purge, or provider/platform backup deletion semantics.
