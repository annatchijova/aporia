# Questions for the Build With AI: Basics workflow

This file is the English translation of the questionnaire completed by the project owner in Spanish in [`preguntas.md`](./preguntas.md). **The Spanish answers are the originals; this copy translates each answer directly, preserving its wording, emphasis, humor, and rough edges.** This questionnaire is an interview record, not an approved plan. Some questions belong to later stages and will be revisited when those official skills are reached and the earlier planning documents are approved.

The answers will inform `devpost/learner-profile.md` (which will be added to `.gitignore` before it is created, as the skill requires), `devpost/scope.md`, `devpost/prd.md`, and `devpost/spec.md`. The public planning documents will distinguish the repository's current state, what is verified during this process, and what remains to be done. No current decisions will be presented as if they had been made in September.

## 1. Start — `1-start`

### Experience and working style

1. What experience do you have programming and using agents that work on a repository? If it helps, describe the tasks you have delegated to them.

   **Your answer:** Several months, always with LLM assistance, I started with repositories oriented toward DFIR and memory, they are like coworkers, to do things faster, I created 92 skills so I don't have to repeat the instructions a thousand times.

2. Have you worked with a workflow where you plan before coding? For example, defining scope, writing requirements, or putting together a technical specification.

   **Your answer:** Yes, always. I come from gastronomy and that's how it's done in a kitchen, so I bring that over to code.

3. What would you like to understand or improve while we work on APORIA with these skills?

   **Your answer:** If at least one of them I can adapt to my set of my own, many times I can notice something interesting in a skill without taking it literally.

4. Do you prefer brief or more guided explanations? Does it work better for you to answer one question at a time or to get small groups of related questions?

   **Your answer:** It depends on the task, I have ADHD, if I get overwhelmed a task has to be done in many small tasks, it depends on my executive functions, I wrote a skill called terminal first that is exactly for this.

### Initial idea — already shared; correct or add to it if needed

APORIA aims to help groups of friends organize plans when coordinating schedules, preferences, and options gets difficult. You want it to be useful and fun for people roughly 25 to 40 years old. You also want people to understand how to enter a room, how screenshots or photos are kept and shared, and what the privacy and hosting model means.

5. What would you change or add to this summary of the idea and what matters to you about the project?

   **Your answer:** that later there could be a mini “chat” in real time, almost like an ephemeral social network.

## 2. Scope — `2-scope`

These questions help define the small experiment we want to demonstrate. They do not imply that these features are already implemented.

1. In what specific situation would you use APORIA, and who would be in the group?

   **Your answer:** I would use Aporia with people who are NOT my friends but whom I meet at events and there are lots of us and we have to coordinate what to do post-talk, etc.

2. What is the minimum journey that would show APORIA solving that situation, from the moment someone arrives until the group gets a useful result?

   **Your answer:** The minimum journey is someone entering the room to OBSERVE without necessarily interacting at the start.

3. What gives APORIA its own identity? What would the group miss if it used a regular chat instead?

   **Your answer:** Integrated AI automation—Gemini in this case.

4. For this demo, what visible result would make you say, “This works”? What would you explicitly leave for later?

   **Your answer:** That it works end to end.

5. What style or feeling do you want the experience to have for that audience? You can describe it with references, colors, tone, or examples; you don't need to design an interface.

   **Your answer:** It should convey a youthful style, adapted to neurodivergence, without complexity and without overwhelming whoever uses it, minimalist.

## 3. Product requirements — `3-prd`

These questions are answered after reviewing and approving the scope. Here we define what people see and do, without deciding the architecture yet.

1. When someone opens a room link, what should they see if they haven't joined yet? What explanation do they need to know how to enter?

   **Your answer:** The available options.

2. Who can enter a room: anyone with the link, someone with a code or password, or another mechanism? What should the person sharing the link be able to do?

   **Your answer:** Only whoever has the link.

3. When someone uploads a screenshot or photo, what should happen next? Who should be able to see it, for how long, and what action should allow it to be deleted?

   **Your answer:** This is what I want to define.

4. What should the rest of the group see if text or image analysis fails, takes too long, or doesn't find useful information?

   **Your answer:** A static image with an error message but with a little bit of humor.

