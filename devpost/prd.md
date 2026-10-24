---
doc: prd
status: approved
---

# APORIA — Product Requirements

An event-based shared chat and planning space for people who have just met and want to coordinate what to do together afterward. Source: `scope.md > The Unique Kernel`, `Who It's For`, and `The Core Loop`.

## The Core Journey

1. Someone at a talk or event creates an APORIA room and gets a meeting number to share with the group. The exact number format and how it is presented remain for the technical plan.
2. Other attendees enter the number. They can see the available options and read the shared space before deciding whether to participate. No one has to select a role before entering.
3. A person who wants to participate chooses a name or nickname, then answers room questions and adds ideas or availability. The app does not ask for extra personal details.
4. The group uses the shared chat and APORIA's planning flow to coordinate an after-party. Chat messages are short coordination updates. Text or a screenshot can be submitted in the planning flow; Gemini extracts useful information, including availability, area, and dietary restrictions. Every extracted fact remains a proposal until a person approves it. Raw images are deleted after processing.
5. The website offers a `Demo` mode in which a judge can click through the observer and participant experiences using an ordinary single-person image example, without supplying their own photos. The demo does not simulate the unusual duplicate-image case; that behavior is implemented in the real product flow. A separate real flow is also available. The demo should make visible how AI helps reduce disorganization and friction and helps the group optimize an outing.
6. After the event, the room creator closes the room. It becomes read-only, with no new contributions. The group is thanked and pointed to another room for a future get-together.
7. The creator can request deletion of the room and its data. During the seven-day recovery period, the creator can restore an allowlisted snapshot without attendee names or chat. It may include proposed places, the next meeting's code, and counts of people who signed up and attended. For the hackathon, APORIA does not promise that this snapshot is anonymous. After seven days, room data is permanently deleted automatically.

The intended real-world success is that the group has the after-party, enjoys it, and decides to create another room for a future gathering. A demo can show the app journey; it cannot prove a future offline gathering has already happened. Source: `scope.md > What "Working" Looks Like`.

## Screens and Layout

- **Start:** create a room, enter a meeting number to join, or open the `Demo` flow.
- **Event room:** show the shared chat and available options. People can read first and participate voluntarily. The room also contains the current planning experience and screenshot flow.
- **Closed room:** communicate that the event is over, thank participants, and point to another room. The room becomes read-only; existing content remains available to read.
- **Delete/recovery:** the creator requests deletion of the room and its data. Recovery is through the creator's account during the seven-day period. Exact email provider and what the creator sees while the room is in the trash are technical details for the specification.

These surfaces follow the learner's stated product flow; detailed layout and interaction states are still being defined.

## Look and Feel

Youthful, minimalist, simple, and welcoming to neurodivergent people. Avoid complexity and overwhelming the person using it. The learner prefers Markdown document reviews; no additional HTML planning interface is needed.

## Features and Behavior

### Joining an event room

Source: `scope.md > The Core Loop` and `The POC Boundary`.

- Attendees can join an existing room by entering its meeting number.
- On entry, people can read the available options without first choosing a role.
- Participation is voluntary and progressive: people can start contributing by answering room questions or adding ideas and availability.
- Each person is represented by a name or nickname. The app does not ask for personal details beyond that.
- Access is intended for people who met at the event and have the meeting number, not random people browsing the internet. The precise access boundary must be specified technically.

### Shared chat and planning

Source: `scope.md > The Unique Kernel`, `The Core Loop`, and `The POC Boundary`.

- Room attendees can see the shared chat space.
- The room supports the existing text and screenshot intake, Gemini-assisted extraction, human confirmation, candidate planning, and constraint evaluation. Dietary restrictions are a requested new section; the current constraint model does not implement them.
- People can follow the group's context and options without being forced to interact.
- The chat is for functional updates such as traffic, arriving late, or not attending; it is not a social feed. Anyone in the room can read and post. Chat updates in real time.
- Each person may post at most five messages per room, without exception. Screenshots and availability belong in their own sections, not in chat.
- The planning experience has a distinct dietary-restrictions section. It is informational only: it must not filter, rank, or otherwise constrain candidate places. Gemini can extract dietary information from an uploaded image without displaying the image or unnecessarily revealing its personal source details to the group.
- Repeated information from the same participant must not be counted twice. A matching image or fact from another participant remains that participant's independent evidence. Duplicate handling belongs in the real product flow, not the judge demo.

