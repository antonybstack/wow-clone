# G03 source review — raised lancets, wall furnishings, chapel altar/facing

Independent CPU review of the uncommitted product diff in `src/ashen-reach/region-structures.js`, `region-layout.js`, `buildings.js`, and `scripts/test-region-structures.mjs` (HEAD `0ab038d`). No live game, no packet inspection (prepared assets are not regenerated), no product edits.

**Consequential defects: none.**

## Findings

No high/medium product defects. The one chapel-door occupancy alarm in the first probe used `groundHeight=7.328` (landmark floor) as `building()` `gy`, so y=7.5 sat inside the plinth. Authored pad height is `gy=7.108` (`gy+0.22=7.328`). Recheck at that height is clean.

| Severity | File | Claim | Evidence |
|---|---|---|---|
| none | `region-structures.js` | Rear lancets are real openings; sill/jamb/crown stay solid; render occupancy matches collision | Probe: 54 crest/portal polygons convex, fan-from-v0 stays inside; 0 degenerate tris; 0 winding/normal disagreements; 10532 render tris = 10532 collision tris; window sample rays (sill+0.15 / spring / tip−0.25, plus off-axis) miss both meshes; sill/crown/jamb hits both |
| none | `region-structures.js` | Wall-side furniture/crests do not block gate, hall door, centre lane, or return | Capsule radius 0.28, h=1, d from gate−1 through hall+return: 0 hits. Gate half-width and keep hall-door samples open. Furnishings sit at \|u\|≳2.9 / d≳11.7 (keeps) or d≈2.10 (tower crest, below 2.8 m sill) |
| none | `buildings.js` | Chapel altar is rear-wall volumes on existing stone + Havok boxes; doorway and aisle stay clear | `gy=7.108`, yaw=`Math.PI`: door samples (4.15, y∈{7.5,8.2,9.65}, z∈{112.91,114,115.09}) empty; aisle x=5.2..9.0 at z=114±0.28 empty; altar occupied at (10.05,8,114); back wall occupied at (10.62,8,114) |
| none | `region-layout.js` | Registry yaw `Math.PI/2` is player inward heading, not a building rotation | Building stays `yaw:EAST=Math.PI` in `scene.js` (local +x door faces west, world x=4.1 → room 7.4). Player forward is `atan2(dx,dz)`; inward = `atan2(3.3,0)=π/2`. `dev-destinations.js` copies `landmark.yaw` into `setFacing` / `rig.yaw` |

## Checked invariants

- Same `stone` / `roof` / `rock` / `glow` batches and `outwardBox`/`polygonPrism`/`solid` path; Eastwatch beacons are glow-batch boxes, not new lights, materials, downloads, or an update loop.
- `portal(..., bottom)` adds a sill box and shortens trim jambs to `spring-bottom`; front portals keep `bottom=0` and the previous trim.
- Motif map: east→sun, west→cross, south→shield, `north-tower`→bell. Additive `motif` / `rearWindow` on structure destinations; menu/URL still read `REGION_LANDMARKS`.
- Chapel altar uses the enterable `putBox`+`collision` pair already used by the pews. The extra chapel light in a full `building()` call is the pre-existing door lantern (`lights.push` in the non-ruin gable path); the altar piece function does not add one.
- Pinned Lite 1.31.1 / Havok 1.3.14 APIs are unused beyond existing batches and box colliders.

## Limits

- CPU Möller–Trumbore on generated triangles and AABB box occupancy. Not Havok, not a GPU frame, not the keyboard circuit.
- Window/lane samples are dense along the authored centre line and jamb/sill/crown points, not a full mesh boolean.
- Did not inspect built/prepared packets.
- Enterable chapel furniture inherits inverted `putBox` winding, as the pews already do; no new winding disagreement on the keep/tower triangle batches.
- `scripts/test-region-structures.mjs` still omits the chapel; altar clearance is from this probe, not that file.

Root owns live acceptance (screenshots, Eastwatch/Westwatch walk). This review does not claim that.
