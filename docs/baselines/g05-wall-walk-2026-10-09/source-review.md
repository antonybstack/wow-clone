# G05 Eastwatch wall-walk — independent source/collision review

**Reviewer:** Grok 4.6 / high
**Date:** 2026-10-09
**Scope:** Eastwatch-only stair / high route. Source and authored collision only.
**Allowed write:** this file. No product edits, no subagents, no browser, no build, no benchmark, no publishing.
**Eight-turn cap:** original brief reserved the last two of eight turns for findings/limits. Inspection used three turns (skeleton + named-file batch; construction/handler reads; one executed CPU ray probe). This file is the forced close. Unused turns were not spent on extra probes. The review is unfinished relative to that eight-turn budget.
**Root CPU14:** reported passing (ledger in `.cache/g05-wall-walk-2026-10-09/source-tests.log`). This review’s node builder reproduced 11172 render / 10788 collision, difference 384.
**Root live (not this review):** native climb, full route return, three guard contacts, and nineteen public dev controls passed with no Fly/recoveries/errors. That is root evidence.
**This review does not claim:** native run, prepared packet, visual acceptance, FPS, or live play.

## Status

- Skeleton written.
- Named files read: `region-structures.js` wall-walk block, `dev-destinations.js`, `scripts/test-region-structures.mjs`, G05 plan, `cathedral-exploration.js` flight/rail, `scene.js` ~519–559, `dev-tools.js` `jumpTo`, `scripts/ashen-reach/check-dev-destinations.mjs`, `masonryBox` / `outwardBox`.
- CPU ray probe: **executed** (inline node import of `buildRegionStructures`; same landmark fixture as the CPU tests). Not a proposed-only check.
- Findings: none observed in the completed source/collision checks.
- Limits / not-checked: listed below.

## Check list (consequential errors only)

| ID | Check | Result | Notes |
|----|--------|--------|-------|
| C1 | Local right u13.6 | observed | `side=13.6`. Probe landing local u=13.6. |
| C2 | Width 2.4 | observed | `width=2.4`. Walk u=12.4..14.8 (and left/rear equivalents). |
| C3 | Flight d−10..6, rising 0..5.2 m | observed | `start=-10`, `end=6`, `walkY=5.2`, `run=16`. Slope 5.2/16 ≈ 18°. Probe mid-stair floor y=2.6 at d=−2; entry floor y=0 at d=−10. |
| C4 | U platforms at 5.2 | observed | Right slab d=6..18.8, rear u=−14.8..14.8 at d=17.6, left d=−10..18.8, all top y=5.2. Probe floors at d=6.1/8, rear, left end. |
| C5 | Outer existing walls/caps | observed | No new outer rails. Existing `box(±15.4,…)` and rear `d=19.4` remain; walk outer edge 14.8 / 18.8 flush with those inner faces. Caps/crenels unchanged. |
| C6 | Inner solid parapets and stair continuation/corners | observed | Stair `crossPrism` 0.22 m + 1.1 m rise, inner u=12.4, d=−10..6. Platform boxes from d=6..16.4 and rear/left L. Left front closed by full-width guard at d=−10. |
| C7 | Headroom | observed (CPU) | CPU14 verticals to +1.95 m at ±0.32 u. Probe: 1.8 m lane (center ±0.9) no hit to +2.2 m on stair/right/rear/corner. Outer ~15 cm under existing cap: **1.01 m** (u=14.65 / d=18.65). That strip is outside the 1.8 m lane. |
| C8 | Window view | observed (CPU) | Probe y=6.9 d=17.6→14: no hit. y=6.2 and 5.8 hit the inner parapet (~1.04 / 1.09 m). Matches CPU14 `y=6.9` over-guard ray. Portal/sill source still `portal(15.5,…,6.2,8.6,3.2)`. |
| C9 | Gate/hall preservation | observed (CPU) | Probe gate/hall center rays open. G05 geometry is east-keep only, u=13.6, behind gatehouse rear d=−13 and outside hall/buttresses u≤7.95. CPU14 gate/hall/courtyard tests still in the file. |
| C10 | Geometry budgets | observed | This session CPU build: 11172 render, 10788 collision, delta 384. Guard 13000. Matches root-reported totals. |
| C11 | Matching collision except 33 visible treads replacing one smooth ramp | observed | `steps=Math.ceil(5.2/0.16)=33`. Probe: visual 396, ramp 12, 396−12=384. Treads `polygonPrism` on `stone` only; ramp on `collisionBatch` only; `box`/`prism`/`crossPrism` write both. |
| C12 | Slab starts exactly at ramp end | observed | Right slab `box(side, walkY-.125, 12.4, 2.4, .25, 12.8)` → d=12.4−6.4=**6.0**. Probe d=5.9 hits ramp y=5.1675 (not a 5.2 ledge); d=6 and d=6.1 at y=5.2. |
| C13 | Rails stop at rear inner corners to keep turns open | observed (CPU) | Right inner parapet ends d=16.4 / u=12.4; rear parapet u=±12.4 at d=16.4. Probe diagonals and along-corner rays in both rear squares: **no hit**. |
| C14 | Skyline / ground lane remain | observed in source | `topY=floorY+H*1.05` unchanged. Center courtyard/hall tests still sample u=±0.42. Walk is at \|u\|=13.6. Other keeps have no `wallWalk`. |
| C15 | Normals / winding | observed (CPU floors) | Probe floor hits all `ny>0` (ramp unnormalized ~38, slab ~31, courtyard large +Y). Keep `box()` is `outwardBox` (index/normal flip); same path as the existing keep floor. CPU14 winding-agrees-with-lighting test is in the file; this review did not re-run that full loop. |
| C16 | 1.8 m clear width | observed (CPU) | Probe chest-height inner+outer: **2.29 m** on stair, right, left, rear. Metadata `clearWidth:2.06` is conservative. Both ≥ 1.8. Inner hit at 12.51 (parapet face); outer at 14.8 (existing wall). |
| C17 | Dev landing `world.regionStructures.destinations.wallWalk`; name/height/yaw link uses same handler | observed | Property on east-keep destination: `landing=map(side,walkY,8)`, `yaw` site yaw, `floorY=floorY+walkY`. `devDestinations` `add(\`${id}-wall-walk\`, \`${name\|\|'Eastwatch'} — wall walk\`, landing, yaw)` — same `add` as every other dest. `jumpTo` reads `destination.floor` + `destination.yaw`. Native checker (unread at runtime here) sources `walk.floorY` from `regionStructures.destinations`. Landmark name `Eastwatch` is on `east-keep` in `region-layout.js` (name only; Vaelmark entry not taken from that file). |
| C18 | `scene.js` Vaelmark entry/route (~line 535) preserved in prepared metadata | observed | `cathedralSite.entrance=cathedral.entry; cathedralSite.route=cathedral.route.waypoints` at 534–535. `dataOnly` metadata `plain({…landmarks:REGION_LANDMARKS…})` serializes that mutated object. G04-style inference from `region-layout.js` entrance alone would be wrong. |