5. What should happen if a room is empty, if the link is invalid, or if someone returns to a room they already opened?

   **Your answer:** 1. If the room is empty, it's empty. There's not much magic there. 2. If the link isn't valid, ask the person who created the room again. 3. A user should be able to enter and leave the room as many times as they want while it still exists or until they are removed.

6. What concrete signs would show that the main journey works in the demo?

   **Your answer:** All the ones we manage to implement.

7. What part of the current interface do you like keeping, and what behavior seems confusing or incomplete?

   **Your answer:** I like how it is, but the room link should be more visible.

## 4. Technical specification — `4-spec`

These questions are answered after the PRD is approved. The repository already has a React/TypeScript app, a Cloudflare Worker, and D1. The specification will describe that existing architecture and any agreed adjustments; it won't replace it without an approved reason.

1. About your question on privacy and hosting: do you want the demo to represent a central instance where rooms and their data live in APORIA's service, or would you prefer each group to have its own instance? What do you need people to understand about this?

   **Your answer:** The demo is a demo, for that everyone should clone the repo, use our backend, the Gemini API which is free --it has a tier-- and deploy it wherever they think is convenient.

2. If someone clones the repository and deploys it themselves, do you expect them to use APORIA's central backend or configure their own backend and storage? Do you want this to be part of this demo or just explain it as a future possibility?

   **Your answer:** The repository has an Apache 2 license, whoever clones it can do whatever they want.

3. What expectations do you want to communicate about access to rooms and files: access by link, extra protection, deletion, or a retention period? If you don't know yet, write down what concerns you most.

   **Your answer:** How we are going to manage deleting the room, who has permission and what recovery mechanism exists.

4. Do you want the demo to run locally for recording the video, have an optional public deployment for people to try, or both?

   **Your answer:** Deployed.

5. What part of APORIA or this workflow raises the most questions for you and is something you'd like to understand better?

   **Your answer:** How screenshots are going to be organized, it's clear they will be there, but will only Gemini see them and process them, all of them at the same time or does Gemini summarize them all, etc.? What happens with duplicate screenshots?

## 5. Build — `5-build`

These questions will be revisited once scope, PRD, and spec are approved, and after the options have been explained.

1. For the implementation steps, do you prefer that we explain and verify each part before moving on, or make fewer pauses and review at agreed checkpoints?

   **Your answer:** Build—Red Team—Document—Fix—Commit—Push—Continue.

2. When the app is ready to try, what journey do you want to follow to confirm it meets what we defined?

   **Your answer:** The same one a normal group would do between 2 people, 4, 12, and up to 20, with different stress tests.

## 6. Submission preparation — `6-ship`

The skill says that you write the description and public Devpost answers yourself. I can point out missing information and correct spelling or grammar in text you wrote, but not write the submission for you.

1. Which part of the journey do you want to show in the demo video?

   **Your answer:** Okay, I'm a writer, I can write, but not in English. So I'll have to write my version and you translate it and present both. You don't need to correct my spelling.

2. When the time comes, what did you make, who is APORIA for, and what did you learn while building it? Answer in your own words for the Devpost form.

   **Your answer:** I'll do that when the time comes.

3. Do you already have a public repository and a video that reviewers can access, or will those need to be prepared at the end?

   **Your answer:** I already have them.

## Status record

- **State recorded on October 12, 2026:** The six official skills are installed in `hackathon-sandbox/.agents/skills/`. `devpost/learner-profile.md` has been created (ignored by Git), `devpost/scope.md` is approved, and `devpost/prd.md` was approved after the product answers. The technical specification starts after that approval.
- **Code:** No code was changed as part of the planning workflow. There are earlier uncommitted changes in the app and READMEs; treat them as existing state and review them against future decisions.
- **Implemented according to inspected code:** rooms, joining by link, text and image capture with Gemini-assisted extraction, fact confirmation, plan proposals, and constraint evaluation. D1 stores room state and extraction proposals when Gemini finishes successfully; confirmed facts are recorded in room state and events.
- **Pending according to inspected code:** rooms can be read using their UUID without session validation; images are stored inside a proposal only if Gemini finishes successfully; no view or route was found to list and retrieve those images, nor controls for deletion or retention. Extraction proposals are not synchronized among participants. These points will be verified and clarified in the specification before changes are decided.
- **Verification at this stage:** Git files and history were inspected. Tests were not run during this inventory. The technical README contains historical test results, which are not the same as a verification performed now.

