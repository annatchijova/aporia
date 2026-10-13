# Red team Round 9 — screenshot data flow and retention

**State:** application-side flow mapped from current code and local documentation. Provider-side retention, platform backups/logs, and successful live extraction remain unverified.
**Date:** 2026-10-13.
**Threat model:** a participant submits a screenshot containing personal planning information; room participants, the app operator, hosting/provider systems, or an attacker with access to one of those systems may encounter the uploaded or extracted data.
**Scope:** screenshot selection, Worker parsing, Gemini request construction, proposal persistence/response, confirmation, room close/reopen/delete/purge, and known copies outside the application. No live provider call or production/staging query was made.

## Requirement provenance

An earlier scope answer asked for a sample screenshot that judges could use to replay the flow without supplying their own image. The later PRD clarification says the uploaded image itself should be deleted after Gemini processes it. The current demo fixture is a separate synthetic static file; it is preloaded into the regular preview/upload flow and is not a gallery of submitted user images. The later clarified retention behavior is the current requirement. [PRD](../../devpost/prd.md) records that the image is not a shared gallery item and is deleted after processing.

The old [ADR-0003](../decisions/ADR-0003-l2-screenshot-artifacts.md) described an earlier implementation that persisted raw image artifacts. That decision is now marked superseded; its historical rationale remains in the file.

## Current data path

| Stage/store | Data present | Evidence and status |
| --- | --- | --- |
| Browser before upload | Selected image as a data URL in component memory; preview and explicit confirmation precede submission | **CODE FACT:** the `FileReader` result is held in React state. No image is written to localStorage by this flow. Browser memory lifetime and browser-level diagnostics were not inspected. |
| Browser → Worker | Base64 image in the JSON request body over the configured API origin | **CODE FACT:** the shared body parser buffers a bounded request; image decoder validates type/size/signature. The transport is HTTPS only when the configured app/API origins use HTTPS. No packet capture was made. |
| Worker memory | Decoded image bytes/base64, artifact metadata, room participant display names | **CODE FACT:** `createProposal` constructs an artifact and passes the full participant-name list to `GeminiProvider.extract`. No source/image fields are logged by application code found in this review. Runtime memory lifetime was not instrumented. |
| Gemini request | Image bytes as inline data, prompt, and participant names | **CODE FACT:** provider request construction places image MIME/data in `inlineData`; mocked provider unit tests passed (9/9). No live provider request was made. Provider retention, human review, subprocessors, and deletion behavior are **UNKNOWN here** and depend on the account/service configuration used by the operator. |
| Successful proposal in D1 | Redacted image artifact identifiers/timestamp/uploader; extracted claims, warnings/status, provider metadata | **CODE FACT:** `artifact_json` for images stores empty content/hash and omits MIME/size. `claims_json` remains stored and can include `sourceText`, extracted values, ambiguity, and attribution. The response to the submitting browser contains the same redacted artifact plus extracted claims for its review. No separate API route for listing pending proposals was found. |
| Confirmed room state | Structured confirmed fact, attributed participant, source proposal ID and confirmation actor/time; event payload and snapshot | **CODE FACT:** only the uploader can approve their proposal. A confirmed fact enters the shared snapshot; proposal claims and source snippet remain in the proposal table until a later lifecycle cleanup. The group sees the confirmed structured fact, not the raw screenshot. |
| Active/closed D1 | Room snapshot, messages, participants/sessions, events, proposals and candidate records | **CODE FACT:** close changes status and retains existing room data in read-only form. Reopen removes chat, proposals/source submissions, events, participant sessions/names and candidate proposal rows, then retains an allowlisted candidate-only snapshot and aggregate counts. |
| Deleted room during 7-day recovery window | An allowlisted recovery snapshot in D1; ordinary child rows including chat/proposals are deleted after the room enters trash | **CODE FACT:** delete first sends the recovery email, then transitions to trash and removes child rows. If email delivery is unavailable, the operation returns 503 and leaves the room closed; this fail-closed behavior was confirmed locally in Round 7. The recovery snapshot can contain candidate title/schedule/price, counts, and an optional next-room code. |
| After recovery expiry | Expired trashed room and recovery snapshot are physically removed from active D1 by the scheduled purge | **CODE FACT:** the hourly job processes up to 100 expired rooms per run. It does not establish deletion from provider systems, platform backups, or backups outside this Worker/D1 code path. |
| Synthetic demo asset | `public/demo/availability-sample.png` remains a public static sample | **CODE FACT:** it is synthetic and intentionally distributed with the app; loading it does not submit it. It contains no user upload. |

