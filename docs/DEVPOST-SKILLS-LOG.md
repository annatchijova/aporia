# Devpost Learn skills usage log

This log records how the official Build With AI: Basics skills are used in this repository and why. It starts on October 12, 2026; it does not claim the workflow or these notes existed earlier.

## October 12, 2026 — `1-start`

- **Used:** Read the learner's completed answers in `docs/preguntas.md` and created the local learner profile at `devpost/learner-profile.md`.
- **Why:** The official flow uses reported experience and learning goals to calibrate later planning conversations. The learner asked to answer in a document, so we used those answers rather than asking them to repeat the interview in chat.
- **Adaptation and boundary:** Added `/devpost/learner-profile.md` to `.gitignore` before creating it, as the skill requires. The profile records only volunteered information. The learner later chose Markdown for planning reviews. Their stated need for small steps is carried forward without treating coding experience as evidence of planning experience.
- **Status:** Profile created. This does not by itself complete the full hackathon workflow.

## October 12, 2026 — `2-scope`

- **Used:** Inspected the current source and Git history, then drafted `devpost/scope.md` with `status: draft` from the learner's documented answers and the actual repository state.
- **Why:** The scope needs to describe APORIA as it exists now, preserve the user's intent for event-based coordination, and separate implemented behavior from observer-mode and screenshot-lifecycle gaps.
- **Adaptation and boundary:** Kept the existing React/TypeScript, Cloudflare Worker, D1, and Gemini architecture in view, honoring the learner's instruction not to replace it. The initial answers left end-to-end success and observer behavior unclear, so the scope was saved as a draft pending clarification rather than filling gaps with invented choices.
- **Verification:** Inspected source files and Git history; `git diff --check` passed. No test suite or deployment was run for this planning step.
- **Follow-up:** The learner answered the four review questions in Spanish. Their English translations were added to `docs/questions.md`; the scope draft recorded the desired after-party outcome, read-first participation, judges' need to replay the image flow, and Markdown review preference. The sample-image mechanism and lifecycle details remain open for the PRD/spec.
- **Approval and clarification:** The learner explicitly approved the scope and clarified that APORIA's core should include a shared chat space for an event, meeting-number entry, closing a space, recovering an accidentally deleted room, and deleting a completed room before the next event. Updated `devpost/scope.md` to `status: approved`; these are product intentions, not implemented features. Added focused behavior questions for `3-prd` to the Spanish questionnaire and a faithful English translation to its copy.

## Workflow checkpoint after `2-scope`

- At this earlier checkpoint, `4-spec`, `5-build`, and `6-ship` had not yet been run. The PRD was still a draft. No code changes should begin until the spec is approved and the build checklist establishes the necessary work.

## October 12, 2026 — `3-prd`

- **Used:** Translated the learner's product answers into `docs/questions.md` and drafted `devpost/prd.md` from the approved scope, the answers, and the current app behavior.
- **Why:** The PRD turns the approved idea into observable behavior for meeting-number entry, shared chat, AI-assisted planning, the judge demo flow, and room lifecycle.
- **Adaptation and boundary:** The learner specified separate close, delete, and recover operations. A seven-day trash period with automatic permanent deletion is recorded as their proposal, not an approved requirement. Remaining behavior questions are in `docs/preguntas.md` and its English translation. The PRD stays `draft` until those gaps are resolved and the learner approves it.
- **Verification:** Read the official PRD template and guide, compared claims with current source, and ran `git diff --check`. No tests or deployment were run; no code was changed.
- **Follow-up at that point:** The learner specified that chat is for brief coordination notices, not social interaction; screenshots and availability have separate sections; anyone can post with a proposed five-message limit. They also described a clickable demo mode and read-only room reopening with names/chat removed. Those answers were translated into `docs/questions.md` and reflected in the PRD draft. The later clarification below resolved real-time updates and image access/retention; other decisions are still open.
- **Lifecycle clarification:** The learner separated `close` (read-only, no contributions), `delete` (creator requests deletion of the room and its data), and `recover` (creator restores during a limited period). They proposed a seven-day trash period followed by automatic permanent deletion. They also specified read-only reopening with names and chat removed, restoring only limited nonpersonal event details. The seven-day duration remains a proposal pending approval.
- **Follow-up answers:** The learner confirmed real-time chat and a strict limit of five messages per person per room. Gemini is the only intended viewer of uploaded images; images are deleted after processing, dietary restrictions need their own section, and duplicate facts from one person's repeat upload should not count twice. The creator enters event context/title after room creation and can sign in with Google. The learner approved informational-only dietary restrictions, optional Google plus disposable email registration, human approval of Gemini extractions, a seven-day trash period, and product-level duplicate handling that does not need to be staged in the demo. English translations were added to `docs/questions.md`.
- **Open decisions preserved:** the account/recovery mechanism for disposable email; who approves an extraction before sharing; how the official backend is shared with arbitrary frontend hosts; and the Gemini free-tier privacy choice. The source's existing free-tier request behavior is not evidence that users approved this data handling. The scope and PRD now reflect the image lifecycle and informational dietary section. Dietary restrictions and post-processing image deletion are not implemented in source. No code was changed.
- **Verification:** `git diff --check` passed after the document updates. No tests or deployment were run.

## October 12, 2026 — `4-spec`

