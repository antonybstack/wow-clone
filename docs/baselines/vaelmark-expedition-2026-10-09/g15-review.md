# G15 source review — Eastwatch dispatch and lookout

**Verdict: no consequential defect on the three questions.** Working-tree diffs: `region-structures.js`, `exploration.js`, `exploration-content.js`, `test-region-structures.mjs`, `check-wall-walk.mjs`. Dispatch and lookout share the existing wall-walk floor (`walkY=5.2`). Lower-hall feet fail the 1.2 m surface gate. Regional IDs append without moving cathedral phase; repeats do not save. The plaque is six `masonryBox` volumes on `stone` only (72 triangles), not `collisionBatch`.

No tests, browser, renderer, build, source edits, commit, deploy, or user message. Parent owns prepared rebuild and native motion. Parent adjudicates. This report does not claim visual acceptance. A checkpoint was written after the first batched read.

Unparenthesized `world.regionStructures?.destinations??[]` and `site.discoveries??[]` short-circuit.

## Questions

### 1. Balcony dispatch, north-wall lookout, lower hall cannot claim

**Yes on the authored transforms and reach contract.**

`walkY=5.2`, `side=13.6` (`region-structures.js:225`). Both anchors use `standingSurfaceY: floorY+walkY`.

Dispatch: stand `map(0, walkY, 10.6)` (balcony route point), interact `map(0, walkY+1.10, 9.42)`. Plaque `inscription(0, walkY+.78, 9.235)` size `[.85,.50,.035]`: local d `[9.2175, 9.2525]`, y `[5.73, 6.23]`. Interact is `0.17` m in `+d` of the plaque face and `0.07` m above its top — air between stand (`d=10.6`) and the slab. Inner parapet `box(0, walkY+.5, 9.1, 5, 1, .22)` sits behind the plaque. `interactionReachable` xz radius 2.5 m; stand-to-interact xz is `1.18` m.

Lookout: stand `map(-side, walkY, -8.8)` (last wall-walk point), interact `map(-side+.10, walkY+1.30, -8.8)`. North walk slab `box(-side, walkY-.125, 4.4, width, .25, 28.8)` covers `d∈[-10, 18.8]`. Interact is `0.10` m inward of walk center, `1.30` m above the floor, above the rail cap at `walkY+1.06`. Heading `atan2(vaelmark.x-lookout[0], vaelmark.z-lookout[2])` with fallback `yaw-π/2`. `vaelmark` is `region-layout.js` `{x:0,z:330}`.

Lower hall: interior `map(0,0,10)`, feet ≈ `floorY`. `|floorY-(floorY+5.2)|=5.2>1.2`, so `interactionReachable` is false even though xz to dispatch interact is `~0.58` m. CPU test also requires a collision hit from `point(site,0,1.3,10.6)` to `dispatch.interact` (balcony slab/parapet). Lookout `d=-8.8` is far from the hall in xz as well.

Towers omit `discoveries`; other keeps keep `[]`. `pick` uses `site.discoveries??[]`.

### 2. Regional vs cathedral phase, idempotent save, unknown backup, late metadata

**Yes on the store/transition contracts.**

`transitionExploration` (`exploration-state.js:31-33`): if `REGIONAL_DISCOVERIES.includes(action)` and already present → `{changed:false}`; else append `action`, **phase unchanged**, `validateExploration`. Phase discoveries still must match `i<phase`. Regional IDs are not in the cathedral action list, so they cannot advance `unstarted`→`inscription-read`. `activate` saves only `next.changed&&!sessionOnly`. Reread: `changed:false`, no write. `saveExploration` still copies an undecodable old value to `ashen.exploration.recovery` before replace; load catch does not write.

`pick` action is `anchor.id` (`eastwatch-dispatch` / `eastwatch-view`), both in `REGIONAL_DISCOVERIES` and `JOURNAL_ENTRIES`. Repeat verb `Read again` / `Revisit` does not change the action.

Prepared: `dataOnly` metadata `plain({…, regionStructures})` (`scene.js:561`); `plain` drops `collisionBatch`/functions; `discoveries` numbers survive. `createStarterWorld` `api={...m}`. Direct `api.regionStructures` is the live builder result. `world.regionStructures?.destinations??[]` yields no regional candidate until that object exists; exploration is constructed after world in `createCombat`. Parent owns packet rebuild.

### 3. 72-triangle plaque, nonblocking, budgets

**Yes on the mesh accounting read.**

`inscription` calls `outwardBox(stone, …)` six times, never `collisionBatch`. `masonryBox` is six quads (`buildings.js:18-23`) → 12 triangles each → **72**. Matches `decorativeTriangles` and the triangle-delta guard: `triangles-collisionTriangles === stair visual−ramp + decorativeTriangles`. Episode content budget is ≤2,000 added render / ≤400 collision; this add is 72 / 0. Existing TRIM/DARK on the keep `stone` batch. No new material, texture, mesh owner, timer, or RAF. Plaque is world masonry; exploration abort does not need to dispose it. Scan remains 5 Hz over six destinations × zero or two anchors.

## Actionable issues

None at a severity that justifies a source change from this review.

## Speculative (not filed)

- Lookout has no new mesh; interact is a short air offset, not a distant vista sample. Parent owns whether the ordinary camera reads Vaelmark.
- On-disk prepared packets from before `discoveries` are unread here.
- `paintJournal` would throw if a saved id lacked `JOURNAL_ENTRIES`; current IDs are present.

## Checked

| File | What was read |
| --- | --- |
| `src/ashen-reach/region-structures.js` | `inscription`, keep `walkY`/`side`, discoveries, `decorativeTriangles`. |
| `src/ashen-reach/exploration.js` | `interactionReachable`, regional `pick`, `activate` save gate. |
| `src/ashen-reach/exploration-state.js` | Regional vs phase transition, `validateExploration`. |
| `src/ashen-reach/exploration-store.js` | Recovery key; unchanged this slice. |
| `src/ashen-reach/exploration-content.js` | Dispatch/view copy. |
| `src/ashen-reach/buildings.js:12-23` | `masonryBox` six quads. |
| `src/ashen-reach/scene.js` | `plain` metadata includes `regionStructures`. |
| `src/ashen-reach/starter-world.js` | `api={...m}` (from prior G14 read; no `regionStructures` token in file). |
| `src/ashen-reach/region-layout.js` | `vaelmark` `{x:0,z:330}`. |
| `scripts/test-region-structures.mjs` | 72 tris, air/support, lower-hall hit. Not executed. |
| `scripts/ashen-reach/check-wall-walk.mjs` | Optional exploration pass. Not executed. |

## Unchecked

- Live Havok ray at dispatch/lookout; parent records motion.
- `quad` index count if a future `masonryBox` change broke 12 tris/box (current body is six quads).
- Stale prepared region packets on disk.
- Window/guard clearance beyond existing wall-walk tests (geometry of rails/windows unchanged this slice).
- Runtime journal article order after `validateExploration` sort.

## Root visual adjudication

The bounded source review finished in one five-turn investigation plus a
three-turn report-only resume (`end_turn`); it was not an implementation agent.
Root's subsequent actual native functional run passed but exposed composition
issues. The final relief moves 1.15 m along the same balcony guard, and the
lookout moves to local d15.3 on the unchanged supported north walk. Its text
identifies visible spires rather than an obscured bridge. Ordinary mouse-look
and scroll inspect the view; no camera engine override or new floor. These
composition corrections occurred after the source review. Nineteen focused
state/geometry checks pass on corrected coordinates; final prepared/native
motion and delivery are recorded separately by root.
