[English](README.md) · [Español](README_ES.md) · [**Technical README**](TECHNICAL-README.md)

# APORIA

<p align="center">
  <img src="docs/logoaporia.png" alt="APORIA logo" width="400">
</p>

## Make room for a plan that brings everyone together.

APORIA is a shared planning space for friends and communities organizing real life together. It turns the messages, screenshots, schedules, budgets, and preferences a group already has into options everyone can review.

## Why APORIA exists

The best parts of life happen together: a night out after a meetup, dinner with friends, a weekend away. Getting everyone there can take dozens of messages, scattered details, and a lot of quiet coordination.

APORIA gives the group one room to bring those pieces together, so more energy can go into the moment they are planning.

## From group chat to shared plan

1. **Open a room.** Give the plan a name and share its link or meeting number.
2. **Bring what you know.** Each person can add a message, screenshot, schedule, budget, or preference.
3. **Make the details visible.** APORIA helps interpret contributions, and each person can review and confirm what they meant.
4. **Choose together.** The group compares options against the details it confirmed and sees what small change could open another possibility.

AI helps organize the conversation. The people shape the shared picture, and APORIA compares the options with that picture.

## A small sample walkthrough

Try the fictional sample room locally. It runs in the browser and uses prepared sample data.

```bash
npm install
npm run dev
```

Then open `http://localhost:5173/?mode=demo`.

## Built for Build With AI: Basics

APORIA was started from project scaffolding on September 25, 2026, during the [Devpost Build With AI: Basics](https://learn-ai-basics.devpost.com/) submission period. The initial scope, product requirements, and technical plan were created with the official Devpost Learn Skill Pack.

## Explore the project

- [Technical README](TECHNICAL-README.md) — how APORIA works, its architecture, and implementation evidence.
- [Data flow and provider details](docs/PRIVACY-DATA-FLOW.md) — what the app sends to Gemini and how room data moves through the system.
- [Product scope](devpost/scope.md) · [Product requirements](devpost/prd.md) · [Technical specification](devpost/spec.md)
- [Red-team review plan](docs/red-team/APORIA-ROUND-PLAN.md) — security reviews, fixes, and evidence.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