- **Started:** The learner approved `devpost/prd.md`; the spec is drafted from the existing React/Vite client, Cloudflare Worker/D1 configuration, Gemini request path, migrations, and the approved product behavior.
- **Recommendations to review, not yet implementation authorization:** use Cloudflare Durable Objects for live room broadcasts while D1 remains the durable source of truth; use a scheduled Worker to purge expired rooms; use optional Google OAuth plus one-time email links for disposable-email registration. Technical choices with product, privacy, or account consequences remain listed for the learner in `docs/preguntas.md`.
- **Privacy finding:** the official Gemini API terms distinguish unpaid and paid use. The current free quota may use submitted content to improve Google products and may allow human review; therefore deleting an image from APORIA after the response does not mean it was never shared with Google's service or that Google's handling is controlled by APORIA. This is recorded as an open product decision, with a source link in `devpost/spec.md`.
- **Status:** `devpost/spec.md` is a draft pending the learner's review. No code has been changed. Tests and deployment were not run.

## October 12, 2026 — switch to the learner's personal skills

- **Instruction:** The learner asked to stop using the isolated Devpost skill pack and continue with their personal skills. Removed `hackathon-sandbox/`; no personal skill files were changed.
- **Used:** `software-archaeology` to inspect the existing React/Worker/D1 implementation and preserve its architecture; `secure-by-construction` to keep room writes on the server, enforce the chat cap in D1, limit claim approval to its author, deduplicate confirmed facts, and discard uploaded image bytes after Gemini responds.
- **Why:** APORIA already has a working decision engine and data model. The requested changes need to fit that system, enforce permissions at the Worker boundary, and avoid retaining screenshot bytes.
- **First implementation increment:** Added additive D1 schema for meeting codes, chat messages, and per-claim review decisions; added meeting-number lookup and observer-first access; added D1 chat with two-second refresh and a server-side five-message cap; added screenshot preview confirmation, contributor-only claim approval, image-byte redaction after extraction (including older stored images), informational dietary notes, and same-person duplicate handling.
- **Still outstanding:** Creator authentication and recovery, room close/delete/restore lifecycle, demo fixture, and cross-origin deployment configuration. The specification now records the learner's recent answers and labels this partial implementation accurately.
- **Verification:** No tests or build were run in this implementation step.

## October 12, 2026 — creator account and room lifecycle increment

- **Used:** Continued with the personal `software-archaeology` and `secure-by-construction` skills already recorded above; no Devpost skill-pack instructions were used for this implementation increment.
- **Why:** The learner asked to proceed with actual APORIA improvements after the planning decisions were completed. The existing Worker/D1 architecture already owns room persistence, so the lifecycle and creator boundary were implemented there.
- **Changes:** Added an additive migration for creator accounts, hashed one-time email tokens, creator sessions, and lifecycle metadata. Added Resend-based creator email verification, creator-only close/reopen-read-only/delete actions, deletion of room contributions and identity rows, a seven-day allowlisted recovery snapshot, read-only recovery, and an hourly Cron Trigger that purges expired rooms and stale auth rows. The snapshot restores generic option labels with day/time/price only; this is narrower than the approved PRD examples and is documented as such. Added bilingual creator controls and read-only states.
- **Configuration and limits:** Email actions require `RESEND_API_KEY`, `CREATOR_EMAIL_FROM`, and `APORIA_APP_ORIGIN` in the Worker environment. Google sign-in, cross-origin API access, the demo fixture, and broader abuse controls are still missing. The scheduled purge has a 100-room batch cap, so a large backlog can delay physical deletion beyond the hourly schedule. Purging from D1 does not control provider processing or platform backups.
- **Verification:** `git diff --check` passed. No tests, typecheck/build, migration, email delivery, browser exercise, or deployment was run. The new lifecycle migration remains unapplied and these paths are not yet demonstrated end to end.


## October 12, 2026 — synthetic screenshot fixture

- **Used:** Personal `imagegen` skill with the built-in image generation tool.
- **Why:** Reviewers should be able to try image extraction without finding or uploading their own personal screenshot.
- **Asset:** Added `public/demo/availability-sample.png`, a synthetic mobile chat screenshot containing a generic `Demo` sender and “El sábado puedo después de las 20. Soy vegetariana.” The interface includes only generic placeholder UI symbols; it has no real people's data.
- **Flow:** Added a button that preloads the asset into the existing screenshot preview. The participant still has to inspect it, affirm the checkbox, submit it to the regular extraction endpoint, and approve any extracted claim. The image is not uploaded automatically.
- **Documentation:** Replaced `docs/DEMO-SCRIPT.md` with reviewer steps, fixture provenance, and deployment caveats. A guided Demo mode on the landing page remains missing.
- **Verification:** Visually inspected the fixture and confirmed its format and size (PNG, 941 × 1672, about 932 KiB; below the 1.5 MB upload cap). `git diff --check` passed. No build, test, browser flow, Gemini call, or deployment was run.

## October 12, 2026 — lifecycle boundaries and shared-backend configuration

- **Used:** Personal `destination-driven-construction`, `secure-by-construction`, and `software-archaeology`; used `red-team-auditing` and `invariant-hunting` for a code-reading preflight on the lifecycle paths. This was not a completed experimental red-team round. `variant-analysis` is reserved for sibling-path review after a finding is confirmed and fixed.
- **Why:** The learner asked to finish the actual system before building a guided demo, then run multiple red-team rounds and variant analysis. The product's target includes rooms hosted on the shared backend from separately hosted frontends, with creator-only lifecycle operations.
- **Code changes:** Recovery now checks the verified owner before restoration and groups room restoration, one-time token consumption, and creator-session creation in one D1 batch. Reopening a closed room strips participant/chat/source data and preserves only anonymized candidate options plus an aggregate participant count. Deletion requires the room to be closed or reopened read-only. Close/reopen verify their conditional updates changed the room. Deletion claims the room's `trashed` state first and conditions child-data deletion on that exact state transition. The seven-day allowlisted recovery snapshot keeps candidate names, schedule, price, participant count, optional creator-entered attendance count, and optional code for another active room. Creators can request a new email login link after losing their local session; after the last owned room and any valid auth link expire, the scheduled task removes the creator account and sessions. The Worker provides exact-origin CORS and an opt-in `https://*.vercel.app` pattern using `APORIA_ALLOWED_ORIGINS`; the client can target the shared API using `VITE_APORIA_API_ORIGIN`.
- **Architecture boundary documented:** The shared backend operator can list exact frontend origins or deliberately allow any HTTPS Vercel origin; CORS is browser policy, not authentication. Apache-2.0 permits self-hosting but does not grant access to the shared backend. Signup throttling, cost limits, production configuration, and live validation remain unresolved.
- **Verification:** `npm run typecheck` and `git diff --check` passed after the source and documentation edits. At that time no tests, full build, migration application, email send, browser run, or deployment had been performed for this increment; the later local red-team probe is recorded below.

