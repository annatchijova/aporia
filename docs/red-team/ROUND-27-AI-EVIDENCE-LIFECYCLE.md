# Round 27 — AI evidence across close and reopen

**Later disposition (Round 39, 2026-10-23):** New contribution artifact text and reviewed claim snippets are redacted as documented in [Round 39](ROUND-39-SOURCE-RETENTION.md). This supersedes the retention behavior observed in this historical trace for new submissions. Existing database rows were not migrated; the deployed database was not inspected.

**Status:** Integrated lifecycle behavior reproduced; no code defect confirmed. Evidence-retention policy remains open.
**Threat model:** A room participant submits human text, reviews the extracted claim, and an authenticated creator closes or reopens the room. The audit checks what remains in local D1 and what participants can retrieve at each state.
**Scope:** Text artifact, extracted `sourceText`, confirmed claim, generated candidate suggestions, proposal list authorization, close, and reopen. Gemini was mocked.

## Prediction and reproduction

The existing data-flow report states that original text and extracted snippets remain stored while the room exists, while reopen is intended to clear event data. This round combines those transitions in the actual Worker with local Wrangler D1: submit text, confirm its only claim, generate a candidate suggestion, close the room, inspect retained rows and API reads, then reopen and count the dependent rows.

## Observed behavior

- After confirmation, the participant's pending-proposal GET returns an empty list; the confirmed claim is now represented in the room snapshot.
- The `proposals` row still contains the original text artifact, extracted `sourceText`, claim value, and provider metadata. The candidate suggestion remains persisted too.
- Closing preserves those rows, consistent with close meaning read-only rather than deletion. The pending-list endpoint returns 409 while the room is closed.
- Reopening succeeds in read-only mode and removes proposal rows, claim decisions, candidate proposals, participants, sessions, messages, and events through the existing lifecycle batch.
- The recovered snapshot contains only the sanitized room summary; private source text is not copied into it.

## Disposition

No implementation change was made. The observed close/reopen behavior matches the current lifecycle model and the product request to keep contributions available during an event and clear them when starting another. Whether to erase original text and extracted snippets immediately after a claim is reviewed remains the privacy/traceability decision already identified in Round 9; this round does not invent a retrospective policy.

## Verification and limits

The R27 regression uses synthetic contribution text and candidate data, a mocked Gemini provider, an inserted local creator session, and local Wrangler D1. It passed with the R19–R26 integration cases. It does not exercise real provider retention, backups, logs, browser behavior, production D1, or deployed Cloudflare. At the time of this historical run, D1 retained reviewed evidence while a room remained closed; see the later R39 disposition above.
