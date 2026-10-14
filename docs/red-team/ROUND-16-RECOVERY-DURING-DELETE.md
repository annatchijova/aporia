# Red-team Round 16 — opening a recovery link while deletion is finishing

**State:** Transient recovery-link race reproduced; token and room data remain recoverable. User-facing error corrected.
**Date:** 2026-10-14.
**Pre-fix revision:** `2e87eb9` (`docs: record distinct creator link concurrency`).
**Threat model:** A creator opens the recovery email as soon as it arrives, while the delete request is still waiting for the email provider and has not committed the room's move to trash.
**Scope:** Recovery-token insertion, the room-status gate, token consumption, deletion completion, retry behavior, and the corresponding client error copy. All data and email-provider responses were synthetic. No real email, provider, production database, or deployed Worker was used.

## Prediction before induction

If a recovery token is opened while its room is still `closed`, the request should fail without consuming the token. After deletion changes the room to `trashed`, the same token should still recover it. The client should not tell the creator that the link definitely expired or was already used when this transient state occurs.

## R16-01 — early open during email delivery

**CONFIRMED BY INDUCTION (actual Worker handlers with synthetic storage/provider):** The test intercepts the outbound email request after `sendCreatorLink` stores its token, and synchronously opens that token before the delete handler commits the room transition. The early consume returns HTTP 410. The delete then completes and leaves the room in `trashed`; the token remains unused. Retrying the same token returns HTTP 200 and creates one creator session.

**CONFIRMED BY INDUCTION (actual Worker handlers + local Wrangler D1, staged transition):** A synthetic `recover` token for a `closed` room returned 410 and stayed unused. After changing the fixture room to `trashed` with a future recovery deadline and a recovery snapshot, the actual Worker accepted the same token and returned 200. The transition was applied directly in local D1 to isolate the two handler states; this did not send email or run the delete endpoint against D1.

This is a narrow ordering window caused by sending the recovery email before the delete batch. It does not permanently invalidate the token or lose the recovery snapshot. Before the copy change, the client catch handler said the link had expired or was used. It now tells the creator the room may still be finishing deletion, asks them to refresh in a few seconds, and suggests requesting another link if the issue persists. No backend state or transaction changed.

## Test integrity

- **Oracle:** invariant — early failure leaves the token unused; after deletion commits, the same token succeeds and only one creator session exists.
- **Negative control:** Temporarily marking the recovery token used before checking room state made the test fail at its unused-token assertion. The mutation was reverted.
- **Mocks:** The exact delete-email-consume interleaving uses the existing synthetic D1 adapter and an intercepted email request. Actual local D1 independently verified the Worker handler's pre-trash rejection and post-trash success.
- **Limit:** This does not measure how often the delivery/click window occurs in production, exercise an actual mail client or provider, or verify Cloudflare's deployed Worker. The user sees a recoverable failure and can refresh; no automatic retry was added.

## Reproduction data

The committed [fixture](fixtures/ROUND-16-RECOVERY-DURING-DELETE.sql) contains a synthetic creator account, closed room, and unexpired recovery token. The raw token is `synthetic-r16-delete-recovery-token-20261014`; its SHA-256 is stored in the fixture.

The exact reentrant timing case is covered by `leaves a recovery link usable if it is opened before deletion commits` in `src/worker-room-recovery.test.ts`. The test invokes the actual delete and recovery handlers with synthetic storage and an intercepted outbound email request.

## Verification

`npm test` passed 35 tests across 9 files; `npm run build` and `git diff --check` passed. No production backend, email provider, or Gemini call was used.
