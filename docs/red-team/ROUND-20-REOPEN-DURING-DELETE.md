# Red-team Round 20 — reopen while deletion email is pending

**State:** The forced ordering completed without a partial database state; no defect was confirmed under the current lifecycle policy. It exposed a cross-tab user-experience ambiguity.
**Date:** 2026-10-16.
**Threat model:** The room owner starts deletion, then reopens the same closed room from another tab while the deletion request waits for the email provider.
**Scope:** `closed → reopened_read_only → trashed`, the delayed recovery-email boundary, cleanup conditions, and resulting recovery snapshot. Actual Worker handlers with isolated local Wrangler D1; synthetic room/account and mocked email only.

## Prediction before induction

Deletion reads the closed-room snapshot before awaiting email delivery. Reopen can commit during that network wait. I predicted the later delete batch might either leave a partial state or apply stale data after reopen. The live delete predicate accepts both `closed` and `reopened_read_only`, so the database can also serialize the two successful actions as a valid reopen followed by delete.

## R20-01 — reopen commits before delayed delete

The integration harness starts a delete request and blocks its mocked email-provider response after the token insert. It then invokes the actual reopen handler and waits for it to commit before releasing the email response.

**CONFIRMED BY INDUCTION:** Reopen returned HTTP 200 and D1 showed `reopened_read_only` while the email call was paused. After release, delete returned HTTP 200. D1 ended `trashed` with one recovery token and a recovery snapshot containing the expected synthetic summary. The fixture had no child rows, so this probe does not establish their cleanup behavior.

**Disposition:** This is the valid sequential transition `closed → reopened_read_only → trashed`, serialized by the D1 writes. Both operations come from the same authorized creator. No security or data-integrity defect was confirmed. The first request began earlier but commits its room transition after the provider wait, so a second tab can show a successful reopen before the earlier deletion finishes.

**Product decision (October 24, 2026):** the learner confirmed that deletion should complete. This behavior is the desired policy for the hackathon; no code change is needed for that decision.

## Product boundary

The creator UI renders reopen and delete controls together for a closed room and does not mark either request as busy. The backend therefore permits this cross-tab sequence. The learner has chosen that deletion still completes if a reopen occurs while the recovery-email delivery is pending. This resolves the product-policy question; it does not add a busy indicator or cancel the already-started deletion.

## Verification and limits

`npx vitest run --config vitest.d1.config.mjs` passed both Round 19's cooldown race and this controlled ordering against the actual Worker handlers and local Wrangler D1. An attempt to pause the opposite ordering at the D1 batch boundary timed out before the wrapper observed that call; I removed that harness branch and draw no conclusion from it. The local schema is minimal and synthetic; no full migration replay, browser, provider inbox, production database, or deployed Worker was used. No reverse ordering was induced in this round.

See the [round plan](APORIA-ROUND-PLAN.md).
