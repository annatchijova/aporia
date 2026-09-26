# APORIA

**Stop arguing. Start planning.**

[English](README.md) · [Español](README_ES.md) · [Technical README](TECHNICAL-README.md) · [**Try it live →**](https://aporia-bbb3f7.webflow.io/)

> Drop the messages, screenshots and preferences. APORIA finds the plans that actually work for everyone.
>
> And when nothing works, it tells you **what needs to change.**

## You know this exact feeling

Someone starts a group chat. "When are we free this week?"

Twelve replies later, nobody has answered the actual question. One person pastes a screenshot of their calendar. Someone else says "whenever, I don't mind" — which is the least useful sentence in human history. Somebody quietly has a budget they haven't mentioned. Somebody else can't say out loud that they don't want to go somewhere far, so the plan just... stalls.

Nobody is wrong. Coordinating people was never designed to work this way. We just got used to it hurting.

## So we built the thing we wished existed

You don't fill out a form. You don't make everyone agree on a format first. You just drop in what you already have — the exact mess you already have — and APORIA does the part that's actually hard: turning twelve different half-answers into something everyone can look at and say "yes, that one."

And when there's genuinely no plan that works for everyone, APORIA doesn't shrug. It tells you the one thing that would unlock it: *"this works for everyone if Pedro's okay with 15 extra minutes on the train."* That sentence is the whole product. It's the difference between a group chat that dies and a group chat that gets somewhere.

## Why you can actually trust what it tells you

Here's the thing nobody says out loud about AI tools: half the time you don't know if you should believe them.

APORIA doesn't get to just believe itself either. It reads your mess, but before anything counts, *you* confirm it got you right. And once something's confirmed, whether a plan actually works is checked, not guessed — the AI doesn't get to invent that everyone's free on Saturday because that would make a nicer answer. If it doesn't check out, it doesn't make the list.

So when APORIA says "this plan works for all five of you," that is a deterministic result against the information the group confirmed — not a suggestion Gemini invented. APORIA does not silently turn unknown external facts into a guarantee.

## It's not just about dinner

Once you build something that can turn a pile of human noise into "here's what's actually true, here's what fits," it stops being a dinner-planning app. The same shape solves: when the five of you can actually meet, what apartment fits everyone's budget and commute, what gift everyone can afford to chip in on, where the trip actually works for the whole group's dates. Planning with other people is the same fight everywhere. We built the thing that ends the fight, not another app for one slice of it.

## This isn't a hackathon throwaway

We built this for the Webflow Cloud hackathon, and we'd genuinely love to win it — but this isn't going to get abandoned the day after judging. It's Apache 2.0 licensed, which nobody required us to do; we did it because we want people to build on it, fork it, and hold us to it. We're going to keep shipping levels toward the real destination: more ways to drop in evidence, smarter negotiation when the group is stuck, and a fully auditable record of how every plan was decided. What you're looking at is the first honest chapter, not a demo we'll quietly delete.

## Try it right now

**[aporia-bbb3f7.webflow.io](https://aporia-bbb3f7.webflow.io/)** — no account, no install. Start a room, drop in something messy, and watch it turn into an actual answer.

The current coherent product state includes shared rooms, text and screenshot evidence, human-confirmed extraction, Gemini candidate proposals with explicit acceptance, deterministic evaluation, and bounded “what would need to change?” suggestions. Links, polls, structured participation, and the Verify surface remain part of the destination architecture.

## Design documents

- [Architecture decision](docs/APORIA-ARCHITECTURE-DECISION.md)
- [Red-team architecture review](docs/red-team/APORIA-RED-TEAM-ARCHITECTURE.md)
- [Technical README](TECHNICAL-README.md) — stack, architecture, and implementation status, for anyone who wants to see how it actually works.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
