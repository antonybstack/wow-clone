# G03 — Regional destination identity and connected exploration

**Local implementation and visual review; acceptance/delivery in progress.**
The ordinary seven-site developer-menu survey showed identical bare keep halls,
blank tower rooms and Hollowmere facing south at a west-facing entrance.
[Implementation/acceptance scope](../../plans/gothic-exploration/g03-region-2026-10-09.md).

## Current change and checks

Real rear lancets give all three halls and detached tower chambers a view. Solid
sills remain 3.2 m / 2.8 m high. Eastwatch uses sun reliefs and paired beacon
fixtures; Westwatch uses crosses and paired stone memorials; Southwatch uses
shield displays. Ash/Moor/Bell towers use sun/cross/bell wall reliefs. Furnishings
stay at walls. The existing chapel has a rear altar/cross; its player-facing
registry yaw is π/2, matching ordinary entry through the west door. Building yaw
stays π. All geometry is generated before play through existing batches.
No new textures, materials, scene lights or runtime update system. The two
local road-fork repairs below are the explicit terrain/route exception.

Region structures rise 7,752 → **10,532 render and matching collision triangles**
within the existing 13,000 guard. Required near packet is SHA-identical, 149,963
bytes. Final optional region rises 47,617 encoded bytes to **22,411,866**;
its decoded size is 157,880,480 bytes and 1,036 blocks. Optional skyline is
591,819 bytes. Fork roadbed clearing changes optional foliage by +2,406 encoded
bytes to 4,413,215; character payloads remain unchanged. [Packet receipt](geometry.json).
All **58 final focused CPU checks** and the staged build pass. [Check scope](checks.json).
This does not establish a new public one-second start or physical mobile acceptance.

[Independent Grok 4.6/high source review](source-review.md) finds no blockers:
54 convex polygons, coherent winding/normals, opening/lower-wall/jamb/crown rays,
identical render/collision occupancy, centre-lane clearance and real chapel
plinth/altar bounds. The first 10-turn pass ended before writing; a bounded
four-turn resumed pass produced the complete artifact then hit its cap (exit 1).
This is a CPU/source result, not a clean CLI exit or native/live acceptance.
It began before preparation and did not inspect the regenerated packets or
subsequent fork repairs; those have separately scoped evidence below.

## Actual visual review

Root inspected unretouched built-game ordinary-camera screenshots. The new rear
views and keep focal features are visible. Hollowmere's altar/cross remain dim;
this pass does not claim a full interior lighting improvement. No extra light
system is added to manufacture a brighter scene.

[Eastwatch before](east-keep-before.png) / [after](east-keep-after.png),
[Westwatch before](west-keep-before.png) / [after](west-keep-after.png),
[Southwatch before](south-keep-before.png) / [after](south-keep-after.png),
[Hollowmere before](hollowmere-chapel-before.png) / [after](hollowmere-chapel-after.png).
The chapel before frame faces out because of its recorded heading defect.
Motion, isolated FPS, sealed public checks and Telegram/VE are pending.

## Native circuit and ownership

The previous region helper independently placed the player at each branch root.
It now enforces browser ownership, uses the public developer bridge spawn, walks
between destinations, keeps Havok active/no Fly and retains every waypoint state.
Its first attempt enters/returns Eastwatch and Westwatch, then fails against the
existing Hollowmere well at x≈0,z≈137.2. The connector had incorrectly followed
its centreline. [Retained first failure](first-circuit-failure.json). The corrected
connector walks the west side of the existing paved square using explicit turn
anchors; no terrain/obstacle removal or recovery teleport. Final results pending.

Root: Chrome86682/CDP10037, Vite86633+86657/5873. Compiled20971/7074 and
its replacement84681/7074 are stopped before the west-fork rebake. Native
contexts close in `finally`; one renderer runs at a time. Grok6799 and resumed
31370 are done. User Edge2931/fifteen nongame tabs, regular Chrome13883/New Tab,
Orca and unrelated Vite4000 (10171+10205) are preserved. Final cleanup pending.
Production remains unchanged under its independent startup qualification hold.

### Real east-fork defect found by the connected walk

The second attempt passes the three keeps, enters Ash Tower and fails on return
near (118.5,101.7). [Every retained state](second-circuit-failure.json),
[actual ledge frame](junction-before.png). Rounded keep/tower branches interpolated
different elevations through their overlapping junction. Actual top-surface CPU
rays find up to 1.094915 m separation over 223 overlapping samples. A shared 18 m
plateau through the fork reduces the same region to <3e−14 m over 226 samples;
a wider regression scan also covers adjoining bends. No player step/physics policy
change. All route grades remain ≤20°. [Both affected east branches](local-east-final.json) pass the final focused native walk and initial-bridge
return with Havok active, no Fly, no errors or recoveries. This used the post-east
build, before the subsequent west repair. Final public acceptance remains pending.


