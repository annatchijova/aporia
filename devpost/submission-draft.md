# Devpost submission draft — APORIA

**Status:** Draft for review. Not submitted. The product video and the final public demo target are still pending.

## Project name

APORIA

## Tagline

Turn the post-event group chat into a plan everyone can check.

## What it does

After a talk or community event, people often want to keep hanging out, but the useful details end up scattered across messages, screenshots, availability, and half-formed ideas. APORIA gives the group an event-specific room they can enter with a meeting number, follow through shared chat, and use to turn those contributions into a plan.

Gemini helps interpret submitted text and screenshots and can propose candidate plans. Those suggestions remain proposals: contributors review extracted information, and APORIA's deterministic evaluator checks candidate plans against the group's confirmed information. When no plan fits, APORIA can show bounded changes that would make one possible. This keeps the group—not the model—in charge of what is true and what counts as a workable plan.

Rooms are designed to end with the event. A creator can close a room in read-only mode, delete it, and recover a limited read-only snapshot during a seven-day window. It omits attendee names and chat but retains candidate details, aggregate counts, and an optional next-room number, so it is not guaranteed anonymous. Creator email delivery must be configured before that lifecycle can be demonstrated on a hosted instance.

## Who it's for

People roughly 25–40 who meet at talks, meetups, or community events and want to coordinate what to do afterward—even when they do not already know one another well. APORIA is for groups that need one shared place to see the conversation and turn scattered input into a decision.

## What we learned

A useful boundary for AI-assisted group decisions is to let the model interpret and suggest, while people confirm the underlying information and deterministic code checks whether a plan satisfies it. Keeping that boundary visible in the product makes the result easier to explain and challenge than a chatbot answer presented as consensus.

The planning documents also helped us distinguish the requested product from the parts already implemented, so the room lifecycle, image handling, and event-specific purpose could be worked into the existing architecture without replacing it.

## Built with

React, TypeScript, Vite, Cloudflare Workers, Cloudflare D1, Google Gemini API, Codex, and the Devpost Learn Skill Pack for the initial learner interview and planning documents.

## Project links

- **Public repository:** https://github.com/annatchijova/aporia
- **Demo video (1–3 minutes):** Pending recording against the final product flow.
- **Hosted app:** Do not add a URL until we verify it serves this repository's current build. Cloudflare staging is deployed but its public route is disabled.

---

## Internal readiness notes — do not paste into the Devpost description

- The repo's initial commit is dated September 25, 2026, within the event's stated submission period. Git history begins with the license and project scaffolding, followed by the app implementation.
- `devpost/scope.md`, `devpost/prd.md`, and `devpost/spec.md` exist. The spec currently has `status: draft`.
- `docs/DEVPOST-SKILLS-LOG.md` records `1-start` through `4-spec` on October 12. It also records that the original app implementation predated that planning flow and that subsequent implementation used the owner's personal skills. Do not claim the official pack generated the existing app code or that all six skills built it.
- Cloudflare staging has a separate D1 database with migrations 0001–0005 applied, its own rate-limit namespaces, and an hourly cleanup trigger. The Worker and assets uploaded successfully, but `workers_dev` is disabled and the app has not been exercised through a public staging URL.
- No Gemini or Resend secrets are configured for the staging Worker. Gemini-backed image extraction and creator email delivery therefore need configuration and verification before they are shown as live on staging.
- The README's Webflow link has not been verified against the current repository build. Do not present it as the current hosted app until checked.
- Devpost requires a 1–3 minute video that shows the project working and a public repository URL. Confirm repository visibility and record the end-to-end flow after the product work is complete.