## Geometry / collision notes

Flight follows the cathedral pattern in `cathedral-exploration.js`: `steps=ceil(rise/0.16)`, collision prism `[[0,-.25],[run,rise-.25],[run,rise],[0,0]]`, visible treads within 16 cm (5.2/33 ≈ 0.1576 m). Inner guards are full masonry parapets (plan), not the cathedral 0.14 m rail.

Right landing slab is edge-joined at d=6. Overlapping corner slabs (right∩rear, left∩rear) share the same 0.25 m occupancy in both batches; extra coplanar tris, not a hole.

Corbels sit under the slabs (y≤4.95). Probe under the right walk at u=13.6,d=8 hit at ~3.84 m above courtyard floor (corbel volume). Ground center lane is u≈0.

`clearWidth:2.06` does not match the 2.29 m CPU span; it is still above 1.8 m and is not a travel-width failure.

## Dev landing / destinations

Menu id `east-keep-wall-walk`, label `Eastwatch — wall walk`. Landing world from probe: `[204, 50.888, -51.6]` (floorY 45.688 + 5.2, local d=8). Same `jumpTo` / spawn-link `add` path. Checker height branch uses `wallWalk.floorY` when id matches `*-wall-walk`. Existing cathedral/landmark `add` calls were not removed in the source read.

## Scene / metadata preservation

Prepared `metadata` includes `regionStructures` (JSON `plain`, strips `collisionBatch`/functions; `wallWalk` is plain data) and `landmarks:REGION_LANDMARKS` after the Vaelmark entrance/route assignment. `REGION_ROUTES` still passed through; this review did not count the eight routes.

## CPU14 / budget notes

- Root TAP: 14 pass / 0 fail (log only; not re-executed as the full suite here).
- Executed here: one `buildRegionStructures` + Möller–Trumbore probe. Totals 11172 / 10788 / 384; 33 treads; join/width/turns/headroom/window/gate as above.
- Delta 384 = 33×12 tread tris − 12 ramp tris. Agrees with the test assertion that only visible treads differ from the smooth ramp.

## Findings

**None observed** in the source/collision checks that were actually completed (named files + one CPU ray probe).

No source change. Unrelated dirty AGENTS/character docs were not touched.

## Explicit not-checked list

- Native keyboard climb, full U-route return, inward/outward rail contacts, raised-window camera, Fly/recovery (root-reported; not this reviewer).
- Prepared packets, near-byte identity, optional deltas.
- Visual acceptance, live MP4, z-fighting on overlapping corner slabs, texture/lighting.
- FPS / M1 Max windows.
- Havok contact vs this CPU raycaster.
- Re-run of the full 14-test file in this session.
- Independent count of eight region routes and of the prior nineteen developer destinations in the live menu.
- West/south/tower accidental high-route geometry beyond reading the `east-keep` guard.
- Production/mobile qualification.
- Extra probes that the unused eight-turn remainder could have covered.

## Limits

- Stopped by the forced close, not by exhausting the eight-turn cap.
- CPU probe uses the test landmark floorY 45.688 (layout stores more decimals); local u/d/y are what matter for this slice.
- `scene.js` live path vs `dataOnly` packet path: both keep `regionStructures` and mutated landmarks in the objects that were read; packet bytes were not opened.
- Outer-cap 1.01 m headroom exists on the last ~15 cm against the wall. The 1.8 m travel lane was clear in the probe. Not filed as a consequential travel error.
- Do not treat this file as native, packet, or visual sign-off.