### Screenshot demo and data handling

Source: `scope.md > What "Working" Looks Like` and `The POC Boundary`.

- Reviewers can choose `Demo` mode on the website and click through observer and participant behavior with a supplied image example, without bringing their own photo. They can also choose the real flow.
- The image-submission flow must be reproducible end to end for judges using a supplied sample image; judges do not need to provide their own image.
- Uploaded images are available to Gemini for extraction and must be deleted after processing. They are not a shared gallery item. This is the learner's clarified requirement and supersedes the earlier answer that images should remain available to the group.
- Gemini should extract useful planning information without unnecessarily exposing personal source details. Repeat uploads by one participant must not double-count the same fact. A matching submission from another participant remains separately attributed evidence. The duplicate case is implemented in product code but is not part of the judge demo.
- At the time this PRD was drafted, source code stored image bytes in extraction proposals. The October 12 implementation increment now redacts image bytes before persistence and response, and adds a migration to redact already stored image payloads. This behavior has not yet been verified against a migrated D1 database.

### Closing, deleting, and recovering a room

Source: `scope.md > The Core Loop` and `The POC Boundary`.

- Closing marks the event as finished and makes the room read-only, with no new contributions. The group is thanked and pointed toward a separate room for a future event. APORIA is intended to help with event coordination rather than become a general social network.
- The room creator can delete a completed room.
- The creator can recover a deleted room through email during a limited period before the room and its data are permanently deleted.
- A restored room omits chat and attendee names and contains only the current recovery allowlist, such as proposed places, the next meeting's code, and sign-up/attendance counts. For the hackathon, APORIA does not promise this snapshot is anonymous.
- A closed room can be reopened in read-only mode to recall proposed places. Reopening removes names, chat, source submissions, and participant-linked facts, retaining only the proposed options and an aggregate participant count.
- A seven-day trash period followed by automatic permanent deletion is approved.
- After creating a room, the creator is asked for the event context/title (for example, “After post Hackathon”). Google sign-in is the recommended option; registration using a disposable email must also be available. The creator's chosen account/email is used for recovery.
- **Current implementation:** the creator recovers through the one-time email link sent when deleting the room. There is no separate trash dashboard, and the deleted room is hidden from number lookup.

## States and Boundaries

- **New room:** the creator needs a clear way to share the meeting number.
- **Joined but observing:** the attendee can read available options and shared chat without posting.
- **Participating:** the attendee can answer questions and add ideas or availability under a name or nickname.
- **Invalid meeting number:** the person needs a clear explanation and a way to request the correct number from the room creator.
- **Analysis failure:** show a static image with an error message and a touch of humor, as the learner requested.
- **Demo flow:** judge can click through observer and participant behavior using a supplied image example, or choose the real flow.
- **Closed room:** event is marked finished; the room is read-only, has no new contributions, and directs the group to another room.
- **Deleted room / trash:** the creator requests deletion of the room and its data. Recovery by the creator's account is possible for seven days and restores the allowlisted non-chat summary; names are removed. For the hackathon, anonymity is not promised. After seven days, the data is automatically deleted permanently.

## Product Decisions