## To review and approve the scope (`devpost/scope.md`)

The scope was presented as a draft and later approved with the clarification below. These answers document that first review; current open product questions are in the PRD section.

1. What visible result at the end would make you feel the group had coordinated something useful after the talk?

   **Your answer:** The after-party has happened, people have a good time, and they even decide in that room to create ANOTHER room for a next get-together.

2. When someone enters to observe, what can they see or do without participating? If they want to, how do they move on to contribute?

   **Your answer:** If they want to observe, they only have to read; if they want to contribute, start answering the questions and add ideas, availability, etc.

3. Is it a requirement for this demo that screenshots or photos remain available to the group? If so, is it enough for them to be visible in the room after upload, or do you also expect them to be grouped or summarized?

   **Your answer:** Yes, it is a requirement for the demo so judges can replay the end-to-end flow without putting in their own photos.

4. For the first plan review, would you rather read the Markdown here, or would you also like a visual HTML page with diagrams?

   **Your answer:** I don't need an additional graphical interface, I can read text.

## Scope clarification and approval — answer from October 12, 2026

> Look, I'll tell you quickly, I approve the plan, what I want to build is this space of “chat” that everyone can see and the possibility of closing the space, and right now there isn't a way to enter with the meeting number, only to create the space, and I want it to be possible to close it and how to recover a room deleted by mistake, and after the meeting successfully ends delete that room so we can create another one so that events don't get contaminated from one event to the next, that's what I mean.

This is recorded as the product direction and approval of the scope; behavior details move to the PRD questions.

## For the PRD (`3-prd`)

Answer these questions to define behavior before drafting `devpost/prd.md`:

1. When someone enters a meeting number, what should they see and be able to do in the chat? Who can read and who can post? Does each person appear under a name?

   **Your answer:** Participation is voluntary and gradual; nobody should be forced to choose a role before entering. Yes, a name has to appear, but not the details even about the dog, a name or nick is enough, it's an app to coordinate between people who just met at an event and want to see each other again, not random people from the internet. They can see the available options. If you want we can protect identity with ZK but it seems like overengineering to me haha.

2. What does closing a room mean for the people inside it? Can it be reopened afterward? Who can close or delete it, and how should recovery work if it is deleted by mistake?

   **Your answer:** Closing a room is the event ended, thank everyone, plan to meet again with the link to ANOTHER room so it's not one more social network but fulfills its function. The person who created it can delete it and it will be recoverable by email, you're the LLM, you know better how to create that.

3. So the judges can try screenshots without bringing their own photos, how would you like them to find a sample image? After a screenshot is uploaded, who can see it, and what should happen with duplicate images?

   **Your answer:** Have the flow to “demo” on the website and there they do it automatically.

## Clarification on closing, deleting, and recovery — answer from October 12, 2026

| Operation | Behavior |
|---|---|
| Close | The event is over. The room becomes read-only, with no new contributions. |
| Delete | The creator requests deletion of the room and its data. |
| Recover | The creator can restore it during a limited period, before permanent deletion. |

> My proposal would be a 7-day trash bin, with automatic permanent deletion when that period ends.

The seven-day duration is recorded as the learner's proposal and still needs approval as a requirement.

## Product interview answers (`3-prd`)

1. Does the chat need real-time updates? What can be posted there: text messages, screenshots, or both? Who can post and who can read?

   **Your answer:** No, the chat doesn't fulfill anything social, it has to be restrictive, no screenshots, the screenshots go in the screenshots section, availability in the availability section, the chat is used to report, for example, that there's traffic, that someone will arrive later or not come. Aporia isn't a social network; it's the ease of coordinating social gatherings of heterogeneous people, for example if people meet at tech events or “Mundolingo”. Anyone can post and we could put a limit of 5 messages per person so it's understood clearly.