## October 12, 2026 — first local red-team probe and variant analysis

- **Used:** Personal `red-team-auditing`, `invariant-hunting`, `variant-analysis`, `secure-by-construction`, and `audit-before-patch` skills. This is the first experimental red-team work; Round 1 remains partial.
- **Finding R1-01:** A valid participant session could confirm an extracted claim with a `participantId` absent from the room. Direct Worker+D1 reproduction returned HTTP 200 and persisted that ID into a fact and evaluator constraint. A second reproduction using an unknown participant ID already present in the stored claim also succeeded.
- **Variant analysis:** Traced every participant-ID source and sink. The confirm-claim route was the only endpoint accepting participant attribution from client/provider data; join, chat, and candidate writes derive attribution server-side. Re-tested explicit unknown override, stored unknown attribution, explicit blank/null attribution, and valid assignment to a different participant in the same room.
- **Fix:** Require the final attributed ID to exist in the loaded room snapshot. The client now sends `null` for an empty selector rather than falling back to an unmatched extractor string. This preserves the ability for an uploader to confirm a claim about another actual room participant.
- **Verification:** Before fix, both unknown-ID vectors returned HTTP 200. After fix, both return HTTP 400, explicit null requires selection, and assigning to another real room participant returns HTTP 200. The original override reproduction was rerun after the fix. Local Worker and D1 ran with synthetic fixtures; no Gemini or email provider was called. `npm run typecheck` and `git diff --check` pass. Local migrations 0003 and 0004 are applied. No production database was accessed. Follow-up probes below cover creator-link consumption and partial lifecycle paths; Round 1 remains open for expiry, duplicate review, race, and successful email-backed deletion cases.

- **Finding R1-02:** Direct API requests could pass objects or strings where endpoints expected text/numeric JSON values. The Worker stringified an object room title to `"[object Object]"`, accepted an object message, and coerced candidate numeric strings and object fields into durable data.
- **Variant analysis and fix:** Enumerated the text/number coercions across room creation, joining, chat, proposals, idempotency, candidates, creator email/token, attendance and next-room code. Added boundary helpers that reject non-text and non-number values before domain operations, and changed the creator form to send attendance as a number.
- **Verification:** Before fix, room/message/candidate coercion vectors returned HTTP 200/201 and stored malformed values. After fix, object/number text fields, numeric strings, null revision, object email/token, and malformed candidate fields returned HTTP 400; normal create/join/chat/candidate requests still succeeded. Malformed JSON and the >2.1 MB request body already returned HTTP 400 before the fix. Four test rooms and all child rows created for this probe were removed from local D1. No email or Gemini calls, no production database access. `npm run typecheck` and `git diff --check` pass. Round 1 remains open.

- **Finding R1-03:** The common JSON parser ignored `Content-Type`; a request with an unapproved Origin and `text/plain` body containing valid JSON created a room with HTTP 200. The probe used Node `fetch`, not a browser. The CORS wrapper does not block requests by Origin, and room creation is intentionally public; the impact is a potential simple cross-origin browser route to consume shared resources, not a privilege bypass.
- **Fix and variant analysis:** Require `application/json` (including parameters such as `charset=utf-8`) in the common body parser. Verified the same rejection on room creation, chat, proposal, and creator-access body routes. Normal `application/json` creation remains functional. The browser's preflight and response behavior has not been run. This does not prevent direct clients or bots and does not replace resource quotas/rate limits.
- **Verification:** Before fix, the external-Origin `text/plain` request created a local room; after fix it returned HTTP 400. The `application/json; charset=utf-8` control returned HTTP 200. Three rooms created during these probes and all their child rows were removed from local D1. No production database or external provider was used.

## October 12, 2026 — duplicate review, expiry, and same-claim race probes

- **Used:** Continued the personal `red-team-auditing`, `invariant-hunting`, and `variant-analysis` workflow recorded above; no Devpost sandbox skills were used.
- **Probes:** Seeded synthetic D1 proposals to confirm a fact already present for the same participant, replay the completed claim, and send two simultaneous requests for one duplicate claim. A separate synthetic creator login token had an expiry timestamp in the past.
- **Observed:** Duplicate approval returned HTTP 200 with `duplicate: true`, no added fact, and no revision increment. Re-review after its decision returned HTTP 409. Concurrent review produced one HTTP 200 and one HTTP 404 after the proposal was marked complete; inspection showed one decision and no extra fact. The expired link returned HTTP 400 and created no session. These results did not confirm a defect; they do not cover precise expiry-boundary timing or broader write races.
- **Cleanup and limits:** The synthetic room and all associated D1 rows were removed from local Wrangler D1 after the probes. No email, Gemini, or production service was called. The Wrangler process was stopped. Round 1 remains partial; the report lists the outstanding cases.

## October 12, 2026 — state/privacy round and image metadata redaction

