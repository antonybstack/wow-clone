# Race-transaction review — production customization 2026-09-30

Read-only. Regions: `src/ashen-reach/main.js` `equipment.switchRace` (408–452), `src/character/body.js` `commitVisual` / `stageSource` (933–1056), plus the claimed texture abort predicate.

## Verdict

The inherited Orc→Undead download failure is closed: the live body is not swapped until `commitVisual`, palettes are released in `beforeCommit` before donor retirement, and a failed stage disposes only the candidate. Default Human boot still does not enter this transaction. One reachable ownership hole remains if `publish` throws after a successful `commitVisual`.

## High-impact finding

### 1. `publish` can throw after the race body is already live, and `switchRace` then disposes the new outfit

`src/character/body.js:1025-1046` and `src/ashen-reach/main.js:431-447`

`commitVisual` parks/retires and returns, then `publish` recreates Armory inspection and only then sets `finished`. `switchRace` sets `committed=true` only after `await staged.commit(...)` resolves.

If `createInspectionPreview(candidate)` throws (Armory is open on the race selector, inspection was just disposed in `publish`):

- `commitVisual` has already set `visual` to the new race, parked the Human or retired the old Orc, rebound sockets, and run `beforeCommit` (`impl=next`, `currentRace=race`, palettes released).
- `staged.commit` rejects, so `committed` stays false.
- `catch` runs `next.dispose()`. `staged.dispose()` sees `finished === false`. For a new race, `disposeCandidate` no-ops because `candidate === visual` (`body.js:918-920`). Live clothes are removed; the old body is already retired (Orc→Undead) or parked without this pack (Human→Orc).
- Recipe is unchanged (`rememberAppearance` did not run). Pose snapshot was already applied to the new skeleton.

Boot saved-Orc uses `{immediate:!ashen.renderLoop}` and usually has no inspection; ordinary Armory race changes use `waitCommit` with a live preview.

**Fix:** Set `finished=true` and drop the staged set immediately after `commitVisual` returns. Recreate inspection after that, or ignore inspection errors. In `switchRace`, treat a finished stage as committed: never `next.dispose()` once `visual` is the candidate; run `previousImpl.dispose()` / `rememberAppearance` on that path.

## Closed vs this parent report

- **Orc Graveweaver → `stageSource(Undead)` → manifest 500.** `createStreamedEquipment` throws before `commit`. `next` is unset (its own dispose already ran). `staged.dispose()` retires only the hidden Undead candidate. `impl` / `currentRace` / live Orc clothes / recipe stay put (`main.js:429-430,445-447`; `body.js:1051-1053`).
- **Palette vs retired donor.** `releasePalettes` runs in `beforeCommit` (`main.js:433`). `retireVisual(previous)` runs only after that hook, and not for `parkedVisual` (`body.js:983-987`).
- **Parked Human.** First non-Human commit sets `parkedVisual` only when empty (`body.js:983`). Human return uses `restoreOriginal` and does not dispose that candidate on failed commit (`body.js:1001-1003,1053`).
- **Saved Orc boot** commits on a microtask before `createRenderLoop` (`main.js:440,452,472`). Neutral Human never calls `switchRace`.
- **Texture refinement.** Shared `detailAborted` (`main.js:661-666`), `upgradeStarterCharacter` returns `false` on abort (`startup-assets.js:74,92-94,102`), garments get the same predicate (`equipment-stream.js:266-270,357-361`).

`swapSource` / `restoreSource` remain on the body facade and in the Armory `else` when `switchRace` is missing (`armory.js:95-101`). Production equipment defines `switchRace`, so that else is not this transaction.

## Not defects here

- Re-streaming Human clothes on return after `previousImpl.dispose()` of the parked outfit — new pack on the parked body, not leftover meshes on a retired donor.
- Forced Undead Graveweaver boot loadout when `restoreAppearance` is absent — pre-existing catalogue choice.
- Unknown morph / crowd bounds — out of scope.