2. In the `Demo` button or section, what does it mean for the flow to run automatically? What should the judge see or be able to do during that demo?

   **Your answer:** The judge touches the buttons and simulates being an observer and also a participant if they choose demo mode, they can also choose the real flow. What they should be able to see is how, thanks to AI, disorganization is resolved, an outing is optimized, and friction is eliminated.

3. Should a closed room be reopenable? To recover a room by email, when is the creator's email entered, and what can they do during the seven-day trash period?

   **Your answer:** Yes, a room can be reopened but in READ-ONLY mode, for example to remember a place proposed but rejected by that function, the names of those who interacted must be deleted, only data that has nothing to do with chat or personal data can be recovered, only proposed places or recover the code for the next meeting, for example, or remember how many signed up, how many went, nothing more.

## PRD clarifications — answers from October 12, 2026

These are the learner's latest answers; earlier answers about keeping images available are superseded by the image-deletion clarification below:

1. Does the chat need real-time updates? Is the five-message limit per person and per room?

   **Your answer:** Yes, the chat has to update in real time. The limit is 5 per person and room without exception, maybe 5 is a lot, but sometimes things happen and there have to be opportunities to communicate.

2. Who can see a room's screenshots? What should happen with duplicate screenshots? Since room recovery only restores nonpersonal data that is not chat content, should images be permanently deleted along with the room?

   **Your answer:** The most practical thing is for Gemini to see the screenshots and extract the information, for people who find it hard to write, the screenshots should be like “I'm Marta, I can Tuesday or now, I'm from this area, I don't eat meat.” Gemini doesn't necessarily have to reveal that information, but update the plan. Hmm there should be the food restriction section. Add it. Yes, the images are deleted, what's more, have them deleted after Gemini processes them. If there are duplicate images from the same person I hope the LLM knows it's a mistake and we make the prompt right so it doesn't take the same data twice, and if another person uploads the same screenshot that's a funny coincidence, but Gemini would see if something changes anyway.

3. When should the app ask for the room creator's email? Do you approve the proposed seven-day trash period, with automatic permanent deletion when it ends?

   **Your answer:** The email is asked for after creating, for what they want the event: “After post Hackathon”, Anna creates it for example, and one can log in with Google.

   **Still to clarify:** whether Google sign-in is required or optional, and whether that account is the recovery email. This answer does not approve or change the proposed seven-day trash period.

**Your answer:** Yes, I approve it and add the food restrictions, but only for INFORMATIONAL purposes, not so Gemini limits; maybe they only want to go for a coffee, but I want it to exist for informational purposes.

## PRD follow-up questions — answers from October 12, 2026

1. Is Google sign-in mandatory or optional for whoever creates the room? Is that account also used as the email to recover the room?

   **Your answer:** Google is the recommended and fastest option, but if someone prefers to register with a disposable email because they fear that Interpol will come looking for them, that option should exist. Yes, that is the recovery account for whoever creates the room.

2. After Gemini extracts information, does it update the plan directly or do we keep the current human confirmation step?

   **Your answer:** It is put under human approval.

3. Do you approve a seven-day trash period with automatic permanent deletion at the end of that period?

   **Your answer:** Yes. Let's take care of the planet, because existing in the cloud has a cost.

4. If different people upload the same image, should it be counted as one shared piece of data or as evidence from each person? What example image do you want to use in the demo?

   **Your answer:** I don't want to use the duplicate case for the demo because it is a hypothetical and unlikely situation. I want it implemented in the code because I like thinking about impossible situations, not because I think they happen. I want this to be a product and not just a prototype; I myself want to use it at my upcoming social gatherings.

The PRD status was recorded as `approved`. The technical specification begins after that approval.

## Technical-specification questions (`4-spec`)

Current state (October 12, 2026): the PRD is approved and `devpost/spec.md` has been created as a draft with the official `4-spec` skill. No code was changed. The spec remains unapproved until its open technical/privacy questions are resolved and the document is reviewed.