- **Used:** Personal `red-team-auditing`, `invariant-hunting`, `variant-analysis`, `secure-by-construction`, and `data-provenance-mapping` skills.
- **Finding R2-01:** Image extraction blanked uploaded bytes before persistence, but stored and returned the exact content hash, MIME type, and byte length. Migration 0003 had redacted old image bytes while leaving that metadata in legacy rows. The hash could identify an exact matching image and was not used after extraction.
- **Fix:** Newly stored and returned image artifacts now retain only the empty content/hash fields and ordinary artifact/uploader identifiers; MIME and size are omitted. Additive migration `0005_redact_image_metadata.sql` clears those image-derived fields from existing image proposal rows.
- **Verification:** Applied migration 0005 to local Wrangler D1. Inserted a synthetic legacy image proposal with fake bytes/hash/MIME/size, replayed the migration SQL, observed empty content/hash and absent MIME/size, then removed the fixture. `npm run typecheck` and `git diff --check` pass. Successful image extraction through Gemini was not exercised, and no external provider or production database was called.
- **Additional probes:** Temporary local CORS configuration returned the matching allow-origin for an exact origin and a `*.vercel.app` origin, and 403 for `vercel.app.evil.example`. This was not a browser test. Code review confirmed the extraction prompt also sends all room participant display names to Gemini for attribution; the provider call and its handling were not exercised.
- **Status:** Round 2 remains partial. See [Round 2 report](red-team/ROUND-2-STATE-PRIVACY.md).

## October 12, 2026 — public entry burst limits

- **Used:** Personal `red-team-auditing`, `resource-exhaustion-review`, `cloud-architecture-selection`, `decision-record-discipline`, and `variant-analysis` skills.
- **Finding R3-01:** Before mitigation, the local Worker created 20 rooms in 272 ms and answered 200 concurrent invalid meeting-code lookups without returning 429. A valid code lookup returns the full room snapshot by design, making an unthrottled code oracle relevant to room privacy as well as resource use.
- **Architecture choice:** Added Cloudflare Worker Rate Limiting bindings rather than D1 counters or a new external service. The owner's existing Worker architecture is a hard constraint. ADR-0006 records tradeoffs, the shared-NAT impact, and revisit triggers. The binding's counters are per Cloudflare location and eventually consistent, so they are burst brakes rather than global quotas.
- **Limits and verification:** Per synthetic client IP, lookup permits 30 requests per 10 seconds, creation permits 3 per 60 seconds, and joining permits 60 per 10 seconds. Local Worker probes accepted each cap and returned HTTP 429 on request cap+1. Four synthetic rooms and their child rows were removed afterward. `npm run typecheck`, `git diff --check`, and `npx wrangler types` passed. No production service was used.
- **Still open:** No provider-call quotas, global accounting, distributed abuse control, real Cloudflare edge behavior, or impact measurement for clients behind shared NATs. Round 3 remains partial; see [Round 3 report](red-team/ROUND-3-PUBLIC-ABUSE.md).

## October 12, 2026 — group and resource behavior

- **Used:** Personal `red-team-auditing`, `invariant-hunting`, `variant-analysis`, and `resource-exhaustion-review` skills.
- **Probe:** Ran the existing Worker with local Wrangler/D1, created a synthetic room, joined to 20 total participants, and added 20 candidates sequentially at current revisions.
- **Observed:** All actions succeeded; candidate requests took 13.29–20.17 ms locally and the final snapshot was 10,033 bytes. This does not establish deployed capacity. Code review found participant/fact/candidate arrays have no per-room ceilings and evaluator work scales with candidate × constraint counts. Gemini extraction and discovery have no application quota; retryable provider failures can be retried once. No Gemini, email, or production service was called.
- **Disposition:** No aggregate cap was chosen because existing 2/4/12/20 group scenarios do not define a product maximum, and per-IP provider throttles are not a hard shared spend ceiling. The synthetic room was removed and Wrangler was stopped. Round 4 remains partial; see [Round 4 report](red-team/ROUND-4-GROUP-RESOURCES.md).
- **Concurrency variant:** Two simultaneous joins both committed with monotonic revisions. In a 16-way candidate-add burst at one expected revision, one candidate committed and 15 stale writes returned 409; persisted state held only the winner. Wrangler logged about 20.3 seconds on stale responses in this local contention run, which is not a production timing claim. All three race-probe rooms were removed and verified absent.

## October 12, 2026 — recovered-room read authorization

- **Used:** Personal `authorization-surface-mapping`, `client-side-trust-boundary`, `audit-before-patch`, `red-team-auditing`, `invariant-hunting`, `variant-analysis`, and `git-discipline` skills.
- **Finding R5-01:** An unauthenticated caller with the old room UUID could GET a `recovered_read_only` snapshot, including the next meeting code retained for recovery. The room UUID remains in old invitation links.
- **Fix:** Recovered-room snapshot GET now requires a valid creator session bound to that room. The client carries that token for initial and periodic reads and provides a creator email-link request screen when access must be re-established. Active and closed observer reads stay public.
- **Verification:** Seeded synthetic recovered state and owner/other-creator sessions in local D1. After the patch, anonymous, invalid-token, and unrelated-creator requests returned 401 without the summary; the owner returned 200 with it. An anonymous active-room GET still returned 200. `npm run typecheck` and `git diff --check` passed after the final UI reauthentication addition. No email, Gemini, or production service was used. Both fixture rooms and accounts were removed and verified absent; Wrangler was stopped.
- **Status:** The endpoint authorization matrix passed its local induction. Recovery email delivery and browser behavior remain unverified. See [Round 5 report](red-team/ROUND-5-RECOVERY-READ-AUTHORIZATION.md).

## October 12, 2026 — creator access abuse review

