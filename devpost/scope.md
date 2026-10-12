---
doc: scope
status: approved
---

# APORIA

APORIA is an event-based shared chat and planning space for people who meet at an event and want to coordinate what to do together afterward.

## The Unique Kernel

Each event gets its own shared space: attendees can join by meeting number, follow the chat together, and organize what to do next. The space has a deliberate end: the group can close it and, after a successful gathering, delete it before starting a fresh space for another event. Accidental deletion must be recoverable. Existing AI-assisted planning with Gemini remains part of APORIA's distinctive workflow.

## Who It's For

People who meet at a talk or event, may not already be friends, and need to coordinate a post-talk plan with a group. Some may start by reading the shared chat and contribute later.

## The Core Loop

Someone creates an event space and shares its meeting number. Attendees enter that number and can read the shared chat before contributing. They use the chat and planning flow to coordinate an after-party. Once the gathering succeeds, the group closes and deletes that event's room so the next event starts in a clean space. If someone deletes a room by mistake, they can recover it.

The learner's desired real-world outcome is that the group has the after-party, enjoys it, and decides in that room to create another room for a future get-together. The demo can show the planning flow and the next-room action; it cannot prove in advance that a future real-world gathering was enjoyable. The plan should include a distinct dietary-restrictions section for information only; it must not be used to filter or rank places.

## Inspiration & Identity

The learner wants a youthful, minimalist experience that feels simple and welcoming to neurodivergent people, without overwhelming them. They described a possible future small real-time chat with an ephemeral social-network feel; that is a later idea, not part of this proof of concept.

## Why This Matters to the Learner

The learner wants to use APORIA with people they meet at events to coordinate what to do after talks. They want to see whether ideas from the official skills can be adapted to their own skill collection without following those skills literally.

## What "Working" Looks Like

The proof of concept should let reviewers enter a room by meeting number, see a shared chat, follow the planning flow, and observe a room being closed and deleted after the event. The intended real-world outcome is that the group enjoys the after-party and chooses to create another room for a future get-together. An accidental deletion should be recoverable. A demo can show the product behavior without claiming that a future real-world gathering has already happened.

Judges need to replay the image flow without providing their own photos. The learner later clarified that uploaded images should be visible to Gemini for extraction and deleted after processing, rather than retained for the group. Duplicate facts from one participant are handled idempotently, while matching facts from different participants retain their attribution. A synthetic fixture is now present at `public/demo/availability-sample.png` and can be loaded into the ordinary screenshot preview; a guided one-click demo mode is not implemented. This later clarification supersedes the earlier answer that images should remain available to the group.

## The POC Boundary

- Keep APORIA's existing React/TypeScript client, Cloudflare Worker, D1 data store, and Gemini integration.
- Center the proof of concept on event attendees coordinating a post-talk plan in a shared room.
- Add room entry by meeting number and a shared chat that all room attendees can read.
- Keep the current planning flow, including AI-assisted extraction, human confirmation, candidate planning, and constraint evaluation.
- Include a distinct informational dietary-restrictions section in the planning experience. It is implemented outside the constraint model and does not affect candidate feasibility or ranking.
- Let the group close and delete a completed event room, with a way to recover accidental deletion.
- Preserve the existing text/image intake, human confirmation of extracted facts, candidate planning, and constraint evaluation unless a later approved plan narrows them.
- Let judges replay the image-submission flow without bringing their own image. Gemini processes uploaded images, which should be deleted after processing. A synthetic fixture is implemented; the guided Demo mode remains to be built.

## Later

- A broader ephemeral social feed beyond the shared event-room chat.
- A per-group self-hosting model; its relationship to the learner's intended shared backend is still undecided.

## Explicitly Cut

- Replacing the existing architecture: the learner explicitly asked to keep it.
- Treating this proof of concept as a complete privacy or production-readiness solution: room access, image retention, deletion permissions, and recovery need deployment verification and broader abuse controls.

## Current Project State (updated October 12, 2026)

- **Implemented in source:** room creation and link-based joining, meeting-number lookup, read-only observer access to options/chat, D1-backed chat with a server-enforced five-message cap, text and screenshot submission, Gemini extraction, contributor-only claim approval, image preview confirmation and redaction of image bytes and derived image metadata after processing, informational dietary notes, same-person duplicate recognition, manual and AI-proposed candidate plans, deterministic evaluation, and relaxation suggestions.
- **Persistence present:** additive migrations `0003_meeting_codes_chat.sql` and `0004_creator_accounts_lifecycle.sql` add meeting codes, room messages, per-claim review decisions, creator accounts, and lifecycle state; they also redact prior image payloads. Both migrations have now been applied to the local Wrangler D1 for endpoint probing; no production D1 has been configured or migrated.
- **Implemented in code; partially verified locally:** synthetic D1 probes exercised single-use creator-link consumption, owner-only close/reopen, anonymization, recovery, and the scheduled purge. Live email issuance and the successful delete-plus-email flow remain unverified because Resend is not configured. Recovery retains only approved option details and aggregate counts; Google sign-in is absent.
- **Still missing:** guided one-click demo mode, broader abuse controls, deployed D1 setup, email delivery, browser/email verification, and final validation of external frontend hosting. Exact-origin CORS, an opt-in Vercel origin pattern, and the configurable frontend API origin are implemented in source but not deployed or cross-origin verified.
- **Verification:** `npm run typecheck` and `git diff --check` pass. Direct Worker+D1 local probes verified room lookup, observer chat reads, joining, five-message enforcement, replay handling, claim attribution/ownership and duplicate handling (including one same-claim race), creator-link consumption/expired-link rejection, close/reopen, recovery, purge, rejection of wrong JSON types/media types, and basic malformed-JSON/body-size boundaries. Three confirmed defects were fixed and retested. The red-team round remains open; live email issuance, successful delete/email, recovery-expiry boundary timing, broad concurrency, deeper body-stream boundaries, full build, browser behavior, and deployment remain unverified. Historical test claims in project documentation are not current verification.
- **History:** the repository's initial commit on September 25, 2026 contains scaffolding; product direction and app code appear in later commits that day. This scope was drafted on October 12 from the learner's answers and repository state, not from a plan that existed in September.

## Remaining Implementation Choices

- Configure and validate Resend email delivery and the app origin in the target Worker environment; Google sign-in is optional future work.
- Configure the shared backend's exact allowed origins and abuse/cost limits before external frontends use it.
- Add the synthetic image fixture and judge-facing demo flow without using the duplicate case as its fixture.
- The initial chat uses two-second polling; the hourly Worker Cron Trigger handles purge. Measure usage before adding a push transport.