- The room is for people who met at an event and want to meet again, not random people on the internet.
- Reading is allowed before participation; no one needs to choose a role before entry.
- A name or nickname is enough; collecting more personal details is out of scope.
- The main room should include a shared chat visible to the group.
- Users should be able to enter an existing room by meeting number, in addition to creating a room.
- Closing makes a room read-only and prevents new contributions.
- A closed room can be reopened only in read-only mode to recall limited event details.
- The creator can request deletion of a room and its data; accidental deletion should be recoverable by email before permanent deletion.
- After a successful gathering, the old room should be deleted before the next event so context does not carry over between events.
- Judges can choose a `Demo` mode that lets them click through observer and participant behavior with a supplied screenshot, or use the real flow.
- The learner considers zero-knowledge identity protection overengineering for this proof of concept.
- Dietary restrictions are collected and shown for information only; they do not affect candidate ranking or feasibility.
- Google sign-in is optional and recommended for speed. The creator may instead register with a disposable email; that account is the recovery account.
- Gemini-extracted information requires human approval before becoming a confirmed fact.
- A seven-day trash period with automatic permanent deletion is approved to limit ongoing cloud storage.
- Duplicate facts from one participant are idempotent; a matching contribution from another participant remains separately attributed. This is real product behavior, not a demo-only simulation.
- Keep the existing React/TypeScript, Cloudflare Worker, D1, and Gemini architecture. Source: learner instruction and `scope.md > The POC Boundary`.

## Learner clarifications — October 24, 2026

- For the hackathon presentation, do not promise anonymity for the recovery snapshot. The existing documented fields remain; no recovery fields were removed. This is a hackathon communication decision, not a proof that retained data is anonymous.
- If the creator reopens a room while deletion is waiting for recovery-email delivery, deletion should still complete. Round 20 already exercised this order locally; the learner confirmed that this behavior is the desired policy.
- Use five people as the hackathon demo planning target. The video may show 20 or fewer people; the exact number depends on the script and is undecided. These are presentation targets, not a hard product capacity or a Gemini usage/spend quota. No code limit or global budget is approved by this answer.

## What We're Building

- A room creation and meeting-number entry flow for an event group.
- A shared room chat that people can read before choosing to participate.
- Minimal identity through a name or nickname.
- The existing AI-assisted group-planning flow.
- A distinct informational dietary-restrictions section that does not filter candidate places.
- Human approval of extracted facts and duplicate-safe updates in the real planning flow.
- A website demo that can replay the image flow using an ordinary example, without staging a duplicate-image scenario.
- Room closure and creator-initiated deletion, with accidental-deletion recovery by email.
- Creator account/recovery through optional Google sign-in or disposable email.
- A room lifecycle that lets a group finish one event and start fresh for another.

## Deferred From the POC

- A broad ephemeral social feed beyond the event room: the learner wants APORIA to fulfill a specific coordination purpose, not become another social network.
- Zero-knowledge identity protection: the learner considers it overengineering for this proof of concept.
- Post-hackathon clones can be independently deployed with the operator's own backend and provider credentials; that is deployment guidance, not a separate in-product self-hosting flow.

## Possible Later Enhancements

A richer ephemeral community experience may be considered later if it serves event coordination without turning APORIA into a general-purpose social network.

## Non-Goals

- Replacing the current app architecture.
- Requiring real names, profiles, or detailed personal information.
- Building a general-purpose social network.
- Adding zero-knowledge identity infrastructure to this proof of concept.
- Claiming privacy guarantees beyond the access and retention behavior that is actually implemented and verified.

## Open Questions

- Product requirements are approved. Remaining technical choices and implementation details are recorded in `spec.md > Decisions and Open Issues`.


## Implementation checkpoint — October 12, 2026

The repository contains code for meeting-number entry, observer-first chat, creator email magic links and repeat access requests, close/reopen-read-only/delete controls, seven-day recovery, hourly purge, and exact-origin CORS with an optional Vercel host pattern for separately hosted frontends. Recovery preserves candidate names, schedules, and prices while removing area and participant-linked data. The creator can optionally record the attendance count and provide an active next-room code; the registered count is derived from room participants. Creator email requires Resend and Worker configuration; Google sign-in is not implemented. Migrations 0001–0005 are applied to local Wrangler D1, but this repository does not have a production D1 configured. Email delivery, browser flows, cross-origin behavior, and deployment have not been verified. The guided demo status changed on October 24; see the current implementation note below.

### Implementation update — October 24, 2026

The landing page now links to a browser-local sample walkthrough at `?mode=demo`. It uses fictional room data, a prepared interpretation of the synthetic screenshot, and the existing deterministic evaluator; it does not call Gemini or the room API. `?mode=recording` opens the real app flow with a visible recording label; run it locally with Gemini configured to make real provider calls. The demo is not a real Gemini extraction.
