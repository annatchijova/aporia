---
doc: spec
status: draft
---

# APORIA — Technical Specification

This plan maps the approved requirements in `prd.md` onto the existing React, TypeScript, Cloudflare Worker, D1, and Gemini project. It describes real behavior in the app; the judge demo may use a prepared example, but chat, duplicate handling, room lifecycle, and deletion are not demo-only simulations.

## How This Works, In Plain Language

APORIA has a website and a server. People use the website to enter a room, read or write short updates, and add planning information. The server checks every action, stores the room in D1 (a hosted SQL database), and sends images to Gemini to turn them into suggestions. The image is not kept by APORIA after Gemini replies. A person reviews each suggestion before it becomes part of the shared plan.

The first chat implementation stores messages in D1 and refreshes the room view every two seconds. D1 remains the source of truth, and the app stays on its existing Worker. This is near-real-time polling, not a WebSocket push connection; a Durable Object can be considered later if measured traffic or latency calls for it. A scheduled server task will check the trash and permanently delete room data after seven days.

Creators can register with any email address through a one-time link and can request another login link using the account email if their creator session is lost. Google sign-in is not implemented. Attendees enter through the room link or meeting number and do not provide email. Configure `RESEND_API_KEY`, `CREATOR_EMAIL_FROM`, and `APORIA_APP_ORIGIN` as Worker variables/secrets before email registration or recovery can work. A scheduled Worker purges expired trash hourly. The official hackathon instance is temporary; people who clone the project afterward deploy their own copy and configure their own Gemini key or provider.

## The Core Journey Through the System

Implements `prd.md > The Core Journey`.

1. The creator starts a room, supplies its event title/context, and receives a random numeric meeting code. The creator can verify an email afterward to enable lifecycle controls; attendees do not need email.
2. An attendee enters the meeting code. The Worker looks up the room and returns its read-only view. The attendee can read before choosing a nickname and joining as a participant.
3. A participant posts a coordination message. The Worker verifies the room session and the five-message cap, writes the message to D1, and clients refresh the chat every two seconds.
4. A participant sends text or an image for extraction. The Worker sends it to Gemini using `generateContent`; raw image bytes remain only in the request path and are discarded after the response or failure. Gemini's structured claims are saved as pending proposals. A person approves a claim, and the Worker applies it to the room's canonical state. Repeated equivalent claims from the same participant are deduplicated; another participant's contribution keeps its attribution.
5. Dietary restrictions appear as information alongside the plan. They are not passed to feasibility or ranking logic. Candidate plans continue to be evaluated by the existing deterministic evaluator.
6. The creator closes the room. The Worker changes its lifecycle status; all writes are rejected and reads remain available. Reopening it later removes chat, names, source submissions, and participant-linked facts, and preserves only candidate options and an aggregate participant count in read-only mode.
7. When the creator deletes the room, the Worker immediately removes chat, names, raw/source artifacts, proposals, and other identifying data. It keeps only an allowlisted recovery snapshot without names or chat for seven days. The creator may restore that snapshot read-only. A scheduled cleanup deletes the remaining room record and snapshot when the seven-day window expires.

## Stack