## Privacy boundary and open decision

**CODE FACT:** deleting raw image bytes from APORIA's proposal artifact does not delete text extracted from that image. In particular, `claims_json.sourceText` may retain a personal sentence from the screenshot for as long as the active/closed room and proposal remain. The owner should not describe this as “the screenshot data is deleted” without clarifying that the original image bytes are deleted from APORIA while extracted text and confirmed facts may remain under room retention.

## R9-01 — creator email token could outlive an explicit provider rejection

**CODE FACT (before fix):** `sendCreatorLink` inserted a one-time token before validating the configured link origin and before calling the email provider. A malformed origin or a non-2xx provider response threw after the insert without removing the unused row. Round 6 covered missing email configuration, which exits before token creation, not this configured-provider variant. A failed recovery send leaves the room closed; its unused recovery token cannot restore that non-trashed room and could remain until expiry.

**Fix:** validate the link origin before token creation. If the provider returns an explicit non-2xx response, delete that still-unused token before returning the existing error path. A 2xx response keeps the token so the emailed link remains usable.

**Confirmed by mocked induction (post-fix):** a synthetic D1 adapter and mocked `fetch` returned HTTP 503; the function rejected and the inserted token hash was passed to the unused-token deletion query. A separate invalid-origin case made no D1 insert and no fetch call. A mocked HTTP 200 kept the token and did not issue a delete. All three focused tests passed. No Resend request was made. The pre-fix behavior is recorded as a code fact from source review; no provider call was made to induce it.

**Remaining ambiguity:** if `fetch` throws or times out after the provider may have accepted the email, delivery is unknown. The token is retained so a link that was actually delivered is not invalidated. This is a distributed-write ambiguity; no claim of atomicity across D1 and email is made. A durable outbox/delivery-state design remains a possible later improvement if retries and operator visibility require it.

**Decision still open:** whether to keep `sourceText` in D1 after the uploader confirms or rejects a claim, or redact it immediately after review while retaining only structured facts/provenance. This changes review/audit behavior and retention, so no code change is made before the owner chooses. The existing 7-day recovery snapshot excludes source snippets.

## Stores not verified from the repository

- Gemini/provider-side request retention, review, training use, and deletion controls for the exact account/project and service tier used.
- Cloudflare request/trace logs, D1 point-in-time recovery/backups, account-level retention settings, and any operator exports.
- Browser extensions, screenshots taken by attendees, copied API traces, and human-created exports.
- Whether a future public operator configures a different provider or sends the same data elsewhere.

Application code reviewed here does not log request bodies or image contents. That is not proof that every platform, browser, provider, backup, or operator-side copy is absent. No live Gemini, email, staging, or production service was called.

## Verification

`npm test -- src/intelligence/gemini.test.ts` passed all 9 tests; the image test uses a mocked `fetch` and verifies that image bytes are sent as Gemini inline data. `npm test -- src/worker-image-proposal.test.ts` passed both Worker-route cases with fake D1 and a stubbed provider: successful image proposal redaction/persistence and provider-failure non-persistence. `npm test -- src/creator-link.test.ts` passed all 3 mocked token cases. Code inspection confirmed uploader-only approval, lifecycle row cleanup, and retained extracted source fields. This verifies local code behavior, not provider-side handling or a live Gemini request.
