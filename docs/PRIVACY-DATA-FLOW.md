# APORIA privacy and data flow

**Checked:** 2026-10-23. This is an application-side map plus current published Gemini API terms. It is not a claim that every platform-side copy or retention setting has been verified.

## What a participant sends

| Action | Sent to APORIA | Sent to Gemini | What APORIA persists |
|---|---|---|---|
| Join a room | Display name | Nothing | Name in the room snapshot and participant row; a session token is kept in browser local storage. |
| Send a chat message | Message text and session token | Nothing | Message and author in the room database; room messages are readable by anyone with the room link or meeting number. |
| Ask APORIA to understand text | Text, participant display names, room/session context | Submitted text and participant display names | After the provider responds, APORIA stores a redacted artifact without submitted text or its hash, plus extracted source snippets and claims while review is pending. A snippet is erased from D1 when its claim is decided. |
| Ask APORIA to understand a screenshot | Image bytes, MIME type, session token | Screenshot bytes, prompt, and participant display names | After the provider responds, APORIA stores a redacted artifact without image bytes or fingerprint metadata, plus extracted source snippets and claims while review is pending. A snippet is erased from D1 when its claim is decided. |
| Find ideas | Room goal, confirmed constraints, session token | Room goal and confirmed constraints | Pending suggestions and provider metadata. A participant must accept suggestions before they become room candidates. |
| Request creator access or deletion recovery | Creator email and room context | Nothing | One-time link and creator-session records. Resend sends the creator email; its provider-side retention was not checked here. |

APORIA retains active and closed room material until the creator reopens the room or moves it to trash. Reopening removes participant-linked contributions and chat. Trash keeps an allowlisted recovery snapshot for seven days, followed by scheduled purge. The exact behavior and limits are described in [README privacy and hosting](../README.md#privacy-and-hosting) and the [screenshot flow audit](red-team/ROUND-9-SCREENSHOT-DATA-FLOW.md).

## Gemini API data use

The app uses the Gemini Developer API `generateContent` endpoint. APORIA sends requests with `x-goog-api-key`; the project operator controls the key and its billing tier. The application does not expose or verify that tier, and this audit did not inspect credentials or the provider account.

Google's currently published [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms?hl=en) distinguish unpaid and paid services:

- **Free/unpaid services:** Google may use prompts, uploaded files, and responses to provide, improve, and develop products and machine learning technologies. The terms say human reviewers may read, annotate, and process input and output for quality and product improvement. They instruct users not to submit sensitive, confidential, or personal information to unpaid services.
- **Paid services:** Google says it does not use prompts, uploaded files, or responses to improve products. This does not mean zero retention: its [data-retention guidance](https://ai.google.dev/gemini-api/docs/zdr?hl=en) says prompts and responses may be logged for a limited period for abuse monitoring, safety, and required legal or regulatory disclosures.
- The [logging guide](https://ai.google.dev/gemini-api/docs/logs-datasets) says `generateContent` requests are not stored by default for API logs; that is distinct from the limited processing described in the paid-services terms and is not a zero-retention guarantee.

Therefore, do not describe APORIA as having zero provider retention. A public operator should verify the project tier and current Google terms before accepting real participant data. This repository cannot confirm the tier configured for any running instance.

## Request limits and aggregate usage

The Worker configures independent burst limits of five extraction requests and five candidate-discovery requests per room-participant pair per 60 seconds. This helps bound repeated use by one participant. Cloudflare documents these Worker rate-limit bindings as approximate and local to each Cloudflare location; requests can exceed the configured threshold before counters synchronize, and locations do not share a worldwide counter ([Cloudflare Rate Limiting docs](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), checked 2026-10-23).

APORIA does not currently apply a strict shared daily/monthly call quota, track token usage/cost, or set a provider spend ceiling. Multiple rooms, participant identities, locations, retries, or distributed callers can increase aggregate provider usage. Google project quota and billing settings remain operator-controlled and were not checked. Do not treat the per-participant burst limits as a cost guarantee.

## Other stores and unknowns

- **Cloudflare Worker/D1:** stores room snapshots, events, participants, proposals, chat, and lifecycle state. The code paths are mapped; account-level backups, point-in-time recovery, request/trace logs, support access, and operator exports were not audited.
- **Browser:** room participant and creator session tokens are stored in `localStorage`; browser extensions, shared devices, and user-created screenshots or exports are outside APORIA's deletion controls.
- **Resend:** sends creator links. Provider-side message retention and deletion controls were not verified.
- **Vercel:** the intended frontend deployment is not configured or verified yet. The prior Webflow version is separate; this document does not claim Vercel holds APORIA room data.

## Sources

- [Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms?hl=en), effective March 23, 2026; checked October 23, 2026.
- [Zero data retention in the Gemini Developer API](https://ai.google.dev/gemini-api/docs/zdr?hl=en), checked October 23, 2026.
- [Gemini API logs and datasets](https://ai.google.dev/gemini-api/docs/logs-datasets), checked October 23, 2026.
