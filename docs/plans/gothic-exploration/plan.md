# Gothic region and cathedral exploration

The user selected this direction on **2026-10-08** and deferred mobile diagnosis.
The active slice is **G01: Vaelmark undercroft**. Existing chapels, upper gallery,
both bell stairs and exterior parapet are already built; adding them again is not
progress. Historical character release work remains recorded in CURRENT.

## G01 — A new place below Vaelmark

Connect the nave's west chapel to a vaulted undercroft through a real, guarded
stair. Give the lower chamber a clear entrance, a focal stone memorial and a
walkable circuit around it. The same ordinary controls must descend, explore and
return without recovery teleports. Keep the existing upper chapel stair usable.

Use the preserved `ve-capture/ashen-reach/gothic-world/references` images for
pointed arches, recessed portals and original cliff-integrated masonry. The live
baseline shows a spacious but sparse, uniformly dark interior. Use differentiated
trim and restrained warm fixtures to make the new descent and chamber readable.

The lower floor must clear the actual finite terrain. Surveyed west-side ground
is lower than the east nave: place the chamber west of the nave centre rather
than pushing a subterranean room through the existing terrain mesh. Triangulate
the foundation's concave outline and stair opening using ISC-licensed
[Earcut 3.0.1](https://github.com/mapbox/earcut/tree/v3.0.1#usage), the isolated
leaf already included in pinned Three 0.180 tooling. It imports no rendering
engine; Babylon Lite remains the game's renderer. Both visible slab and
Havok collision receive the same hole; the foundation cliff must not create hidden
interior radial faces through the chamber. Reuse the existing Lite Batch, masonry,
arch, Havok ramp and baked/local lamp paths. Use the existing authoring/background
worker and prepared packets; no per-frame geometry rebuilding.

Acceptance: finite geometry and outward normals; actual slab aperture; continuous
floor, terrain clearance, at least 1.9 m headroom and guarded exposed edges; native
keyboard descent/circuit/ascent with Havok active and no recoveries; existing
chapel/gallery/tower routes intact. Regenerate the prepared world and verify its
served geometry. Root reviews ordinary-camera live motion. Measure separately at
1280×720/DPR1, seven enemies, M1 Max uncapped Chromium, three 12-second windows on
representative routes; >120 FPS floor, 144 FPS target, report tails and pacing.
Deliver the reviewed MP4 through VE and Telegram; commit/push completed owned
changes. Production promotion requires the existing sealed delivery gates.

## Following slices

**G02 — Approach and silhouette.** Review the bridge-to-portal composition against
the cliff-cathedral and fortified-entrance references. Improve masonry hierarchy,
portal depth and distinct roof/stone trim where live views demonstrate the gap.
Retain bridge clearance, skyline and existing lighting budget.

**G03 — Regional exploration circuit.** Review the side keeps, detached towers and
Hollowmere chapel as distinct destinations. Strengthen readable entrances and
views, then verify a continuous normal-control circuit using the existing route
registry. Do not add another region or repeat completed route construction.

## Baseline and browser ownership

One Grok 4.6/high survey used slot 7: Vite PID 42435 / port 5873, browser PID
42486 / CDP 10037, controller PID 50771, purpose architectural survey. All seven
diagnostic placements grounded; an ordinary nave walk moved 17.38 m without
recoveries or reported GPU errors. This is not a full traversal or an FPS claim.
The worker reached its turn cap after capture. Root retained the native evidence,
reviewed the actual stills and stopped Chrome/Vite with the owned harness teardown;
both ports are idle. Evidence remains in `.cache/gothic-exploration-2026-10-08`.
User Edge/Orca sessions are preserved. Every subsequent live pass must append its
actual PID/port/URL/purpose and terminal cleanup to the same ownership notes.
