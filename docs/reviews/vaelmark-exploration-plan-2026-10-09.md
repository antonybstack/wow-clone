# Vaelmark exploration plan review

2026-10-09. Planning review of the [game vision](../plans/gothic-exploration/vision.md)
and [24-hour implementation plan](../plans/gothic-exploration/next-24-hours-2026-10-09.md),
against product 7673031 and current source/evidence at f5e2a99.

One independent **Grok 4.6/high** source reviewer wrote a report within its
eight-turn allowance. The CLI ended at the turn cap (`cancelled`, exit 1), with
the report retained. Session `01a1230e-f5ab-70a0-91d6-787ef47f794b`; report and
compact CLI metadata are under `.cache/vaelmark-plan-2026-10-09/`.
It owned no renderer, server or deployment, and changed no product files.
This is source/plan review, not runtime, performance or visual acceptance.

## Changes accepted by root

- **Complete the return before optional regional expansion.** Hollowmere is now
  required G14, immediately after the cathedral and readability work. Eastwatch
  becomes optional G15; G16 remains stretch. This resolves the draft's mismatch
  between its intended full episode and its earlier extension ordering.
- **Specify reachable interaction metadata.** The undercroft currently has no
  memorial standing/interaction fields. The plan now calls for a side-access
  point outside the real collider and a separate floor datum, rather than leaving
  the implementer to choose a tomb center or overhead lamp. Existing aisle width
  does not imply one fixed standing distance, so the review's numerical claim
  that the radius must fail was too strong; the ambiguity was still worth fixing.
- **Name the late owner.** Construct exploration inside `createCombat`, reuse its
  updates and scene cancellation, and expose only a late journal provider to the
  early menu. Optional content must not enter the boot graph.
- **Use the existing input boundary.** X produces an edge-triggered field;
  resets, death, modal state and device loss cancel it. The nearby button shares
  validation and HUD pointer filtering. Prompt messages have their own owner.
- **Keep persistence durable and separate.** The v1 origin-local journal is not a
  daily throwaway save. Storage failure visibly degrades to session-only progress;
  appearance data, XP and equipment entitlements remain separate.
- **Preserve deferred audio and a bounded diagnosis.** Bell sound uses the existing
  muted/lazy owner. The startup task ends early when no new discriminating
  hypothesis is supported; its six diagnostic visits are a ceiling, not a quota.

## Findings checked and corrected

The reviewer suggested using only the older G06–G08 FPS receipt for the five
standard routes. Root inspected the actual
[core-adoption receipt](../baselines/region-core-adoption-2026-10-09/performance-receipt.json):
it includes all five routes, including cathedral, with three windows each.
The plan retains that matching core-mode reference and explicitly distinguishes
the separate whole-packet campaign. New interior locations need their own baseline
or must be reported as first measurements. Neither historical overall range alone
establishes a causal regression.

The review did not inspect `dev-tools.js` or the parent cathedral return object.
Root verified F/G in `dev-tools.js` and the existing `world.cathedral.exploration`
path used by the guide. Those are valid existing structures. The plan now spells
out the west-tower lookup to avoid treating its shorthand as literal JavaScript.
The height rejection test explicitly targets the nave above the crypt; no new
rule forbids a player from reading while on the memorial itself.

## Validation and remaining limits

Root checked current input, physics query, lifetime, audio, location and save
patterns, plus the applicable release receipts. Documentation links, schedule
continuity and whitespace are checked before commit. No game was launched and
no new performance, visual acceptance or production qualification is claimed.
The estimates remain allocations with optional scope cuts, not promises that an
unknown startup defect will be fixed within two hours. Production remains held.
