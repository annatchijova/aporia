# Privacy review — APORIA
## Red Team Round 38: Gemini data provenance and service tier

**Date:** 2026-10-23  **Method:** `data-provenance-mapping`, `red-team-auditing`, `claim-provenance-discipline`
**Scope:** Application-to-Gemini request contents, APORIA persistence, current published Gemini API data terms, and user-facing disclosure. No API account, key, production database, or provider request was accessed.
**Base:** `main` @ `a821c48` (before this round's changes).

## Threat model

- Participants may enter planning details or screenshots that contain personal information.
- The APORIA backend operator controls the Gemini key/project and may choose its service tier.
- Google and infrastructure providers process data according to their current terms and configured account settings.
- No claim is made about a running instance's Gemini tier, provider logs, backups, or retention settings; those were not inspected.

## Epistemic legend

`CODE FACT` · `DOCUMENTED PROVIDER POLICY` · `PLAUSIBLE HYPOTHESIS` · `CONFIRMED BY INDUCTION` · `UNKNOWN`

## Findings

| ID | Severity | Level | Finding |
|---|---|---|---|
| R38-01 | Privacy | CODE FACT + DOCUMENTED PROVIDER POLICY; deployment applicability UNKNOWN | APORIA sends user-selected text/screenshots and participant display names to Gemini, but the pre-send copy did not explain the processor or Google's tier-dependent data use. The deployed tier is unknown. |

## R38-01 — Provider data handling depends on an unverified operator tier

- **Code fact:** extraction sends the submitted text or screenshot and the room's participant display names to `GeminiProvider`. Candidate discovery sends the room goal and confirmed constraints. Text artifacts, extracted snippets, claims, and suggestions are persisted according to room lifecycle rules. For screenshot extraction, APORIA sends image bytes to Gemini, then stores a redacted image artifact without the original bytes or fingerprint metadata.
- **Prior user-facing copy:** the screenshot checkbox said the uploader agreed to share information in the image but did not name Gemini; the room overview did not describe which fields leave APORIA or link to data handling details.
- **Documented provider policy:** Google's [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms?hl=en) say unpaid services may use prompts, uploaded files, and responses to improve products and may use human reviewers. Paid services are not used for product improvement, but Google's [retention guidance](https://ai.google.dev/gemini-api/docs/zdr?hl=en) says limited prompt/response logging may occur for abuse monitoring and required legal or regulatory disclosures. The [logging guide](https://ai.google.dev/gemini-api/docs/logs-datasets) says `generateContent` requests are not stored by default for API logs; that is not a zero-retention guarantee.
- **Applicability:** APORIA's source does not establish whether a particular deployed key uses a free or paid project. We did not read credentials, query Google, or make a live call. No statement about APORIA's current key tier is warranted.
- **Fix:** The room overview now names fields sent by extraction and idea discovery, tells users to avoid sensitive information, and says Google's data use depends on the operator's plan. Screenshot confirmation explicitly agrees to send the image to Gemini. A persistent link opens the detailed privacy map. README describes Free/Paid differences and states that APORIA cannot verify the running key's tier.

## Data stores and lifecycle map

| Store / processor | Data | Known behavior | Unknown / excluded |
|---|---|---|---|
| Browser local storage | Participant and creator session tokens | Used by the client to authenticate room/creator requests. | Browser extensions, shared-device copies, user exports. |
| Cloudflare D1 | Room snapshots, events, participants, messages, proposals, claims, creator links | Room lifecycle and seven-day trash recovery are described in code and project docs. Reopen strips names/chat/participant-linked contributions; trash retains an allowlisted recovery snapshot. | Account backups, point-in-time restore, traces/logs, support access and operator exports were not audited. |
| Gemini Developer API | Selected text/image and participant display names for extraction; goal and confirmed constraints for candidate discovery | Request composition is visible in source; image bytes are not persisted by APORIA after processing. Current provider data terms vary by project tier. | Active project tier, account settings, provider logs for the actual project, and actual data-retention periods. No external request was made. |
| Resend | Creator email address and one-time link message | Used for creator access and recovery emails. | Provider-side message retention and deletion controls were not verified. |
| Vercel | Intended frontend host | Vercel deployment is not yet configured or verified. | No claim that Vercel currently receives room API data. |

Full map: [privacy and data flow](../PRIVACY-DATA-FLOW.md). Earlier application-side screenshot mapping: [Round 9](ROUND-9-SCREENSHOT-DATA-FLOW.md).

## Discarded / limited vectors

| Vector | Result | Why |
|---|---|---|
| Claim that screenshot bytes remain in APORIA after extraction | FALSIFIED by code review and prior local tests | The image artifact returned and persisted by APORIA has empty content/hash and omits MIME type and byte length; this says nothing about the provider's copies. |
| Claim that the current key uses Google's Free or Paid tier | UNKNOWN | The tier is not in application config and no credential/account was inspected. |
| Claim of zero Google retention on Paid services | FALSIFIED by current published terms | The provider documents limited prompt/response logging for abuse monitoring and required disclosures. |
| Claim that `generateContent` request logs are enabled by default | FALSIFIED by provider logging guide | The guide says API logs are not stored by default, separately from its other processing and retention terms. |

## Verification and limits

Source paths reviewed: `src/worker.ts` (`createProposal`, `discoverCandidates`), `src/intelligence/gemini.ts` (`extract`, `propose`, `generate`), `src/client/App.tsx` (room disclosure, screenshot confirmation, and privacy link), and README privacy text. Provider policy sources were opened on 2026-10-23; source URLs and their applicable claims are recorded in the data-flow document. New unit tests check both language versions of the disclosure copy. `npm test` passed 45 tests across 11 files; local D1 suite passed 24; typecheck, build, and diff check passed. These checks cannot verify how a deployed provider account handles submitted data.

## Open disposition

Before accepting real participant data on a public instance, its operator still needs to confirm the Gemini project tier and settings, and decide whether use of any Free-tier project is acceptable. The app cannot make that decision or verify it automatically. Cloudflare and Resend retention, backups/logs, and browser-side copies also remain outside this round's verification.
