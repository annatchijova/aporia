# APORIA demo script

## Five-minute reviewer path

1. Create a room called `Plan después de la charla` and use a demo nickname.
2. Copy the invite link or note the eight-digit meeting number. Open it in a second browser/device to show the observer view; enter a nickname there only if you want to participate.
3. In the contributor view, choose **Use sample screenshot**. APORIA loads the synthetic fixture from `public/demo/availability-sample.png` into the existing screenshot flow.
4. Review the preview and explicitly check the confirmation box. The fixture says: “El sábado puedo después de las 20. Soy vegetariana.”
5. Submit it through the regular Gemini extraction endpoint. Explain that the image is sent for processing but its bytes are not persisted by APORIA.
6. Review the extracted suggestion. The contributor must approve it before it becomes a group fact. Dietary information appears in its own informational section and does not affect ranking.
7. Add or discover a candidate, accept any Gemini suggestion explicitly, and show APORIA's deterministic evaluation against confirmed constraints.
8. Send one short coordination message from each participant to show the shared chat. Close the room from the verified creator account to demonstrate read-only behavior.
9. If time permits, show the creator email registration and explain the seven-day recovery path. Do not claim delivery or deletion is live until the Worker secrets and D1 migrations have been configured and exercised.

## What to say

> APORIA separates interpretation from decision. Gemini reads messy human input and proposes structure. People confirm it. Then APORIA's deterministic engine checks the plans and explains what would have to change when nothing fits.

## Fixture provenance

`public/demo/availability-sample.png` is synthetic. It contains no real person's data. It was generated with the personal `imagegen` skill for this repository, then added as a public static asset so the reviewer can load it without finding a file on their device. The sample button only preloads the normal image picker state: it does not upload, extract, or confirm anything by itself.

Prompt used:

> Create a believable cropped phone messaging screenshot showing one synthetic message: “El sábado puedo después de las 20. Soy vegetariana.” Use the generic sender label “Demo”, correct Spanish accents and punctuation, no recognizable app branding, no other messages, no real names, phone numbers, identifiable avatars, logos, personal photos, dates, locations, or watermark. Generic interface icons are acceptable. Portrait 9:16 mobile screen crop, crisp flat UI screenshot, neutral light interface with subtle lavender accents.

## Honest boundary

Screenshots are limited to PNG, JPEG, and WebP up to 1.5 MB. The fixture follows the same preview confirmation and extraction path as a user-selected screenshot. Gemini suggestions are not verified facts or live venue data. A public deployment needs migrations 0003 and 0004 applied, its server-side Gemini secret configured, and creator email variables configured before the corresponding flows can be presented as live. A landing-page guided Demo mode is still not implemented; this script uses an ordinary room and clearly marked sample content.
