# G03 fork-repair review

Independent CPU/source review of the subsequent east/west road-fork repairs in `src/ashen-reach/region-layout.js` (authored polylines), with overlap tests in `scripts/test-region-world.mjs`. `region-world.js` is unchanged in this repair diff. Interior art is out of scope.

**East repair: valid on observed native + top-face evidence. West repair: geometrically addresses the retained native failure; Havok west return after the patch is unverified. No consequential regression shown in the two repaired junctions. Native west acceptance remains with root.**

## Observed evidence (this pass)

Read current `region-layout.js`, `region-world.js`, `scripts/test-region-layout.mjs`, `scripts/test-region-world.mjs`, and `git diff` of those four files.

Native / survey files actually opened or grepped:

| Record | Result used |
|---|---|
| `junction-before.json` | East overlap **1.095 m** at (122, 100), ys 19.236 vs 18.141 |
| `native-circuit/report.json` | East-tower **return blocked** at (118.50, 18.99, 101.66), physics on, Fly off, recoveries 0 |
| `junction-after.json` | East top-face maxSpread **2.8e-14** |
| `native-east-final/report.json` | **passed: true**. `east-keep` and `east-tower` `entered`+`returned`, samples 54/68, physics true, flying false, recoveries 0 throughout start/end/connections |
| `junction-survey.json` (beforeWest) | west-fork maxSpread **0.554 m** at (−91.5, 141), ys 9.719 vs 9.165; east-fork already 2.8e-14; north-fork 0.156 m |
| `native-west-survey/report.json` | **west-tower:return blocked** at (−88.867, 9.990, 139.319) toward (−88.624, 9.237, 140.466), distance 1.173 m; physics true, flying false, recoveries 0 |
| `junction-survey-after-west.json` | west-protected-edge maxSpread **1.4e-14**; west-fork **4.3e-14**; north-fork still **0.156 m**; east-fork still 2.8e-14 |

A follow-up Node probe (`.cache/g03-region-2026-10-09/reviewer-forks.mjs`) was written and **not executed**. Grade/width/protected-sample recomputation in this pass is therefore from source + existing tests, not a fresh probe log.

## Source of the two repairs

East: shared `EAST_FORK=[[110,18,118],[120,18,105]]` spliced into both east-keep and east-tower after `N`. Authored 18 m plateau through the intersection. Downstream keep/tower nodes and landmark coordinates unchanged.

West: shared `WEST_FORK=[...W,[-100,10,142],[-112,10,142]]`. Common trunk continues past protected `x=-90` before the split; 10 m plateau. west-keep then `[-125,10,152]…` to the same entrance; west-tower then `[-112,10,130]…` to the same entrance. Landmark `x/z/floorY/entrance` arrays in `REGION_LANDMARKS` match the pre-fork values (chapel yaw is earlier G03, not this repair).

`protectedGround` / `protectedCore` bounds, `legacyHeight+0.05` overwrite, `applyRegionRoutes` blend, Havok player policy, and `region-world.js` mesh builder are not in the fork diff. New tests sample overlapping **top faces** in boxes east (108–135, 91–121) and west (−130–−78, 125–156) and require spread `<0.001` with `overlaps>50`. Layout tests still require `width>=4` and grade `≤20°+0.001`. Those tests were not re-run here.

## Verdict

**East.** The 1.095 m stacked-road ledge at the keep/tower fork matches the native east-tower return stall. The 18 m shared plateau removes that height split on CPU top-face rays, and `native-east-final` walked both eastern destinations in and back without Fly or recoveries. Repair is valid for the failed east return.

**West.** The 0.554 m ledge at (−91.5, 141) sits on the protected-edge split; the native stall at (−88.87, 139.32) is the same return, still inside protected ground (`x≥-90`). Moving the common trunk to x=−100/−112 at y=10 puts the rounded junction outside that overwrite. After-west top-face spread is numerical zero on both the protected-edge and west-fork windows. That is sufficient to call the **geometry of the local repair consistent with the failure**. It is **not** a native Havok proof that west-tower return now walks: no post-patch west native report exists in this cache.

**Missed regression from these two patches.** None shown at the repaired junctions. North-fork maxSpread **0.156 m** is identical before and after the west patch (`junction-survey.json` and `junction-survey-after-west.json`); it is a remaining similar-class overlap on an **unedited** north-tower polyline, not an east/west regression. South-keep / chapel polylines are untouched in the fork diff.

## Limits

- No browser, no Havok re-walk, no test runner, no prepared-packet inspection.
- `reviewer-forks.mjs` was not run; this file does not claim independent grade/protected-sample numbers from that script.
- Width ≥4 m and grade ≤20° are required by existing tests and by the authored plateau construction; this pass did not print per-segment degrees.
- Root owns native west (and full-circuit) acceptance after the west source change.
