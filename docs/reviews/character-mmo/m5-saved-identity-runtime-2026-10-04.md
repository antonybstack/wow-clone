# M5 saved-identity runtime review — 2026-10-04

Read-only review of the uncommitted actor/startup/pack integration. No live renderer, no tests rerun. Parent owns the only game browser. Remote-piece catalogue regeneration is ignored as requested.

## Verdict

One blocking defect. The selected identity pack cannot pass `createStreamedEquipment`, so saved first-play and live identity apply both fail closed. Ownership/generation, rollback, race-return recipe, and texture abort closures are wired; they are unreachable for a non-starter identity until the pack stamps coverage.

## Proven defect

### 1. Identity body descriptors omit `coverageRevision`, so streamed equipment refuses the selected body

- **Files:** `scripts/character-assets/prepare-production-human-identities.mjs:66-67`; `src/ashen-reach/coverage-manifest.js:13-15`; prepared `public/ashen-reach/human-identity-v1/manifest-prime-*.json` / `manifest-weathered-bald-*.json` (`items.body` has meshes + `coverage` but no `coverageRevision`).
- **Observed:** `encode()` copies published clothing metadata, then deletes `coverageSource` and `coverageRevision`. The three prepared bodies were read: meshes match `coverage.bodySegments` (`HumanV1Body`, `HumanTorsoCore`, eyes/brows, plus `HumanPonytail01` on Prime ponytail); `body.coverageRevision` is absent. `manifestBodyCoverage` then throws `Published body lacks matching coverage revision` for any non-Orc pack that carries `coverage`.
- **Trigger:**
  1. Live: Armory Identity → Prime bald / Prime ponytail / Weathered bald. `applyProductionIdentity` (`src/ashen-reach/main.js:727`) stages the body, then `createStreamedEquipment` on that pack.
  2. Cold: save a non-starter Human identity, reload. `usesHumanShapeStarter` is true (`startup-appearance.js:8`), `preloadSavedHumanPack` selects the identity pack (`startup-fetch.js:65-68`), first `createStreamedEquipment` is `main.js:388`.
- **Practical effect:** the catch in `applyProductionIdentity` (`main.js:756`) disposes staged body/gear and leaves the prior actor. Saved Prime/Weathered never becomes playable: startup dies in equipment, not in recipe decode. Starter (`components:{}`) still uses the released/shape pack, so Original adventurer keeps working.
- **Why the pack guard misses it:** `preloadHumanIdentityPack` (`human-identity-assets.js:14,23`) checks schema/v6/family/targets/preset/components. It does not require `items.body.coverageRevision === coverage.revision`. `verify-production-human-identities.mjs` also omits that field, so prepare can pass while the actor path cannot.
- **Minimal correction:** stop deleting `coverageRevision` in `encode()`, or after `manifest.coverage = audition.coverage` set `manifest.items.body.coverageRevision` and `manifest.compactItems.body.coverageRevision` to `manifest.coverage.revision` (`conservative-geosets-v1`). Assert the same in verify and in `preloadHumanIdentityPack` before returning `selected`. Re-prepare; do not retarget pins.

## Checklist (observed in source; not live-run)

- **Rollback:** `applyProductionIdentity` sets `committed` only after `staged.commit`; failure disposes `next`/`staged` and does not write `currentHumanComponents`. `check()` is the first line of the native commit hook (`main.js:737-739`), before `impl` swap.
- **Generation:** `actorGeneration` advances only in `switchRace` (`main.js:493`). Identity/shape/dye reuse the same logical actor. Session captures generation at construct (`production.js:21-24`) and passes `throwIfStale: assertOwner` into the transaction.
- **Cancel during build:** abort/stale is checked after identity fetch, after `stageSource`, after equipment build, and at commit. `stageSource` itself does not take the signal; a mid-load abort is cleaned by `staged.dispose()` once `check()` throws. Same shape as `applyProductionBody`.
- **Race return:** Human return uses `restoreOriginal: true` (`main.js:475`), which restores the parked visual (the identity body if that was live when leaving Human). `rememberAppearance` rewrites Human `components` from `currentHumanComponents` (`main.js:396,413`). Orc/Undead recipes get `{}`. This is the intended original-restore + recipe restore; it cannot be confirmed live until defect 1 is fixed.
- **First-play recipe:** non-starter `components.head` selects the identity compact pack in both `startup-preload.js:11` and `main.js:91`. Starter `{}` keeps released startup requests. Wiring is correct; equipment then hits defect 1.
- **Detail textures:** identity and first-shape upgrades capture `body.container` and `impl` and abort when either moves (`main.js:753-755`, `702-707`, `612-615`). Equipment `upgradeTextures` also honors `dead || shouldAbort`. No stale-closure write to a replaced actor was found in these paths.
- **Head/hair IDs:** prepared `identity.head` / `identity.hair` URLs equal `items.body.url`; hair meshes are `HumanPonytail01` or `[]`. Connected authored body, not a cut neck mesh.
- **v6 / presence:** production `APPEARANCE_REGISTRY` is the identity registry. Presence still refuses non-empty `components` (`protocol.js:78-79`). Piece-catalogue version skew is not judged here.

## Unknowns (not claimed)

- Live apply, race round-trip, hood hide, and texture upgrade were not executed in this review.
- Whether `previous.dispose()` after a successful identity commit can throw and leave visual identity without `currentHumanComponents` is unobserved; the same sequence exists on shape family load.
- Checkpoint D fit/motion/FPS is out of scope.

## Parent disposition

The coverage finding is valid and reproduced on the ordinary saved route. The
compiler now copies the audition body's coverage revision; preparation, the
release verifier and the optional runtime loader reuse `manifestBodyCoverage`.
All three selected native bodies pass that same adapter. Four saved first-play
identities and the actual select/undo/queued/reset checks pass after regeneration;
injected HTTP 500, corrupt source, retry and held-download/editor-disposal checks
also pass in fresh browser contexts with asserted route hits. Original
accepted source pins are unchanged. No independent live acceptance is claimed
from this source-only review. The review used Grok 4.6 / high, session
`01a10951-9c61-78b0-9d74-7e70cc45b249`; it finished after a bounded resume.

The parent also removed asynchronous writer setup after promotion, validating
morph availability before commit and installing the already-imported native
writer synchronously. A sealed-pack test deliberately changes a vertex and a
rest hierarchy to demonstrate that geometry and bind checks reject real defects.
Full cold, motion, tail-performance and release gates remain required.

The parent commits the recipe before retiring old equipment; cleanup failure can
no longer turn a committed visible identity into a reported unchanged choice.
The subsequent [live checkpoint](../../plans/character-mmo/results/m5-saved-identity-2026-10-04.md)
records motion, paired settled performance and the failed three-run startup pilot.
Those are parent measurements, not claims added to the independent review.
