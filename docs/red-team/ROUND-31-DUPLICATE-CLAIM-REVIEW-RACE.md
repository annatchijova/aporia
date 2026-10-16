# Round 31 — duplicate claim review from two tabs

**Status:** Finding fixed and locally rechecked.
**Threat model:** A participant opens the same pending contribution in two tabs. Its extracted claim already matches an existing confirmed fact, so both requests take the duplicate-review path without changing room revision.
**Scope:** Duplicate detection, the unique `(proposal_id, claim_id)` decision key, proposal completion, and concurrent D1 batches. Gemini was mocked.

## Reproduction

The local Wrangler D1 test confirms one proposal to create a fact, submits a second proposal with the same claim, then pauses two confirmation requests after both have read “no prior decision.” Both requests are released to their D1 batches together.

Before the fix, one request returned 200 and the other returned 400 from the unique decision constraint. D1 correctly stored only one decision and completed the proposal, but the losing tab saw an internal constraint error rather than a conflict.

## Fix

Claim-decision insertion now uses `INSERT OR IGNORE`. A concurrent replay that loses the unique-key race changes zero rows; the existing result check maps it to 409. The operation remains single-decision and does not increment the room revision for a duplicate fact.

## Post-fix results

- The two requests return 200 and 409.
- Exactly one duplicate decision is stored.
- The proposal is marked confirmed once.
- Room revision remains unchanged and no extra fact is added.
- The R28/R29 close and stale-revision race regressions continue to pass.

## Verification and limits

Sixteen actual-Worker/local-Wrangler-D1 integration cases pass, along with the 37-test general suite, typecheck, build, and diff check. Gemini is mocked; local D1 uses the synthetic lifecycle schema plus production event/decision uniqueness constraints. No production D1, deployed Worker, email provider, or browser was exercised.