- **Used:** Personal `audit-before-patch`, `authorization-surface-mapping`, `resource-exhaustion-review`, `red-team-auditing`, and `variant-analysis` skills.
- **Finding R6-01:** With local email configuration absent, a registered creator address returned 503 while an unknown address returned 200. Unknown-address requests also returned before the room's D1 token cooldown. A token query after delivery failure returned zero, falsifying the orphan-token hypothesis.
- **Changes:** Added a dedicated 5-requests-per-60-seconds Worker limiter for creator-access requests by source IP. Email delivery failures now return the same generic success-shaped response as unknown addresses to remove the account-existence status oracle.
- **Verification:** `npm run typecheck` and `git diff --check` passed. A local Wrangler/D1 fixture probe alternated registered and unknown synthetic emails: requests 1–5 returned 200 with `{"sent":true}`, and request 6 returned 429 with `Retry-After: 60`. The synthetic room/account were deleted and verified absent; Wrangler was stopped. No Resend, Gemini, or production service was used.
- **Limits:** Cloudflare limiter behavior in production, distributed-IP bypass, shared-NAT impact, email success/failure monitoring, and browser UX remain unverified. See [Round 6 report](red-team/ROUND-6-CREATOR-ACCESS-ABUSE.md) and [ADR-0006](decisions/ADR-0006-cloudflare-worker-burst-limits.md).
- **Timing variant follow-up:** A randomized local sample of 40 registered and 40 unknown synthetic-email requests measured p50 round trips of 14.61 ms and 11.81 ms. This is recorded as a plausible local timing hypothesis only: the sample was noisy, used unconfigured email delivery, and does not establish remote exploitability. No timing delay or code change was added. The second synthetic fixture was removed and verified absent; Wrangler was stopped.
- **Concurrent limiter variant:** An eight-request burst with mixed known/unknown synthetic emails and one synthetic source IP returned five generic 200 responses and three 429 responses locally. This confirms the local burst boundary under concurrency, not production global accounting; the native limiter remains eventually consistent by location. The fixture account and room were removed and verified absent.

## October 12, 2026 — request body framing variants

- **Used:** Personal `validate-at-the-boundary` and `red-team-auditing` skills.
- **Prediction:** absent or mismatched `Content-Length` must not bypass the actual 2,100,000-byte body cap, and valid chunked JSON under the cap must remain accepted.
- **Observed:** a valid 56-byte chunked create without `Content-Length` returned 200; a 2,100,001-byte chunked JSON body returned 400 `request body too large`; an HTTP/1.1 request declaring two bytes while sending a longer JSON document returned 400 `request body must be valid JSON` and created no room. The local HTTP parser framed the body before the Worker received it.
- **Disposition:** No bypass confirmed on the local HTTP/1.1 path and no code change needed for these cases. `body()` still buffers the whole decoded body before checking its actual byte length; memory exhaustion was not induced and is recorded only as a resource hypothesis. Cloudflare edge framing and platform request limits remain unverified.
- **Cleanup:** Deleted the synthetic room and child rows, verified no room remained, and stopped Wrangler. See [Round 1 report](red-team/ROUND-1-LOCAL-ENDPOINTS.md).

## October 12, 2026 — concurrent chat cap boundary

- **Used:** Personal `red-team-auditing`, `invariant-hunting`, and `variant-analysis` skills.
- **Prediction:** from four stored messages, eight concurrent posts with distinct idempotency keys should persist at most one additional message for the participant.
- **Observed:** one concurrent request returned HTTP 201, seven returned HTTP 429, and an authenticated read showed five persisted messages and a participant count of five.
- **Cleanup and limits:** Deleted the synthetic room and all child rows, verified it absent, and stopped Wrangler. This is local D1/Worker evidence; production concurrency and other lifecycle races remain open. See [Round 1 report](red-team/ROUND-1-LOCAL-ENDPOINTS.md).

## October 13, 2026 — integrated public-room flow

- **Used:** Personal `destination-driven-construction` to keep product work ordered before demo work, plus `red-team-auditing` and `variant-analysis` to define a narrow integrated threat model, make a falsifiable prediction, and enumerate adjacent room/chat transitions. No official Devpost sandbox skills were used.
- **Induction:** With local Wrangler+D1 only, created a room, looked it up by meeting number, joined a second synthetic participant, posted from both sessions, and read both messages anonymously. Then consumed a synthetic creator login token, closed the room, checked room/message reads and a new write, and requested deletion with email delivery unconfigured.
- **Observed:** The public flow worked; both chat messages showed their correct authors. Creator login and close succeeded. A new post after close returned 409 with no additional row; a retry of a message accepted before close replayed its original result without a write. Delete returned 503 and preserved the closed room and existing message because local email was unavailable. No provider or external email call was made. The room/account fixtures were deleted, zero remaining were confirmed, and Wrangler was stopped.
- **Limits:** Successful delete/recovery as one integrated journey, browser behavior, staging, and production remain unverified. No code change was justified. See [Round 7 report](red-team/ROUND-7-INTEGRATED-PUBLIC-FLOW.md).

## October 13, 2026 — client refresh overlap

- **Used:** Personal `resilient-ui-states` to preserve request lifecycle and stale-response behavior, plus `red-team-auditing` and `variant-analysis` to trace the same timing condition across the three room/chat refresh paths.
- **Finding and fix:** The room status, participant snapshot, and chat refresh loops used fixed intervals shorter than the shared 15-second request timeout. Replaced them with completion-driven scheduling, cleanup on unmount, and an active check before applying results.
- **Verification:** Three focused scheduler tests cover a pending refresh, cleanup with a pending response, and no re-poll after unmount. All passed; `npm run typecheck` and `git diff --check` passed. `rg` found no remaining client `setInterval` refresh loops.
- **Limits:** No delayed-response browser or deployment probe was run; the pre-fix impact remains a plausible hypothesis, not a confirmed production defect. See [Round 8 report](red-team/ROUND-8-CLIENT-POLLING.md).

