# Red team Round 2 — state and privacy

**State:** partial; one confirmed data-retention finding fixed and its migration replayed against a synthetic local record. No integrated round is complete.
**Date:** 2026-10-12.
**Threat model:** a room participant or public API caller can submit content and issue requests; they cannot read Worker secrets or modify server code.
**Limits:** no screenshot was submitted to Gemini, no live email was sent, no production service was contacted, and no real browser was used. Worker behavior after a successful provider response is code-reviewed but not integration-tested in this round.

## Finding R2-01 — processed image metadata retained an exact content fingerprint

**Before-fix status:** CONFIRMED BY INDUCTION on the persisted artifact shape. The image bytes were blanked after extraction, but `artifact_json` and the API response retained `contentHash`, MIME type, and byte length. A SHA-256 hash of the submitted bytes lets anyone who already has a candidate image check whether it is the exact same upload. The fingerprint was not used after processing.

The learner's requirement is to delete images after Gemini processes them. The prior code removed the bytes but retained image-specific metadata. Migration `0003` also redacted image bytes from older proposal rows without removing the fingerprint and related metadata.

### Fix and verification

- New image proposal responses and stored image artifacts retain only the artifact ID, kind, empty content/hash, timestamp, and uploader ID. They omit MIME type and byte length.
- Additive migration `0005_redact_image_metadata.sql` clears the content hash and removes MIME type and byte length from already stored image artifacts.
- Applied migration `0005` to local Wrangler D1 only. Inserted one synthetic legacy image proposal containing fake bytes, a synthetic hash, MIME type, and size; replayed the migration SQL and observed empty content/hash with MIME type and size removed. Removed the synthetic proposal and room afterward.
- `npm run typecheck` and `git diff --check` pass. The successful Gemini-backed image endpoint was not run, so the new response/store path has not had an integration induction. No external or production provider/database was called.

## Cross-origin configuration probes

Started a local Worker with temporary synthetic `APORIA_ALLOWED_ORIGINS` values. The exact configured origin and `https://demo.vercel.app` each received HTTP 204 and the matching `Access-Control-Allow-Origin`; `https://vercel.app.evil.example` received HTTP 403 without CORS permission. This verifies the Worker preflight implementation for those strings only. It is not a browser test and does not make CORS an API authorization boundary. The Worker was stopped after the probe.

## Other state/privacy review

- **CODE FACT:** an image is sent to Gemini as inline image data. The extraction prompt also receives every current participant display name so Gemini can attribute claims. No Gemini call was made in this round; provider-side handling, retention, and the consequences of sending the roster were not independently verified. The app's confirmation step remains the human approval gate.
- **CODE FACT:** image rows are stored only after extraction succeeds; failure responses are generic and do not include provider error bodies. D1 keeps the extracted claims and source text for an active room, while image bytes and the newly redacted image metadata are not retained.
- **CODE FACT:** lifecycle child-row cleanup is conditional on the room's claimed `reopened_read_only` or `trashed` transition. Prior local endpoint probes exercised reopen, recovery, expiry purge, and failure-closed delete behavior. The successful email-backed delete path remains unverified.
- **CODE FACT:** API JSON responses use `Cache-Control: no-store`; a real browser/cache behavior was not exercised.

No additional confirmed issue was established from the remaining code review. Round 2 remains open for a safe mocked-provider image induction, Gemini data-handling review, lifecycle concurrency, and end-to-end retention checks.

## Follow-up — October 13, 2026

The previously open mocked-provider image path was exercised through the actual Worker handler with fake D1 and a stubbed `GeminiProvider.extract`. The provider stub received the synthetic image bytes; the HTTP response and inserted `artifact_json` had empty content/hash and omitted MIME/size; the extracted `sourceText` remained in `claims_json` and the response. A second case returned a synthetic provider failure and verified that no proposal row was inserted. Both tests passed. This closes only the local mocked Worker-path gap; real Gemini handling, provider retention, and browser behavior remain unverified. See [Round 9](ROUND-9-SCREENSHOT-DATA-FLOW.md) and [`worker-image-proposal.test.ts`](../../src/worker-image-proposal.test.ts).
