# Privacy review — APORIA
## Red Team Round 39: extracted source retention

**Date:** 2026-10-23  **Method:** `data-provenance-mapping`, `beyond-the-fix`, `red-team-auditing`
**Scope:** D1 proposal artifacts and claim source snippets before and after human review. No deployed database, Cloudflare logs/backups, provider account, or production request was accessed.
**Base:** `main` @ `165ff18` (before this round's changes).

## Finding

| ID | Severity | Level | Finding |
|---|---|---|---|
| R39-01 | Privacy / data minimization | CODE FACT | APORIA retained submitted text in `artifact_json` and retained each extracted `sourceText` after its claim had been reviewed, although the reviewer UI removed completed claims and the structured result/decision remained separately recorded. |

The source snippet can reproduce personal details from a screenshot or text submission. It was needed temporarily to let the uploader inspect a pending claim. After confirmation, the room retains the structured fact and its attribution; after duplicate handling, the decision row records the duplicate. Neither path needs the raw artifact text or reviewed snippet. The user's answers say screenshots are processed by Gemini and the uploader approves extracted information; the source-retention duration had not been explicitly specified. This round applies a narrow data-minimization rule and records it as an implementation choice, not as a retrospective user decision.

## Change

- After Gemini responds, D1 now stores a redacted artifact for both text and image inputs. It keeps the ID, type, timestamp, and uploader ID used to authorize review, while clearing content and content hash.
- Claim `sourceText` remains available while its claim is pending. The same D1 batch that records a confirmation or duplicate decision clears that claim's snippet. Structured claims, room facts, attribution, and decision records remain.
- No schema migration was needed; the artifact and claim JSON fields already support this representation.

## Verification

- **Tested:** unit coverage asserts text and image artifacts are redacted after extraction, and that confirmation batches a JSON update clearing the reviewed snippet with the decision. Full unit suite: 47 tests across 11 files. Dedicated D1 suite: 25 tests across two files, including an actual local D1 Worker request confirming the source is cleared while the structured fact and decision remain. Typecheck, production build, and `git diff --check` pass.
- **Not tested against live service:** deployment behavior, production D1 contents, Cloudflare backups/logs, Gemini retention, Resend, and browser-managed copies.
- **Known boundary:** this does not erase copies already held by Google or infrastructure providers. APORIA's existing room deletion/reopen behavior governs other retained room data. Text submissions and raw images must still be treated as having been sent to the configured Gemini project under its applicable terms.

## Disposition

R39-01 is fixed at the application persistence layer for new submissions and reviewed claims. Historical rows are not migrated by this change; legacy retained artifacts/snippets remain until the existing room reopen, trash, or purge lifecycle removes them. A one-time cleanup/migration for existing live data was not run because no production database was accessed. Platform-side stores remain outside the verified deletion boundary; see [privacy and data flow](../PRIVACY-DATA-FLOW.md) and [Round 38](ROUND-38-GEMINI-DATA-PROVENANCE.md).
