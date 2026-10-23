# Round 43 — Bound Gemini output before persistence and display

**Status:** Finding fixed and regression-tested locally. No live Gemini request, production service, D1 write, or browser session was used in this round.

## Threat model and scope

Gemini is an external dependency. Its response is treated as untrusted, whether it is malformed, unexpectedly large, or valid JSON with excessive records. The review covered the shared Gemini HTTP boundary and both consumers: extraction claims and candidate discovery. The objective was to bound data read by the Worker, parsed into proposals, and subsequently returned or persisted.

Out of scope: provider-side token/account quotas, billing ceilings, compromised credentials, Cloudflare edge behavior, and real Gemini response behavior.

## Finding R43-01 — AI output had no complete application-side size/cardinality contract

**CODE FACT (baseline `f1f491e`):** Gemini success and non-success bodies were consumed wholesale (`response.json()` / `response.text()`). Extraction mapped every claim, sliced ambiguity and warning counts without bounding string lengths, and accepted unbounded claim IDs. Candidate discovery sliced results to eight, silently hiding any excess output; warning lengths had no cap.

**PLAUSIBLE HYPOTHESIS:** A malformed or unexpectedly large upstream response could consume excess Worker memory/CPU and produce large proposal rows or responses. This round did not induce production exhaustion or establish provider behavior.

### Reproduction and prediction

Before patching, three synthetic parser cases were added and run with `npx vitest run src/intelligence/schema.test.ts`. Prediction: the assertions requiring rejection would fail because the values pass the parser. Observed: all three tests failed. The claim-count and warning cases directly showed acceptance; the combined identifier/ambiguity test stopped at the first failed assertion (the 129-character ID). Source inspection also showed no ambiguity-length check. After patching, identifier and ambiguity length each have a separate regression assertion and both reject the over-limit value.

### Fix

- Read Gemini success and error bodies through a streaming reader capped at 256 KiB, before JSON parsing. Oversize bodies fail as non-retryable `invalid_output`.
- Reject extraction output above 64 claims, claim IDs above 128 characters, more than eight ambiguity strings per claim, more than 16 warning strings, or any warning/ambiguity string above 500 characters. Existing source snippets remain capped at 500 characters.
- Reject more than eight candidate drafts instead of silently truncating to eight. Candidate warnings share the 16-item / 500-character limit.
- Keep generated fields as proposals; these limits do not change human confirmation or deterministic evaluation.

These are application response-shape ceilings. They do not impose Gemini output-token limits, provider quotas, or spend caps. They are implementation bounds, not a claim about the typical number of useful facts in a room.

### Variant analysis

The shared `generate()` function serves extraction and candidate discovery. The body cap therefore covers both successful consumer paths. The first review found that the non-2xx branch separately read `response.text()`; it was changed to use the same bounded reader and now has its own regression case. Parser siblings are covered independently for extraction cardinality/strings and candidate cardinality/warnings.

### Verification

At the time of this report, the focused regression suite and full application suite passed, along with TypeScript typecheck and production Vite build. Exact commands and final counts are recorded in the current round plan and README status. The oversized-body tests use synthetic `Response` objects without a supplied `Content-Length`, exercising the streaming counter rather than relying only on the header check.

**FALSIFIED within local scope:** the patched parsers no longer accept the tested over-limit values; successful and non-success Gemini response paths reject oversized bodies before JSON parsing. This does not establish an absolute platform memory ceiling or behavior of a deployed Worker.

## Remaining checks

- No provider-side `maxOutputTokens` or account budget was added; usage and spend remain governed by Gemini project settings and existing approximate request limiters.
- The 256 KiB, 64-claim, and text limits are technical choices. Revisit only if real product evidence shows valid responses need larger shapes.
- No live Gemini, Cloudflare, browser, or production verification was performed.
