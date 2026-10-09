# Following G03 — make the region easier to explore, then add a new high route

The active eight-hour goal authorizes further Gothic exploration work after the
original slices. Implement sequentially after G03's completed delivery. These are
proposed follow-on slices, not completed work or a replacement for current gates.

## G04 — A useful region map — complete 2026-10-09

[Actual implementation, native UI/disposal, performance and public delivery](../../baselines/g04-map-2026-10-09/README.md). Product9d5d4fe / preview4f787280 / Telegram896.

The live map compresses the whole region into 128×148 pixels and labels three
towers identically with T. Players cannot read destination names or plan a tour.
Add **Region map** to the existing Esc/Menu hub, available during ordinary play.
Use the existing modal/input/focus lifecycle; do not add another pause manager.

The map shows all eight names, authored roads, the central street, north, current
position and cathedral bridge. Use the existing landmark/route registry, not a
second set of destination coordinates. Account for the well-square detour found
by G03. Offer an accessible textual list beside the canvas. Selecting a destination
highlights its existing route and a distinct minimap pin; **Clear destination**
removes it. Preserve the existing watchman objective marker. This is map guidance,
not an invented pathfinder or automatic movement. No hidden development feature:
existing ?dev destination jumps/spawn links remain in Developer tools.

Share a pure map-coordinate transform and static route painting where useful.
Draw the large map when opened or selection changes. The existing main loop
pauses movement/combat updates while the menu is open, so its player position is
stable: no new frame-loop hook is required for the open map. Reuse the combat
minimap cadence for the selected guidance pin during ordinary movement. Keep the closed panel out of the frame loop
and only change DOM text when the displayed value changes. No textures, meshes,
scene lights, asset rebake, intervals, new rendering engine or input shortcuts are
necessary for this slice. Do not add persistent achievements or quest changes.

Keep map drawing and geometry imports on the existing late combat/minimap path;
the early menu only requests its already-ready provider. Importing the full
procedural geometry module into the early menu would undermine startup work.
Reuse the minimap's offscreen static canvas pattern and native 2D canvas APIs.
Use per-instance bounds/transform so the large chart cannot change minimap
coordinates. A selected distant pin should remain visible at the minimap edge,
without overwriting the watchman objective. Label all eight registry names on
the chart/list, differentiating the three towers.

Verify real menu open/select/clear/back/Esc, input restoration, objective-marker
coexistence and retained destinations. Root reviews a live map-selection and
ordinary walking clip. Measure separately under the same five-route 15-window
conditions. Complete commit/push, sealed preview/public native checks, served
assets, reviewed VE/Telegram motion and ownership cleanup before G05.

## G05 — Eastwatch wall walk — complete 2026-10-09

[Actual construction, native/public climb and eight-destination circuit, performance
and delivery](../../baselines/g05-wall-walk-2026-10-09/README.md).
Product c3419d4 / preview ae9f12cc / Telegram 897.

Survey the actual Eastwatch courtyard and retained fortified-entrance reference
before geometry changes. Add one guarded, visibly stair-accessible high route
along the inside of the side/rear curtain walls, giving a view across the region
and through the G03 hall lancet. Preserve the existing gateway, courtyard centre,
hall and skyline. A single useful new route comes before copying it to other keeps.

Use the existing architecture's visible steps + smooth collision-ramp pattern.
Keep a minimum 1.8 m clear walking width, at least 1.9 m headroom and continuous
railings at exposed inner edges; maintain solid existing outer merlons. Seat the
walk on masonry consoles. Keep its stairs beside the courtyard boundary rather
than across the hall approach. Confirm placements against actual wall/roof and
buttress coordinates; the sketch is not a license to overlap them.

Add the landing to built exploration metadata and **?dev → Developer tools**
using the same destination handler, plus a shareable spawn link. Test normal
courtyard ascent/wall traverse/return, outer/inner rails, doorway clearance and
raised-window interaction with Havok active, no Fly/recovery teleports. Preserve
all eight G03 routes. Prepare/build sequentially, verify exact near bytes and
optional-packet deltas, then the usual isolated performance and delivery gates.

Production remains held by its separate startup qualification. Mobile, another
region, character assets, multiplayer scale and combat changes remain deferred.

## G06 — Connected Eastwatch hall balcony — functional preview, FPS pending

[Actual implementation and qualification limits](../../baselines/g06-hall-balcony-2026-10-09/README.md).
Product1b35554 / preview2fd14837 / Telegram898. Ordinary local/public entry/return,
guards, developer controls, map and served files pass. Fresh renderer isolation
is unresolved; no new FPS claim. Complete that gate before another visual slice.

[Concrete placement and implementation sequence](g06-hall-balcony-2026-10-09.md).
Reuse the delivered stairs and rear walk; connect its raised pointed opening to a
supported guarded interior balcony, preserving the ground hall lane. Widen that
opening for actual doorway clearance, give the landing an existing developer UI
entry/spawn link, and qualify normal ascent/entry/return, guards and lower passage.
Continue the active Gothic goal without waiting for user review.