- **Client:** React 19, TypeScript 5.9, and Vite 7, already present in `package.json`. [React](https://react.dev/learn), [TypeScript](https://www.typescriptlang.org/docs/), [Vite](https://vite.dev/guide/).
- **Server and static assets:** Cloudflare Workers with the existing `ASSETS` binding in `wrangler.json`. The Worker can serve the API and built site from one origin, or accept configured frontend origins using exact or optional Vercel-pattern CORS. [Workers](https://developers.cloudflare.com/workers/).
- **Durable storage:** Cloudflare D1, already configured and used for rooms, participants, sessions, events, proposals, and candidates. Schema changes go into additive numbered SQL migrations. [D1](https://developers.cloudflare.com/d1/).
- **Chat update path:** D1-backed message history with two-second client polling for the initial implementation. This avoids adding another runtime service while keeping clients current in a short interval. A Durable Object is not part of this first implementation.
- **AI:** Gemini REST API, already called server-side from `src/intelligence/gemini.ts`. Keep the API key in Worker secrets; never expose it in Vite/client variables. Use a synthetic demo image that contains no real person's data. [Image understanding](https://ai.google.dev/gemini-api/docs/image-understanding), [Gemini API terms](https://ai.google.dev/gemini-api/terms).
- **Creator account:** one-time email links use Resend. Configure `RESEND_API_KEY`, `CREATOR_EMAIL_FROM`, and `APORIA_APP_ORIGIN` in the Worker environment. Google sign-in remains unimplemented.

Versions above are the versions declared in the current project manifest, not a new dependency install or a fresh compatibility check. Avoid adding a client-side database or replacing the current architecture.

## Where It Runs and How Someone Tries It

- **Local client and Worker:** install Node.js and Git, run `npm ci`, apply local D1 migrations with `npx wrangler d1 migrations apply aporia --local`, and start the full Worker/static-assets app with `npx wrangler dev`. Open the local URL printed by Wrangler. Set `GEMINI_API_KEY` as a local Worker secret or development binding for real Gemini extraction; without it, the existing app returns a provider-unavailable error.
- **Local client only:** `npm run dev` starts Vite, but the room API still needs the Worker. It is not the complete app by itself.
- **Official deployed app:** the hackathon instance is intended to run during the challenge and uses a shared central backend. A separate frontend can build with `VITE_APORIA_API_ORIGIN=https://<worker-origin>` after the backend operator configures `APORIA_ALLOWED_ORIGINS` with exact origins, or deliberately opts into `https://*.vercel.app` for Vercel-hosted frontends. That wildcard permits any HTTPS Vercel origin and is only a browser CORS rule, not authentication. The backend operator owns and pays for the shared D1, Gemini, and email services. Public lookup, room creation, and joining now have per-source burst caps, but provider quota accounting and distributed-abuse controls are not implemented, so the shared backend is not ready for arbitrary traffic. The current `wrangler.json` is a local-oriented D1 configuration (`database_id: "local"`), not a ready-to-deploy production database. Production binding, allowed origins, email delivery, provider credentials, and broader abuse/cost controls still need setup.
- **Self-hosted clone:** Apache-2.0 permits cloning and modifying the code. A clone uses its own Worker, D1, and provider credentials after configuring them; it does not inherit access to the official shared backend or its Gemini key.
- **Submission:** the hackathon still requires a short demo video and a public repository; a live deployment is an additional way to try the app, not a substitute. Record a browser journey with multiple participants, real chat updates, human approval, room closure, deletion, and recovery.

The learner confirmed that the official APORIA instance is a shared backend during the challenge and that a frontend may be hosted elsewhere. The Worker supports exact-origin CORS through `APORIA_ALLOWED_ORIGINS`, with an optional `https://*.vercel.app` host pattern for Vercel deployments; the client accepts `VITE_APORIA_API_ORIGIN` at build time. Exact frontend origins remain the default, and the operator must opt into a wildcard pattern. CORS does not authenticate callers or replace abuse/cost controls. The public shared-backend configuration and those controls still need deployment. Apache-2.0 permits clones to run their own backend; it does not grant access to APORIA's shared database or Gemini key.

## Look and Feel

Carry forward `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`: youthful, minimalist, simple, welcoming to neurodivergent people, and calm enough to avoid overwhelming someone. Keep the current React/CSS client and its Spanish/English support. Prefer clear states and compact steps; no new framework or separate planning interface.

## Components

### Room entry and creator identity

The Worker supports meeting-code lookup and creator ownership. Attendees can enter by number, read without posting, then join under a nickname. Creator authentication uses one-time email links; creator-only lifecycle actions require the verified creator session. The owner can request a fresh login link for the room's registered account email. Google authentication is not implemented. Cross-origin API requests use exact origins configured by the backend operator, with an opt-in HTTPS Vercel host pattern.

Implements `prd.md > Joining an event room` and `prd.md > Closing, deleting, and recovering a room`.

### Shared room chat

Add a D1-backed message store and server-side write limit of five messages per participant per room. Read-only observers can read; participants can post while the room is active. Clients refresh the messages every two seconds. Closed, trashed, and recovered rooms reject new chat writes.

Implements `prd.md > Shared chat and planning`.

### Planning intake, extraction, and approval

Keep the existing Gemini provider, claim schema, and human confirmation model. The person who uploaded a screenshot must approve its extracted proposal. Before upload, show the screenshot preview and ask that person to confirm it. Extend claim/schema handling for a distinct informational dietary note, but do not add it to `Constraint`, candidate feasibility, ranking, or relaxation calculations.

On image requests, validate MIME type/size as today, send inline data to Gemini, and never persist the source bytes in `proposals.artifact_json`. Persist only the minimum proposal data needed for review. Raw image content is not retained by APORIA after the request completes. The person who submitted a contribution approves its extracted claims; the image preview is confirmed before upload. The source snippet is shown in that uploader's local review UI, and the room receives only confirmed structured facts. The Worker checks that an attributed participant ID belongs to the same room, so a claim cannot create a constraint for a ghost participant.

Implements `prd.md > Shared chat and planning` and `prd.md > Screenshot demo and data handling`.

### Duplicate-safe facts

Use the confirmed participant ID, claim kind, and canonical structured value to recognize an already-confirmed equivalent fact from the same person. Treat repeated submissions as idempotent for that person. Keep another participant's equivalent fact separately attributed. Do not use the duplicate case as the judge demo fixture.

Implements `prd.md > Shared chat and planning` and `prd.md > Screenshot demo and data handling`.

### Room lifecycle and recovery

Room statuses now include active, closed, trashed, and recovered-read-only, with creator ownership and lifecycle timestamps. Closing blocks contributions while existing content remains readable. Reopening a closed room removes chat, participant names, source submissions, proposals, events, and sessions; it preserves candidate names, schedule, prices, and an aggregate participant count. Deletion is available after closing and removes the same personal/contribution data. It keeps a seven-day recovery snapshot with candidate names, schedule, price/currency, a participant count, an optional creator-entered attendance count, and an optional code for another active room. Reopened and recovered rooms remain read-only. An hourly scheduled Worker removes expired room records and recovery snapshots from the active D1 database, then removes creator accounts and sessions that no longer own any room or have an unexpired auth link.

Implements `prd.md > Closing, deleting, and recovering a room`.

### Browser client

Extend `src/client/App.tsx` and `src/client/styles.css` with the meeting-number entry, shared live chat, informative dietary section, creator/account flow, and close/delete/recover screens. Keep language/accessibility behavior aligned across Spanish and English. The website demo can seed a normal screenshot example, but must use the real proposal and approval path; no simulated duplicate case.

Implements `prd.md > Screens and Layout`, `prd.md > Shared chat and planning`, `prd.md > Screenshot demo and data handling`, and `prd.md > Closing, deleting, and recovering a room`.

## Data Model

D1 remains canonical. Add additive migrations rather than replacing current tables:

- `rooms`: add unique `meeting_code`, `creator_account_id`, `status`, `closed_at`, `deleted_at`, and an allowlisted recovery snapshot/expiry. The snapshot may contain only approved nonpersonal data (such as proposed place names and aggregate attendance counts), never names, chat, image bytes, or source text.
- `creator_accounts`: account ID, verified email, auth provider/subject, and timestamps. Do not store OAuth access tokens if identity verification alone is enough.
- `room_messages`: ID, room ID, participant ID, bounded body, created time, and an idempotency key. Enforce the five-message limit on the server; client-side counting is not sufficient.
- `proposals`: retain structured claims, warnings, provider metadata, status, and participant attribution. Replace or remove persisted raw `artifact_json` for images; text evidence must follow the approved source visibility policy. Keep the room snapshot schema versioned and provide a migration path for existing JSON snapshots when adding the dietary information kind.
- Existing `participants`, `sessions`, `events`, `candidates`, and `candidate_proposals` continue to serve active rooms. Add lifecycle checks so no mutation endpoint can write to a closed or recovered-read-only room.

For deletion, explicitly delete child rows before removing a room because the existing foreign keys do not declare cascading deletes. The recovery snapshot is an allowlist, not a copy of the room snapshot. Reopening a closed room read-only is distinct from restoring a deleted room.

### Data flow and retention

```text
Browser -> Worker -> Gemini (inline image/text)
                    <- structured proposal
       -> D1 (proposal only; never raw image bytes)
Human approves -> Worker -> D1 confirmed fact -> room broadcast
Room delete -> D1 allowlisted recovery snapshot (7 days)
Scheduled cleanup -> D1 permanent application-level purge
```

The Worker can delete its own D1 copy; that does not erase what an external AI provider may retain or how the provider may process the request. See the Gemini privacy decision below. Avoid logging request bodies, image data, or source text.

## File Structure

```text
aporia/
├── src/
│   ├── client/
│   │   ├── App.tsx                 # Extend entry, chat, account, plan and lifecycle screens
│   │   ├── main.tsx                # Existing React entry point
│   │   └── styles.css              # Extend the existing visual system
│   ├── core/
│   │   ├── model.ts                # Add informational dietary fact and room lifecycle types
│   │   ├── reducer.ts              # Apply approved facts and lifecycle events
│   │   ├── evaluator.ts            # Keep dietary info out of feasibility/ranking
│   │   └── ...                     # Existing artifact, canonical and relaxation logic
│   ├── intelligence/
│   │   ├── gemini.ts               # Extend extraction schema; keep key server-side
│   │   ├── schema.ts               # Parse dietary note and duplicate-safe structured claims
│   │   └── ...                     # Existing provider contracts/candidate schema
│   ├── worker.ts                   # Room-code, chat, auth, lifecycle and purge API
│   └── realtime/
│       └── room-object.ts          # Proposed Durable Object WebSocket broadcaster
├── migrations/
│   ├── 0001_initial.sql            # Existing schema
│   ├── 0002_candidate_proposals.sql # Existing schema
│   └── 0003_rooms_chat_auth.sql    # New additive schema (final number after inspection)
├── public/                         # Synthetic ordinary demo image fixture, no duplicate case
├── wrangler.json                   # D1, assets, Durable Object and scheduled trigger bindings
├── devpost/                        # Scope, PRD, spec and build checklist
└── package.json                    # Existing scripts and dependencies
```

## External Services and Dependencies

### Gemini API

- Current code sends `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` with `x-goog-api-key` and JSON `contents` plus a structured `generationConfig`. Image input is sent inline with `mimeType` and base64 `data`; do not use the Files API for this short-lived image flow.
- Secret: `GEMINI_API_KEY` in the Worker. Model defaults to `gemini-flash-latest`; current model availability and quotas must be rechecked in build/deploy.
- **Privacy and cost decision:** the official instance is temporary for the hackathon; do not enable paid usage that could charge the learner unexpectedly. After the challenge, people who clone the repository configure their own Gemini key or another provider and are responsible for reviewing that service's terms. On quota or provider failure, extraction must fail clearly without storing the image. Google's external processing and retention are outside APORIA's deletion controls.
- Source: [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding), [current Gemini API terms](https://ai.google.dev/gemini-api/terms), [pricing and data-use comparison](https://ai.google.dev/gemini-api/docs/pricing).

### Cloudflare Workers, D1, and Durable Objects

- Worker is the existing API and static asset origin; D1 stores rooms and events. Chat currently uses D1 polling, with no Durable Object binding. See [Workers](https://developers.cloudflare.com/workers/) and [D1](https://developers.cloudflare.com/d1/).
- New production environment needs a real D1 database ID, migration application, secret bindings, and any selected Durable Object binding. Current repo config contains a local placeholder ID.
- A Worker Cron Trigger runs hourly, removes expired one-time tokens and sessions, and purges up to 100 expired room records per run. A backlog can therefore delay physical purge by more than one hour. This describes deletion from the active D1 database, not provider-level processing or platform backup retention. See [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).
- Cloudflare limits, current free/paid plans, and live deployment configuration have not been verified during this planning pass; check before choosing a public shared API.

### Creator authentication and email

- Room creators register with a one-time email link; disposable email addresses are accepted. Google sign-in is not implemented. Attendees join using a link or meeting number and do not provide email. The verified creator account is linked to its rooms for lifecycle controls and recovery.
- Email sign-in uses a one-time link delivered through Resend; no passwords or OAuth access tokens are stored. Configure the sender and app origin, and verify deliverability before the demo. Creator-link requests are throttled to one per minute per room/email. Broader abuse controls and Google sign-in remain future work.
- API reference: [Resend email API](https://resend.com/docs/api-reference/emails/send-email).

## Important Failure Modes

- **Gemini unavailable, rejected, or too slow** → keep the image out of D1, show the existing humorous extraction error, and let the person retry. Never create a confirmed fact on failure.
- **Brief polling delay or network failure** → keep the last successful chat view visible and retry on the next two-second refresh.
- **Expired recovery window or purge task failure** → recovery says the room expired; scheduled cleanup retries safely and reports internal operational errors without restoring expired data.
- **Meeting code invalid or lookup throttled** → explain that the number could not be found and ask the attendee to check with the creator; the Worker applies a 30-per-10-second per-source burst cap to code lookup. This is not global enumeration protection.

## What Was Simplified and Why

- Keep D1 as the one durable source of truth and use short polling for chat updates; this avoids adding another service while the workload is small.
- Send images inline to Gemini and do not persist or reuse them; this matches the learner's delete-after-processing rule and avoids the separate Files API lifecycle.
- Keep dietary restrictions as informational facts rather than decision constraints; this avoids silently excluding coffee or other options.
- The judge demo uses a normal image path rather than pretending the unusual duplicate case is common. Duplicate handling still ships in the real product code.

## Decisions and Open Issues

### Decisions recorded from the learner

- Keep the existing React/TypeScript, Worker, D1, and Gemini architecture.
- Implement shared chat, meeting-number entry, room close/delete/recovery, real-time updates, and duplicate handling in the product flow.
- Limit each participant to five chat messages per room.
- Keep extracted data pending until human approval; make screenshots invisible to the room, and delete their raw bytes after Gemini processes them.
- Dietary restrictions are displayed for information only; never filter/rank places with them.
- The creator can choose Google or disposable email; that account is used for recovery.
- Use a seven-day trash period, then automatically delete room data.
- Build for a genuinely usable APORIA deployment. Demo mode is a convenient entry path, not a substitute for real product behavior.

### Configuration and remaining work

- **Gemini usage:** the learner wants the official page available for the hackathon period and does not want a surprise paid bill. Clones configure their own provider key and are responsible for reading that provider's terms. Google's external data processing remains outside APORIA's control.
- **Email login:** creator email verification uses Resend one-time links; disposable email is accepted. Configure Worker credentials and verify delivery. Google sign-in remains future work. Attendees join by link or meeting number without email.
- **Cross-origin backend:** exact-origin CORS and an opt-in `https://*.vercel.app` origin pattern, plus a frontend API-origin setting, are implemented. The wildcard allows all HTTPS Vercel frontends and is not authentication. Public room lookup/create/join burst caps are implemented using Cloudflare Worker bindings; the shared backend still needs provider quotas, distributed-abuse controls, its production allowed-origin list, and deployment configuration.
- **Creator trash view:** recovery uses the email link during the seven-day period. No separate trash dashboard is implemented; deleted rooms do not appear in room lookup.
- **Recovery deletion scope:** the approved seven-day expiry means permanent removal from APORIA's active D1 database. Gemini processing and platform backups have separate retention behavior.

The learner's technical answers are recorded in `docs/preguntas.md` and translated in `docs/questions.md`. The implementation resumed with the learner's personal skills after the learner explicitly instructed us to stop using the isolated Devpost skill pack. The first increment added meeting-number lookup, observer access, D1-backed chat with a server-enforced five-message limit, screenshot preview confirmation, contributor-only claim approval, post-processing image redaction, informational dietary notes, and same-person duplicate handling. The next increment added creator email magic links, owner-only close/reopen-read-only/delete controls, a seven-day anonymized recovery snapshot, and hourly purge scheduling. Exact-origin CORS with an optional Vercel pattern, frontend API-origin configuration, and per-source burst caps on lookup/create/join are now present in source. Migrations 0003–0005 are applied to local Wrangler D1 only; no production database is configured or migrated. Demo seeding, Google sign-in, provider quota accounting, distributed-abuse controls, production configuration, and end-to-end verification remain outstanding.

## Implementation checkpoint — October 12, 2026

| Area | Current state | Verification |
|---|---|---|
| Meeting numbers | Eight-digit number is generated for new rooms; a number lookup opens the room. | Not run in a deployed Worker. |
| API request boundary | JSON body routes require `application/json`, reject non-text/non-number JSON types instead of coercing them, and cap bodies at 2,100,000 bytes. | Direct local Worker probes rejected `text/plain`, malformed JSON, oversized payloads, object fields and numeric strings; normal JSON calls remained functional. Browser and deployment behavior are not verified. |
| Observer-first entry | A visitor can read current options and chat before choosing a nickname. | Not browser-verified. |
| Shared chat | D1-backed messages, two-second refresh, 280-character message limit, five messages per participant per room enforced by the Worker/D1 insert. | Direct API probe against migrated local D1 confirmed observer reads, valid joins, five accepted posts, sixth-post rejection, idempotent replay, and fabricated session rejection. Not browser-tested or run against production D1. |
| Screenshot approval and retention | The uploader sees a preview and must confirm before upload; only that uploader can approve each claim. Image bytes and derived hash/MIME/size metadata are redacted from new proposal persistence and responses; migration 0005 removes those fields from previously stored image proposals. | Migration 0005 was applied to local D1 and replayed against a synthetic legacy image row; the artifact retained empty content/hash and no MIME/size fields. No Gemini-backed extraction or browser flow was run. |
| Room lifecycle and creator account | Creator email magic links, owner-only close/reopen-read-only/delete-after-close, seven-day recovery, and hourly purge are implemented. Reopening anonymizes the room; recovery restores candidate names with schedule and price, the registered count, optional attendance count, and optional next-room code while omitting area and participant data. Recovered-room snapshot reads require the owning creator session; active and closed observer reads remain public. Google sign-in is absent; Resend/Worker configuration is required. | Synthetic local D1/Worker probes exercised single-use link consumption, owner authorization, close/reopen anonymization, recovery identity checks, scheduled purge, and the recovered-room read matrix: anonymous/invalid/unrelated-creator denied, owning creator allowed, active observer allowed. Live email issuance and successful delete-plus-email are not verified; the new reauthentication screen was not browser-tested, and no production deployment test was run. |
| Dietary information and duplicate-safe facts | Gemini can return informational dietary notes, shown separately and excluded from plan evaluation. Canonically identical facts for the same participant are recognized; claims in one proposal can be reviewed individually. The Worker rejects attribution to IDs outside the room. | Synthetic local D1 probes confirmed unknown attribution is rejected after fixing R1-01; assignment to another real room member remains valid. A duplicate approval returns `duplicate: true` without a new fact or revision; replay after completion returns 409. Two simultaneous reviews yielded one success and one completed-proposal 404 without duplicate writes. Gemini extraction remains untested. |
| Demo fixture and cross-origin hosting | A synthetic screenshot fixture can be loaded into the ordinary preview/confirmation flow. A guided one-click demo mode, provider quota accounting, and distributed-abuse controls remain missing. Exact-origin CORS, the opt-in Vercel pattern, frontend API-origin setting, and burst caps for public lookup/create/join are implemented; deployment configuration remains outstanding. | Static asset and CORS code added; local rate-limit boundaries and CORS preflights exercised, but cross-origin browser and deployed edge behavior are untested. |

No automated test suite or full build, email send, browser flow, or deployment was run for this checkpoint. Targeted local adversarial probes are recorded in `docs/red-team/ROUND-1-LOCAL-ENDPOINTS.md` and `docs/red-team/ROUND-3-PUBLIC-ABUSE.md`. Migrations 0003–0005 were applied to local Wrangler D1; production setup remains outstanding.