## October 13, 2026 — screenshot data provenance

- **Used:** Personal `data-provenance-mapping` to trace the image and extracted information through browser memory, Worker request handling, Gemini, D1, room lifecycle cleanup, and stores outside the repository's visibility.
- **Finding:** The later PRD answer supersedes the earlier request for judge-reusable uploaded images: raw screenshot bytes are removed from APORIA's proposal artifact after Gemini returns. Extracted claims, which may include source text from the image, remain in the proposal row while the room remains active/closed. The old ADR that described image-byte persistence is now labeled superseded.
- **Follow-up:** Code review found that an invalid app origin or explicit provider HTTP rejection could leave a one-time creator token in D1 after the send failed. Origin validation now precedes insert; an explicit non-2xx response removes the unused token. A thrown/ambiguous network failure keeps it because the provider may have accepted the email.
- **Verification:** Reviewed current code and lifecycle SQL; the mocked Gemini image-boundary test passed 9/9. A Worker-route test with fake D1 and stubbed Gemini verified redacted response/storage, retained source text, and no proposal on provider failure (2/2). Three mocked email tests passed for provider rejection, invalid origin, and accepted delivery. No live provider/email or production/staging service was used.
- **Open decision and limits:** Whether to erase extracted `sourceText` after review remains a product decision because it changes review/audit behavior. Gemini/provider retention, Cloudflare backups/logs, browser copies, and operator exports were not verifiable from this repository. See [Round 9 report](red-team/ROUND-9-SCREENSHOT-DATA-FLOW.md).

## October 13, 2026 — full local verification checkpoint

- **Used:** Personal `red-team-auditing` and `variant-analysis` to check the accumulated fixes together, after the focused probes for polling, creator-link cleanup, and image-proposal redaction.
- **Verification:** `npm test` passed all 30 tests across 8 files. `npm run build` produced the Vite production bundle successfully. The focused `npm run typecheck` and `git diff --check` checks had passed during the preceding fixes.
- **Limits:** This is local code verification. It does not establish Cloudflare edge behavior, production provider behavior, browser-level behavior, deployment readiness, or closure of the still-open red-team rounds. No external services were contacted.

## October 13, 2026 — make the room flow visible

- **Used:** Personal `software-archaeology` to preserve the existing React/Worker architecture; `destination-driven-construction` to improve the working room itself before demo work; `non-overwhelming-ux` and `frontend-accessibility-by-construction` to use a short, semantic, responsive three-step explanation with no new controls; `git-discipline` and `working-on-main` to establish and push restore/freeze tags before editing on `main`.
- **Change:** Added a room-flow panel to observer and participant views. It explains how people enter and choose a name, how text/screenshots are reviewed, and how APORIA evaluates real options. Counts come from the current snapshot; no synthetic completion score is shown. The screenshot copy describes APORIA's existing behavior: image bytes are discarded after processing and confirmed details remain in the room. Reworked the landing page into a responsive two-column entry layout on desktop and a single-column flow on mobile. Added responsive styling and defined the existing `--panel`/`--line` aliases used by creator controls.
- **Why:** The product already supported these actions, but the room did not explain their relationship clearly to someone opening it for the first time. The panel makes the current workflow legible without changing APIs, data, or room permissions.
- **Verification:** `npm run build` passed, including TypeScript checking and Vite production bundling; `git diff --check` passed. No test suite, red-team round, or external service was used in this session.

## October 14, 2026 — recovery journey red team

- **Used:** Personal `red-team-auditing`, `variant-analysis`, and `falsifiable-testing` to make a prediction before exercising the recovery route and check adjacent authorization/replay paths. `data-provenance-mapping` informed the recovered-snapshot assertions. The established `software-archaeology` boundary was kept: this round changed no production code.
- **Why:** Round 7 had verified that deletion failed closed when local email was unavailable, leaving successful recovery across the whole journey open. A synthetic email response and storage adapter let the actual Worker handlers run without calling a provider.
- **Observed:** The Worker route test covers `closed → trashed → recovered_read_only`, strips participant-linked and location data from the recovered snapshot, denies anonymous recovered-room reads, allows the returned creator session, and rejects token replay. See [Round 10](red-team/ROUND-10-RECOVERY-JOURNEY.md).
- **Verification boundary:** This is handler-level evidence with synthetic storage, not local D1 transaction or concurrency evidence. Provider delivery, expiry boundaries, simultaneous replay, browser handling, and deployed behavior remain open. The first run failed because the test adapter omitted statement metadata needed by `DB.batch`; correcting the harness made the targeted test pass. No product-code defect was confirmed.

## October 14, 2026 — local D1 recovery follow-up setup

- **Used:** Personal `git-discipline` to verify the live repository state and create a restore tag before continuing; personal `red-team-auditing` to keep the evidence level below induction when the local harness did not start.
- **Attempt:** Prepared an isolated Miniflare worker with a synthetic outbound email response and a temporary D1 path. The installed Miniflare 5 package rejected the legacy Worker options shape before startup. No Worker request, database migration, provider call, or repository code change occurred.
- **Disposition:** This was setup exploration, not a security finding or a completed red-team round. Round 10 remains limited to its synthetic D1 adapter; real D1 delete/recovery atomicity and concurrency stay open. The next attempt must use a configuration shape supported by the installed Wrangler/Miniflare version and keep the D1 state isolated from the project's normal local database.

## October 14, 2026 — recovery expiry variants

