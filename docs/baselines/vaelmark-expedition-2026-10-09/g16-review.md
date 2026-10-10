# G16 source review

Candidate: live uncommitted G16 atop `dc34c42`. Reviewer: independent source pass, focused diffs only. Native motion and later glow-batch glyph contrast are parent-owned. This file records source findings on three questions. No runtime acceptance claim.

Read: uncommitted diffs and relevant sections of `src/ashen-reach/region-structures.js`, `exploration.js`, `exploration-state.js`, `region-map.js`, `combat.js` (createRegionMap / createExploration), `scripts/test-region-structures.mjs`. Narrow supporting looks: `masonryBox` size convention, `REGION_LANDMARKS` ids, `JOURNAL_ENTRIES`, `exploration-store.js`, menu map open. `exploration.js` and `exploration-state.js` had no uncommitted G16 hunks.

Live authoring at the last read: keep stand `map(3.15,0,6.3)`, tower stand `map(-.9,0,.5)`. Parent reports those corrected stands pass 20/20 focused geometry/state checks and two native visual surveys. Reviewer did not inspect those native views.

## 1. Authored stands, air targets, collision, no invented tower floors

**No consequential source defect.**

Westwatch / Southwatch tablets are the existing wall inscription, laid on the authored hall bench.

- Bench remains `box(sign*4.5,.4,7,1.1,.8,5,DARK)` (`region-structures.js` 203). `masonryBox` takes full width/height/depth about the center, so the slab top is local y `0.8`.
- Tablet: `outwardBox(stone, map(4.5,.8175,8.25), [.85,.035,.50], …)` plus the same DARK glyph boxes, Y/Z swapped from `inscription` (73–80 vs 306–310). Center `.8175` is bench top plus half of thickness `.035`. Local `d=8.25` sits on the 5 m bench (`d` 4.5–9.5).
- Visual only: stone batch, `decorativeTriangles` incremented, no `collisionBatch` / `box()` path. Comment at 304–305 matches the code.
- Stand / air: `standingSurfaceY: floorY`, `stand: map(3.15,0,6.3)`, `interact: map(3.70,1.25,8.25)`, `heading: yaw+Math.PI/2` (312–314). Stand `u=3.15` is hall-side of the +u bench edge (`u≈3.95`). Interact shares tablet `d=8.25` and sits in air above the slab. Heading is +u, the tablet side.
- Site ids `west-keep` / `south-keep` match `REGION_LANDMARKS`. The test fixture rename `west`/`south` → `west-keep`/`south-keep` is what makes those branches exist under the same ids the game uses.

Ground-chamber watchmarks bind to the existing crest, on the chamber floor.

- Crest is still `crest(0,1.65,2.10,.55)` (325), on the rear wall below `portal(2.6,…)`.
- Discovery: `stand: map(-.9,0,.5)`, `interact: map(0,1.4,1.85)`, `heading: yaw`, `standingSurfaceY: floorY` (336–341). Interact is in front of the crest (`d=1.85` vs `2.10`). Stand is chamber floor, offset in `u`.
- Ids: `ash-tower-view`, `moor-tower-view`, `bell-watch-view`. Destinations now carry `discoveries` (342–343).
- No new tower slab, stair, or remote vista. Upper rings at 327–329 stay rings. `box(0,8.35,0,4.4,.3,4.4,DARK)` is pre-G16 and unused by these anchors.

Clearance the source test actually pins (`test-region-structures.mjs` 188–198): unique 7 ids; stand-to-interact xz ≤ 2.5 m (the same radius `interactionReachable` uses); collision ray stand+(0,1.3,0) → interact empty; upward floor under the stand; headroom stand y+0.05 → y+1.95 empty. Decorative vs collision identity still `triangles - collisionTriangles = stair visual + decorativeTriangles` (44), with `decorativeTriangles === 216` (43).

Unchecked here: whether the tablet reads as resting on the bench in a live frame, crest readability at native exposure, and Havok capsule feel. Parent reports two native surveys pass; this review did not open a game view.

## 2. Regional readings, episode prerequisites, map Read, construction order

**No consequential source defect.**

Episode contract is already on `dc34c42` in `exploration-state.js`. G16 fills ids that list already named.

