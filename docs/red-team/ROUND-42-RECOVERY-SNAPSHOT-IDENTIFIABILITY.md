# Red-team Round 42 — recovery snapshot identifiability

**State:** documentation overclaimed anonymization; corrected. On October 24, 2026, the learner clarified that the hackathon submission does not promise anonymity. The existing recovery fields remain; this answer does not establish that they are anonymous or remove residual identifiability risks.
**Date:** 2026-10-23.
**Threat model:** room creator or an infrastructure operator can access a recovery snapshot; an unauthorized attendee may retain old room identifiers and attempt to correlate retained details with public room information. No claim is made that the operator or provider infrastructure was accessed.
**Scope:** trace the allowlisted recovery fields from the delete handler through D1 trash retention and recovery into the creator-only room snapshot; compare those fields with user-facing anonymity claims. No production database or provider was accessed.

## R42-01 — “anonymized” overstated what the retained summary proves

**Invariant:** removing direct participant names and chat does not establish that the remaining data cannot identify an event, person, or linked room. Documentation must describe the retained fields and avoid an anonymity claim that was never tested.

**CODE FACT:** when a creator deletes a closed or reopened room, the Worker writes a separate `recovery_snapshot_json` containing:

- the fixed title `Recovered room`;
- every candidate's user-provided title, weekday, start/end times, price and currency;
- an optional `nextMeetingCode` validated against a different active room;
- registered participant count and an optional creator-entered attendance count.

Candidate area is set to `null`; participants, chat, claims/proposals, events, room sessions, and attendee names are removed from their normal tables during trash. While the room is trashed, the snapshot is not served through public room GET. On successful one-time recovery, the Worker copies its allowlisted fields into the recovered snapshot, checks whether the linked next room remains active, and clears `recovery_snapshot_json`; the recovered room GET requires the owning creator session.

**CONFIRMED BY INDUCTION (synthetic Worker storage adapter, Round 10):** the recovered snapshot retained a synthetic candidate title and registration count while omitting the original event title, attendee names, private note, and candidate area. This confirms selected filtering behavior in that harness, not anonymity or every D1 field. **CODE FACT / prior authorization induction (Round 5):** a pre-fix anonymous recovered-room read exposed the `nextMeetingCode`; that route was fixed to require the owner session. It remains a deliberately retained field visible to the creator after recovery.

The existing code does not test re-identification against outside context. Candidate titles can contain identifying information; small group counts may enable inference; and a next-room meeting number can connect two event records. Those are plausible privacy risks, not demonstrated re-identification attacks. The word “anonymized” in current descriptions therefore went beyond the evidence.

## Correction

No data-retention behavior changed. README, Spanish README, Technical README, privacy map, and Devpost draft/spec call it a limited recovery snapshot, enumerate retained categories, and say it is not guaranteed anonymous. The learner later answered: “Que para hackathon no se promete anonimato.” This resolves the hackathon's disclosure policy; it does not establish that the remaining fields are anonymous. No fields were removed.

## Verification and limits

The route and SQL were reviewed in `src/worker.ts` (`changeRoomLifecycle`, `consumeCreatorLink`). Round 10 provides synthetic-storage recovery filtering evidence; Round 5 documents the earlier next-room-code exposure and owner-only fix. Rechecked `npm test -- src/worker-room-recovery.test.ts` (7 passed) and `npx vitest run --config vitest.d1.config.mjs --reporter dot` (26 passed) on 2026-10-23. These tests verify lifecycle behavior in synthetic storage/local D1; they do not perform a re-identification attempt. This round did not use real identities, attempt linkage against external datasets, inspect deployed D1/backup/log copies, or test provider retention. The seven-day scheduled purge applies to application D1 rows; it does not prove deletion from backups, logs, email systems, browser copies, or providers.

**Disposition:** the inaccurate anonymity claim is corrected, and the learner confirmed that the hackathon does not promise anonymity. Residual identifiability is not eliminated or quantified. The current allowlist remains; this is a disclosure decision, not an anonymization result.