- **Used:** Personal `red-team-auditing` and `variant-analysis` to extend the recovery invariant to token expiry and the seven-day trash window; personal `falsifiable-testing` to prove both tests detect removal of the corresponding expiry checks.
- **Change:** Added two Worker-handler cases with a synthetic storage adapter. No production code changed.
- **Evidence:** The expired link returned 400 and the expired trash window returned 410; both left the room trashed, preserved recovery data, and created no creator session. Removing either expiry check temporarily made its test fail with HTTP 200; both mutations were reverted before the green run. The full suite passed 33 tests across 9 files and `npm run build` passed.
- **Limit:** Synthetic storage cannot validate D1 transaction behavior or expiry equality at the exact clock boundary. See [Round 10 follow-up](red-team/ROUND-10-RECOVERY-JOURNEY.md).

## October 14, 2026 — scheduled purge foreign-key failure

- **Used:** Personal `red-team-auditing`, `invariant-hunting`, and `variant-analysis` to derive the retention invariant and trace every dependent table; `audit-before-patch` to reproduce the suspected failure on the actual local D1 engine before changing code; `atomic-state-mutation` to keep ordered child deletion and parent deletion in one conditional batch; `falsifiable-testing` to test the fixed Worker against expired and unexpired fixtures; and `git-discipline` to preserve the pre-fix revision.
- **Finding and fix:** An expired room with retained children could not be purged because the old scheduled SQL deleted only recovery tokens before the parent room, while the schema has restrictive foreign keys. The D1 engine returned `SQLITE_CONSTRAINT_FOREIGNKEY`; retained state was visible afterward. The Worker now deletes dependent rows in order, guards each child delete on the room still being expired, and removes the room last in the same batch.
- **Induction:** The pre-fix SQL failure was reproduced in isolated local D1. After the fix, the actual Worker scheduled handler returned 200, removed the expired synthetic room, and preserved a second synthetic room with a future recovery deadline and its participant/session/message. Full suite: 33 tests across 9 files; build and diff check passed. Fixture and reproduction steps are in [Round 11](red-team/ROUND-11-SCHEDULED-ROOM-PURGE.md).
- **Limits:** No production D1, provider, or live Cloudflare scheduler was used. A concurrent recovery/purge race remains open. The separate Round 10 email-backed delete/recovery journey still uses synthetic storage.

## October 14, 2026 — recovery expiry against local D1

- **Used:** Personal `red-team-auditing`, `variant-analysis`, and `falsifiable-testing` to check the token-expiry and room-window boundaries as separate states. `git-discipline` established a restore tag before the probe.
- **Induction:** Seeded two synthetic rooms and token hashes into the isolated local D1. The actual Worker returned 400 for an expired token and 410 for an unexpired token whose room's recovery deadline had passed. Follow-up SQL confirmed both rooms stayed trashed, their tokens remained unused, recovery snapshots remained, and no creator session was inserted.
- **Why:** Round 10's tests covered these branches with synthetic storage; this checks the D1 reads and writes on the real local Worker path without sending email.
- **Limit:** No exact timestamp equality, concurrent token redemption, real provider, or production environment was used. See [Round 12](red-team/ROUND-12-RECOVERY-EXPIRY-D1.md).

## October 14, 2026 — recovery redemption race

- **Used:** Personal `concurrency-reasoning`, `audit-before-patch`, and `red-team-auditing` to derive and reproduce the shared-state failure; personal `falsifiable-testing` and `variant-analysis` to add a red-first invariant test, run a negative control, and enumerate the adjacent creator-login path.
- **Finding:** Against the pre-fix Worker, 32 simultaneous submissions of one synthetic recovery token returned one 200 and 31 409 responses, yet inserted 32 creator sessions in local Wrangler D1. Failed requests still met the old recovered-room-only `INSERT ... SELECT` predicate.
- **Fix and induction:** Added `changes() = 1` to the session insertion predicate so the insert depends on the immediately preceding token-consumption update changing a row in that D1 batch. A fresh local Worker/D1 run yielded one 200, 31 409, and one additional session. The automated concurrent test failed before the fix (8 sessions), passed after it, and failed again when the guard was temporarily removed.
- **Verification:** `npm test` passed 34 tests across 9 files; `npm run build` and `git diff --check` passed. No schema change, production database, email, or external provider was used. See [Round 13](red-team/ROUND-13-RECOVERY-REDEMPTION-RACE.md) and its [synthetic SQL fixture](red-team/fixtures/ROUND-13-RECOVERY-RACE.sql).
- **Limit:** This verifies the installed local Wrangler/D1 execution path. Creator login-link concurrency, exact expiry equality, and Cloudflare production behavior remain open.

## October 14, 2026 — deployment direction recorded

- **Used:** Personal `cloud-architecture-selection` and `decision-record-discipline` to document the hosting boundary the user chose and distinguish repository evidence from deployment work still pending.
- **Decision:** The new frontend is intended for Vercel; the existing API, D1, schedules, and provider secrets stay on Cloudflare Workers. The previous Webflow beta remains separate. `VITE_APORIA_API_ORIGIN` and the Worker CORS allowlist already support this split in code.
- **Limit:** No Vercel project, production origin, build environment, secrets, price, or deployment was checked or configured. The record is [ADR-0007](decisions/ADR-0007-vercel-frontend-cloudflare-api.md); deployment checks remain future work.

## October 14, 2026 — creator login replay race

- **Used:** Personal `concurrency-reasoning` and `red-team-auditing` to test the sibling login-token flow after fixing recovery-link session creation.
- **Induction:** Thirty-two simultaneous uses of the same synthetic login token against the actual local Worker/D1 produced one 200 and 31 409 responses. D1 held one consumed token, one creator account, one room ownership link, and one creator session.
- **Disposition:** The same-token race was falsified for this local configuration; no production code changed. Two distinct live login links, deletion races, exact expiry, and deployed behavior remain unchecked. See [Round 14](red-team/ROUND-14-CREATOR-LOGIN-RACE.md) and its [synthetic fixture](red-team/fixtures/ROUND-14-CREATOR-LOGIN-RACE.sql).