- `REGIONAL_DISCOVERIES` includes the five new ids plus Eastwatch’s two (6–7).
- `transitionExploration` adds a regional id to `discovered` and leaves `phase` unchanged; a repeat returns `{changed:false, blocked:false}` (31–33). Phase actions still require matching phase (26–29).
- `validateExploration` ties only `PHASE_DISCOVERIES` to phase (19). Regional ids may appear in any phase. `loadExploration` / `saveExploration` round-trip through that validator.
- `createExploration` `pick` walks `world.regionStructures.destinations[].discoveries` (64–66). `activate` runs `transitionExploration(record, candidate.action)` with `action === anchor.id` for regionals, then `onOpenJournal` (94–100). Hollowmere’s early-visit gate stays on `hollowmere-return` only (89–92).
- Repeats reopen the journal without rewriting the save when `changed` is false.
- Journal paint indexes `JOURNAL_ENTRIES[id]`. Narrow check: entries exist for `westwatch-account`, `southwatch-account`, `ash-tower-view`, `moor-tower-view`, `bell-watch-view`.

Map Read status is paint-time, not a tick.

- `createRegionMap({…, getDiscovered=()=>[]})`; `paint` builds a Set, then for each `[data-map-destination]` button sets `textContent` to `name` or `name · Read`, `dataset.read`, and `aria-pressed` from `selectedId` (region-map.js 29–36). Clear-button disable and route/pin path are unchanged.
- Site → ids: `vaelmark` → `vaelmark-inscription`; `hollowmere-chapel` → `hollowmere-return`; keeps/towers → that destination’s `discoveries`. `read` if any listed id is present.
- `paint` runs from `open`, destination click, clear, and guide `onBack`. Menu `refreshRegionMap` calls `open` when the map pane is showing (menu.js 166–168). Comment at region-map.js 63–65: existing menu pause, no extra tick. No new frame hook in the diff.
- Construction order in `combat.js` 157–159: `createExploration` first, then `createRegionMap` with `getDiscovered: () => exploration.snapshot().record.discovered`. `createRegionMap` does not call `paint` until `open`/`mount`. The closure is invoked after both objects exist.

Cosmetic-only: regional transition does not touch XP, equipment, or phase. That matches the file header on `exploration-state.js`.

## 3. Lifetime, resources, prepared metadata

**No consequential source defect in the reviewed diffs.**

- Two tablets × 72 triangles = 144. Test moves the decorative bound 72 → 216. Root corrected the reviewer’s box-count typo: each tablet has six `outwardBox` calls (one slab, cross stem, cross bar and three lines), 6 quads × 2 tris × 6 boxes = 72 triangles.
- Reviewed authoring appended those boxes to the existing `stone` batch and counted them as `decorativeTriangles`. No new mesh, material, light, or timer in the focused diffs. Collision identity test still requires the new triangles to be absent from `collisionBatch`.
- Map work is the `getDiscovered` callback plus DOM label updates inside existing `paint`. `snapshot()` clone runs on map open/selection, not per frame.
- Scene teardown: region map still aborts on combat `lifetime`; exploration still aborts on `sceneLifetime(scene)`. G16 adds a closure from map → exploration, used only while both are live.

Parent later states tablet glyphs moved onto the existing `glow` batch for contrast, still 72 triangles each, zero collision, no new materials/lights/loops. That material correction is root-owned and was not in the diffs this review read. This report does not re-audit it.

## Verdict

No consequential source defect on the three questions for the live G16 candidate as read (keep stand `d=6.3`, tower stand `u=-.9`), given parent’s 20/20 focused checks.

Native appearance, lighting of the crest/tablet, and Havok reach remain parent-owned. This review did not capture or play the game.

## Root adjudication

The six-turn source investigation reached its cap without the requested findings
checkpoint; one three-turn report-only resume ended normally. No further probes
were authorized. The source verdict contains no consequential proposed fix.
Root corrected its five-vs-six-box arithmetic above; the exact triangle total
was right and is independently checked. Final20/20 tests include all seven
regional IDs before and after episode completion, actual support/headroom/air
rays and coherent material/collision winding. Root’s later inlay contrast uses
the existing stone/warm batches and actual combined index delta72/tablet; the
source reviewer did not inspect that material change. Direct native entry,
reading, repeat, map selection, escape and actual reload pass for all five sites;
corrected tower/bench stance and gold-inlay visual surveys pass separately.
Prepared/native final motion, performance and delivery remain separate gates.
