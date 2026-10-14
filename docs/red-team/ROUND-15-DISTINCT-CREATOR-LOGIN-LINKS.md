# Red-team Round 15 — distinct valid creator login links

**State:** Both distinct links were accepted once against local Wrangler D1; no defect confirmed.
**Date:** 2026-10-14.
**Code revision:** `2d04b0c` (`docs: record creator login race induction`).
**Threat model:** The same creator requests separate login links at different times; both links remain valid and are redeemed concurrently.
**Scope:** Independent token consumption, creator-account uniqueness, room ownership linking, and session creation. All rows and tokens were synthetic. No email, provider, production database, or deployed Worker was used.

## Prediction before induction

Each distinct, valid, unused login token is individually single-use. If both are valid and consumed, both may create a session for the same creator account; there is no current product rule requiring a single active creator session.

## R15-01 — two valid links used concurrently

**CONFIRMED BY INDUCTION (actual Worker handlers + local Wrangler D1):** Two concurrent requests with different, unexpired login tokens for the same room and email both returned HTTP 200 with a creator token. Follow-up SQL showed one creator account, two consumed tokens, and two creator sessions associated with the room's creator account.

This is consistent with the current data model: `creator_sessions` permits multiple sessions per account, and each link is independently single-use. The observation does not establish whether APORIA should later add a one-session-per-creator policy; that product policy is undecided. No code changed.

## Reproduction

Use a fresh local D1 store with migrations applied and seed [the synthetic fixture](fixtures/ROUND-15-DISTINCT-CREATOR-LOGIN-LINKS.sql). The two raw tokens are:

```text
synthetic-r15-login-token-one-20261014-unique
synthetic-r15-login-token-two-20261014-unique
```

Then start `src/worker.ts` with Wrangler `unstable_dev`, `persistTo` set to that D1 store, and `envFiles: ["/dev/null"]`. Submit both tokens concurrently to `/api/creator-links/consume`. The expected result for the current policy is two HTTP 200 responses. Query the room, account, consumed-token, and session counts; expected counts are one account, two consumed tokens, and two sessions.

## Limits

This validates local D1 behavior for two valid links. It does not determine whether multiple sessions are the desired product policy, test real email issuance/cooldown timing, or establish production behavior. Each token's replay protection was separately exercised in Round 14.
