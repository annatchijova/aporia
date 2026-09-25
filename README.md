# APORIA

**From scattered inputs to a plan people can actually agree on.**

[English](README.md) · [Español](README_ES.md) · [Technical README](TECHNICAL-README.md)

Planning with people is messy. The information already exists, but it is spread across messages, screenshots, links, calendars, preferences, polls, and vetoes. APORIA is designed to turn that heterogeneous input into shared, explainable plans.

## The experience

Create a room such as **Dinner after Nerdearla**, share one link, and let everyone contribute in the format they already have:

- write “Saturday after 8, but not too far from Caballito”;
- paste a WhatsApp conversation;
- upload a calendar or Maps screenshot;
- add a place link, availability grid, poll, preference, or veto.

APORIA extracts candidate constraints, shows what it thinks it found, and asks the contributor to confirm before anything enters the shared model. The room then presents plans in human terms:

> **Plan A — Saturday 20:30**
> Meets everyone’s confirmed availability, budget, travel, and dietary constraints.

When there is no perfect plan, APORIA should explain the smallest useful change that opens one: a later time, a wider travel radius, or a different budget.

## Why this is different

| Typical planning flow | APORIA |
| --- | --- |
| Everyone translates their situation into the same form | Everyone contributes text, images, links, grids, or votes |
| Suggestions are difficult to audit | Extracted facts require human confirmation |
| A recommendation hides the trade-offs | Each plan explains which constraints it satisfies or relaxes |
| “No solution” ends the conversation | Minimal relaxations show what could unblock the group |

APORIA is not a form, a scheduling poll, or a chatbot that invents consensus. It is a shared decision room: people provide evidence about what they know, a deterministic engine evaluates the confirmed model, and AI helps with the parts where interpretation or discovery is useful.

## How it works

```text
human input
  → multimodal extraction
  → proposed structured constraints
  → human confirmation
  → canonical shared model
  → deterministic constraint evaluation
  → candidate search and proposal
  → ranked plans with generated explanations
```

AI may extract meaning from a screenshot or propose a restaurant candidate. It must not silently decide that a person is available, that a place satisfies a restriction, or that a plan is valid. The decision path uses typed structured data and exact arithmetic; presentation may use natural language, but the explanation is derived from evaluated facts rather than narrated into existence.

## Destination-driven construction

APORIA is being built toward a general-purpose collective decision engine. The levels are coherent product states, not disposable prototypes:

1. **Shared planning room** — text input, confirmed extraction, deterministic overlap, candidate plans, and explanations.
2. **Heterogeneous evidence** — screenshots, links, and other real-world inputs using the same extraction boundary.
3. **Negotiation by minimal relaxation** — show the smallest changes that make an impossible room solvable.
4. **Structured participation** — availability grids and polls become first-class inputs without changing the canonical model.
5. **Verify** — canonical snapshots, provenance, and SHA-256 verification for people who want to inspect the decision record.

Each level preserves the same authority boundary, confirmation requirement, deterministic decision path, and auditable representation.

## Project status

**Design status:** destination and construction levels defined. Implementation and runtime evidence are not yet present in this repository.

The target is a full-stack app deployed on Webflow Cloud for the Webflow hackathon. The intended first implementation path is a shareable room with realtime collaboration, but no external service or integration is claimed here until it is configured and verified.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