### Analogous west-fork defect

The focused Moor Tower test enters the chamber but blocks on return near
(-88.87,139.32). [Retained third failure](third-circuit-failure.json),
[actual seam](west-junction-before.png). Top-surface rays find up to 0.554189 m
overlap near the old fork. The shared straight trunk now extends outside the
protected town before a common 10 m plateau splits toward the two west landmarks.
CPU rays cover the protected edge and new fork (<4.3e−14 m spread), while protected
terrain heights, all landmark datums and ≤20° route grades pass. The source result
does not establish native acceptance; both west branches are being rebuilt for
focused retesting. North fork's 0.156 m sampled overlap is unchanged and not an
established blocker; its full circuit traversal remains required.


[Separate independent fork review](fork-review.md) finds the repairs consistent
with the retained native stalls and source/top-face evidence, with no shown
regression at the repaired junctions. It explicitly did not run its written
follow-up probe or the test runner and did not perform a post-west Havok walk.
The six-turn pass capped without its report; a two-turn report-only resume wrote
this result and exited successfully. Root owns the 58 CPU checks and subsequent
native acceptance; review prose does not substitute for them. The delegation CLI
notes now require a report skeleton/evidence checkpoint before further probes to
avoid losing bounded-pass findings at the cap.


### Final local walking evidence

[West/north local run](local-west-first.json) enters and returns Westwatch, Moor
Tower and Bell Watch without Fly/recoveries or geometry blocking. Its chapel
exit then blocks against two chasing enemy capsules ([actual frame](chapel-crowded-door.png));
God mode prevents damage but preserves native NPC collision. This is distinct
from the repaired masonry junctions. A first combat-clear fixture timed out after
poor target selection; it is retained locally and does not qualify a route.
[Final focused chapel walk](local-chapel-final.json) enters/exits Hollowmere and
returns to the initial bridge. It selects visible blocking hostiles through
ordinary Tab controls and kills them with Fire Blast before walking out; all
recorded input actions and native states remain in the receipt. No HP mutation,
hidden enemy removal, collision disable or recovery teleport. The final public
seven-site connected circuit remains required; these split local checks are not
represented as one completed local circuit.


### Recorded motion review

[Capture manifest](capture-manifest.json) retains all 2,313 timestamped original
1280×720 frames, viewport/canvas dimensions and encoded result. The H.264 MP4 is
95.552 s, SAR 1:1, rotation 0; elapsed capture is 95.553 s. No stretching/resampling
or hidden placements within a chapter. [Native chapter states](motion-report.json)
include visible developer-menu jumps between sites and normal input inside each
site; this clip is not presented as the separate connected circuit proof.
Root inspected all seven final view frames and actual MP4 playback at the first
Eastwatch view, 28.9 s Westwatch, 87.8 s chapel casting and completed playback.
No native/GPU/playback errors or recoveries. The captured HUD includes recording
cost and is not the isolated performance result. Live recording and encoder ended;
review Edge1147996134 and media55566/7077 are closed before FPS.


## Separate settled performance

M1 Max, uncapped Chromium WebGPU, 1280×720/DPR1, seven enemies, three 12-second
runs on meadow/town/bridge/cathedral/forest, GPU queries off, no recording or other
game renderer. Root audited Edge15 nongame tabs, regular Chrome New Tab,
Orca0 embedded tabs and the owned blank harness before timing. Builds, capture,
encoding and both reviewers were stopped.

| Route | FPS range (3 runs) | Largest p99 | Worst interval |
| --- | ---: | ---: | ---: |
| Meadow | 197.4–197.6 | 6.5 ms | 13.8 ms |
| Town | 188.2–190.5 | 6.6 ms | 8.2 ms |
| Bridge | 227.0–227.2 | 5.6 ms | 8.9 ms |
| Cathedral | 217.2–217.5 | 6.1 ms | 8.8 ms |
| Forest | 199.1–206.6 | 6.3 ms | 8.3 ms |

[All 37,276 raw intervals and summaries](settled-fps.json). No intervals >16.67 ms,
full-window or rolling pacing flags, runtime errors or recoveries. Every sample
uses Havok, seven enemies and the asserted resolution. This meets the declared
144 FPS target and >120 FPS floor for local RAF throughput; it is not a controlled
production comparison or a new cold-start qualification. The earlier unrelated
219.9 ms readiness sample remains unexplained; this clean run does not fix it.

The [first pass](settled-fps-first-summary.json) observes 188.0–227.5 FPS,
p99≤6.6 ms/worst9.4 ms, but the helper's default discards raw intervals. A single
repeat with **ASHEN_FPS_RAW=1** closes that output gap and is the table above; the
first result is retained separately rather than merged. Use that existing flag
whenever retaining a benchmark as acceptance evidence.
