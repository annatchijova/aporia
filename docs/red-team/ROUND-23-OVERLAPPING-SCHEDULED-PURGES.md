# Red-team Round 23 — overlapping scheduled purges

**State:** The forced overlap completed without duplicate effects, partial deletion, or a Worker error; no defect was confirmed in this ordering.
**Date:** 2026-10-16.
**Threat model:** Two invocations of the scheduled Worker run concurrently and both select the same room after its recovery deadline. They share the same D1 database; neither invocation is malicious and neither can change Worker code.
**Scope:** Expired room selection, dependent-row deletion order, parent deletion, and creator account/session cleanup. Actual Worker `scheduled` handler with isolated local Wrangler D1; synthetic expired room and children.

## Prediction before induction

The scheduled handler selects eligible rooms before iterating through per-room cleanup batches. If two invocations select the same ID before either deletes it, both will attempt each cleanup statement. I predicted the predicates on dependent deletes would make the second batch harmless after the first removes the parent, and that both runs would complete without leaving a partially deleted room or orphaned child rows.

## R23-01 — both scheduled invocations select the same room

The harness seeded an expired trashed room, creator account, creator session, recovery token, participant, room session, event, proposal and claim decision, candidate, candidate proposal, and chat message. A D1 wrapper allowed both actual Worker scheduled handlers to finish their expired-room `SELECT` before either proceeded to its deletion batch.

**CONFIRMED BY INDUCTION (actual Worker + local Wrangler D1):** Both queries selected the same synthetic room. Both scheduled invocations resolved successfully. Follow-up D1 reads found no room, participant, room session, event, proposal, claim decision, candidate, candidate proposal, message, creator token, creator session, or creator account. The second per-room batch became a no-op against the room-state predicates after the first invocation deleted the parent.

**Disposition:** This specific purge-versus-purge overlap is idempotent in the local D1 configuration. No production code changed. Recovery-versus-purge and exact deadline arbitration are separate orderings covered by R17/R18; deployed Cloudflare scheduling remains unverified.

## Verification and limits

`npx vitest run --config vitest.d1.config.mjs --reporter verbose` passes five tests, including this forced scheduled overlap. `npm test` passes 37 tests across 9 files, `npm run build` passes TypeScript checking and Vite bundling, and `git diff --check` passes.

The local test uses a minimal synthetic schema and forces both handlers to select before releasing either. It does not replay every migration or establish deployed scheduler concurrency, production D1 behavior, or workerd execution.

See [Round 11](ROUND-11-SCHEDULED-ROOM-PURGE.md), [Round 18](ROUND-18-RECOVERY-EXACT-DEADLINE.md), the [round plan](APORIA-ROUND-PLAN.md), and the [local D1 harness](../../scripts/red-team/round19-20-lifecycle-races-d1.mjs).