## October 14, 2026 — concurrent distinct creator links

- **Used:** Personal `concurrency-reasoning` and `red-team-auditing` to extend the single-token replay check to separate valid credentials for one creator.
- **Induction:** Two concurrently redeemed synthetic login links both returned 200. Local D1 contained one creator account, two consumed tokens, one room ownership link, and two creator sessions.
- **Disposition:** The current schema permits multiple sessions and each token was independently valid and single-use, so no defect was confirmed. Whether the product should allow multiple active sessions remains a product-policy question; no code changed. See [Round 15](red-team/ROUND-15-DISTINCT-CREATOR-LOGIN-LINKS.md) and its [fixture](red-team/fixtures/ROUND-15-DISTINCT-CREATOR-LOGIN-LINKS.sql).

## October 14, 2026 — recovery link opened during deletion

- **Used:** Personal `concurrency-reasoning`, `red-team-auditing`, and `falsifiable-testing` to reproduce the ordering window, assert that a rejected early attempt does not consume the token, and run a negative control. Personal `surgical-patcher` was used to make the one-line bilingual client copy change with a unique anchor and a backup.
- **Finding:** `sendCreatorLink` persists and sends the recovery link before the delete batch changes the room to `trashed`. A link opened in that interval returns 410; the token stays unused and succeeds after deletion completes. Actual local Wrangler D1 confirmed the pre-trash rejection and post-trash success using a staged room transition; exact email/delete interleaving used the Worker with synthetic storage and intercepted email.
- **Change:** Updated the client failure message to say the room may still be finishing deletion, tell the user to refresh after a few seconds, and request another link if it continues. No API or database behavior changed.
- **Verification:** The automated test failed under a temporary mutation that consumed the token before the room-state check; after reverting the mutation, `npm test` passed 35 tests across 9 files, `npm run build` and `git diff --check` passed. See [Round 16](red-team/ROUND-16-RECOVERY-DURING-DELETE.md) and its [fixture](red-team/fixtures/ROUND-16-RECOVERY-DURING-DELETE.sql).
- **Limit:** No provider, real inbox, production DB, or deployed Worker was used. The client does not automatically retry.

## October 14, 2026 — recovery-versus-purge race and deadline alignment

- **Used:** Personal `concurrency-reasoning`, `red-team-auditing`, `variant-analysis`, and `falsifiable-testing` to probe the recovery/purge invariant and trace the related token expiry path. Personal `audit-before-patch` and `surgical-patcher` guided the reproduced, narrow Worker change.
- **Concurrent purge induction:** Thirty-two recovery requests and the scheduled Worker task were launched together against an expired synthetic room in isolated local Wrangler D1. The cron returned 200; recovery returned 400 for all requests after the purge removed the token. D1 showed no room, recovery token, or account. A full synthetic room with its dependent rows was also purged and checked for zero remnants. No partial-state defect was confirmed in this expired-room race.
- **Finding and fix:** A second fixture with a future room deadline but expired token returned 400 to all 32 requests. The scheduled handler removed the stale token while preserving the room and recovery snapshot. Code inspection showed recovery-token TTL began before the email provider call, while the room's seven-day clock began after that call. The delete batch now updates the specific token expiry to the room's `recovery_until`, only after the room enters `trashed`.
- **Regression and verification:** A Worker test advances the synthetic clock by eight days while the mocked email provider call is pending, then confirms the token is valid for the full room window and recovers successfully. `npm test` passed 36 tests across 9 files; `npm run build` and `git diff --check` passed. Both local D1 inductions used `/tmp/aporia-round17-d1`; no email provider or production environment was contacted. See [Round 17](red-team/ROUND-17-RECOVERY-PURGE-EXPIRY.md) and its [fixture](red-team/fixtures/ROUND-17-RECOVERY-PURGE-EXPIRY.sql).
- **Limit:** Exact deadline equality and a real delayed provider response remain untested; see the report for the full boundary.

## October 14, 2026 — exact recovery deadline equality

- **Used:** Personal `concurrency-reasoning` to name the shared room/token state and compare both operation orders; personal `falsifiable-testing` to make the exact timestamp an asserted boundary; and `audit-before-patch` to verify the live comparisons before deciding whether production code needed a change.
- **Induction:** The committed regression uses a frozen clock and synthetic storage. A temporary local integration experiment then invoked the actual exported Worker handlers in Node with a Wrangler `getPlatformProxy` D1 binding. Recovery committed one millisecond before expiry and the cron preserved the recovered room and session. In the opposite ordering, recovery passed all reads before expiry and paused before its D1 batch; the clock advanced to the exact deadline, cron purged the room/token, and the resumed batch returned 409 without creating a session. A direct D1 predicate check at timestamp equality returned false for both recovery predicates and true for both purge predicates. The local integration used a minimal synthetic lifecycle schema; no full migration replay or workerd runtime was involved.
- **Disposition:** The live predicates are complementary at equality (`>` for recovery, `<=` for purge), so no production-code defect was confirmed and no application code changed. The suite now covers the boundary and the local verification count is 37 tests across 9 files; build and diff check pass. See [Round 18](red-team/ROUND-18-RECOVERY-EXACT-DEADLINE.md).
- **Test integrity and limit:** A first test run found the synthetic adapter incorrectly removed recovery tokens in the login-only cleanup path; that modeling bug was corrected. Changing the live token comparison from `<=` to `<` made the equality test fail (400 became 410); the mutation was reverted. The temporary local D1 harness was removed after the run. Deployed scheduling and behavior inside Cloudflare's workerd runtime remain open.