1. The current code sends the image to Gemini in the same request, but the project uses the free quota. Google's current terms say content sent through free services may be used to improve its products and may be reviewed by people, and advise against sending sensitive, confidential, or personal information. Do you want to keep that quota for the demo with a notice and consent before upload, or use a quota with billing enabled for this flow? The paid option has its own costs, which also need to be checked.
2. Who approves an extraction before its data becomes visible to the whole group: the person who contributed the screenshot, or any room participant?
3. For disposable-email registration, my technical recommendation is a one-time sign-in link without a password. Does that work for you alongside optional Google sign-in?
4. Do you confirm that APORIA's official instance owns a shared central backend for everyone, while people can host their frontend wherever they want? Someone cloning the repo could point to that backend if the public API and its limits allow it, or configure their own backend.

   **Your answer:** What is going to happen is that this page is going to exist for the hackathon because once the tier is exceeded, they charge me, that's why I said, put instructions on how each person makes their free page with their Gemini etc. and each person is responsible for reading the terms and conditions of a service. That is, hackathon ends = THAT page ends, the demo etc. can remain. Then the user who liked it clones the repo, deploys using the free Gemini API key or whoever they want and deploys wherever they want.

2. Who approves an extraction before its data becomes visible to the whole group: the person who contributed the screenshot, or any room participant?

   **Your answer:** The person who contributed the screenshot, in case they uploaded something else by mistake haha, just in case, if it's not too much effort, make them re-confirm the preview of the screenshot they uploaded, nobody wants to see photos that aren't related haha.

3. For disposable-email registration, my technical recommendation is a one-time sign-in link without a password. Does that work for you alongside optional Google sign-in?

   **Your answer:** You're confused. Email registration is for whoever creates the room, the participants enter with a link, not with email.

4. Do you confirm that APORIA's official instance owns a shared central backend for everyone, while people can host their frontend wherever they want? Someone cloning the repo could point to that backend if the public API and its limits allow it, or configure their own backend.

   **Your answer:** That's what I've been saying from the very beginning and a big clue to this is that the repository has an Apache 2 License.

## Shared capacity and costs — partially answered

To implement limits without blocking a normal gathering or leaving resource use open, what is the maximum number of participants per room, and what Gemini usage quota should each room have during the hackathon? The local probe reached 20 participants and 20 options, but that does not define the product maximum. We also need to know whether you prefer a strict cap on calls per room or a maximum usage/cost budget.

**Technical information for this decision:** the current limit of five calls per operation is tied to a participant ID. The code creates a new identity and session on each room entry, including when the same person joins again; therefore, that limit can be renewed by rejoining. Cloudflare also applies its counters approximately and separately by location. There is currently no total allowance per room or global budget.

**Your answer:** Yes, that's fine. For the hackathon, the demo is 5; for the video I'll do 20 or fewer, I haven't decided yet, it'll depend on the script.

This records planned sizes for the demo and video; it does not set a general participant maximum or a Gemini usage/spend quota. Those limits must not be implemented as if they had been approved.

## Lifecycle clarification — answered

If you start deleting a room and sending the recovery email is still pending, while that is happening you reopen it from another tab, what should happen when the send finishes?

- The deletion completes and the room goes to the trash.
- Reopening cancels the pending deletion. What should happen to the email that has already been sent?
- Something else.

Status: question raised by red-team Round 20. For this case, the answer is that deletion should complete even if the email is already pending.

**Your answer:** I think this is a very convoluted question for a hackathon. Let the deletion be completed.

## Scope of recovery data — answered for the hackathon

Your PRD answer says recovery should keep only information that is not personal: proposed places, the next meeting's code, and counts, with no names or chat. Current code keeps free-form option titles, schedules and prices, counts, and an optional next-room code. It does not check that a free-form title contains no name or personal detail, and a count from a small group could allow inferences. Only the room creator can read the recovered summary, but its anonymity has not been established.

Do you want to keep these fields while accepting that anonymity cannot be promised, or would you prefer to reduce any of them to follow “only nonpersonal information” more strictly? If you want to reduce them, specify which ones.

**Your answer:** For the hackathon, anonymity is not promised.

For this submission, the current description of the recovery snapshot remains and no anonymity is promised. This answer does not claim the retained fields are anonymous or change which fields are stored; no fields were removed.

### Local demo and recording — answer from October 24, 2026

**I don't want the demo mode to make real calls to Gemini; the recording mode should. And that one can be local.**

The demo uses a sample walkthrough without real calls to Gemini. To record the product, use the normal local flow with real Gemini.
