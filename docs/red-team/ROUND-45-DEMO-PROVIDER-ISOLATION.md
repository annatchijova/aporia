# Red-team Round 45 — sample-demo provider isolation

**Status:** local browser induction passed for the sample walkthrough; the ordinary recording path was not exercised in this round.
**Date:** 2026-10-24.
**Threat model:** a judge opens the app's `?mode=demo` route and follows the visible sample. The browser is instrumented for outgoing JavaScript `fetch` calls. This checks the delivered walkthrough; it does not treat client code as a server-side security boundary or prevent a user from manually calling public endpoints outside the demo.
**Invariant:** the sample walkthrough must use fictional local state and must not call the room API or Gemini. Its prepared interpretation must be visibly identified as a sample.

## Evidence

- **CODE FACT:** `App` selects `DemoExperience` for `mode=demo` before rendering `LiveApp`. The demo module imports the deterministic reducer/evaluator and styles; it has no API client or `fetch` calls. Its only remote-looking resource is the same-origin static screenshot fixture at `demo/availability-sample.png`.
- **CONFIRMED BY INDUCTION (local Chrome):** Vite served the app at `http://127.0.0.1:5173`. A Chrome DevTools Protocol harness instrumented `window.fetch`, navigated to `/?mode=demo`, and clicked sample entry, join, screenshot, sample interpretation, and confirmation controls. The fixture loaded (`naturalWidth > 0`), the UI rendered “Lectura preparada para esta demo · no es una respuesta de Gemini”, and the existing `evaluateSnapshot` path returned the expected feasible sample option. The instrumented fetch list was empty; no room API or Gemini call occurred.
- Reproduction harness: [`verify-demo-isolation.mjs`](fixtures/verify-demo-isolation.mjs). Start Vite on port 5173 and Chrome with DevTools on port 9223, then run `node docs/red-team/fixtures/verify-demo-isolation.mjs`.

## Scope and limits

- The browser-local demo does not persist room, participant, message, or confirmation state. Reloading restarts the sample.
- The synthetic screenshot is a normal same-origin static asset request; it is not an API or provider request.
- The app's regular route was not tested with a real Gemini credential in this round. It remains the path for local product recording.
- No deployed site, Cloudflare Worker, D1 database, real email, or real Gemini API was used.
- This is a product-mode separation and demonstration property, not an authorization guarantee against a user who bypasses the UI and directly calls a public API.

## Disposition

The sample mode meets the requested “no real Gemini call” behavior under the tested browser walkthrough. `?mode=recording` is an explicit alias for the regular app with a visible mode label; with a configured local Gemini key, its normal extraction actions use the live provider. The recording path itself was not tested in this round. No server code, provider configuration, or API contract changed.
