# G07 — Vaelmark exploration guide

The eight-hour Gothic exploration goal authorizes the next independent source
slice while renderer-isolation and separate release gates are pending. Existing
architecture/routes are already delivered; players need a readable way to find
its different levels. Add **Vaelmark exploration** inside the ordinary Region map.

Use cathedral metadata already in the world: nave bounds, entry/altar, chapel
entry/stair/gallery/parapet connections, undercroft bounds/route and both tower
routes/landings. Draw a clearly labeled schematic of authored routes, not an
invented architectural survey or pathfinding result. Offer five level selections
with textual directions, connection markers, a player arrow only on its matching
level and an explicit off-level/outside status. Preserve region selection/minimap
pins when returning to the region chart. Route lines must not connect points on
unrelated floors. Bell towers show their ascent as a separate stair diagram.

Reuse existing map transforms/pins, native Canvas2D and the region-menu pause,
focus/abort lifecycle. Cache static plans per level; paint only on open/selection.
Keep the module on the existing late combat/region-map path. No mesh, texture,
asset preparation, timer, frame hook, coordinate clamp, movement shortcut or
second input/pause manager. No developer-only teleport in the ordinary guide.

Verify metadata-driven routes and level classification with meaningful CPU checks,
then native five-level navigation, text/selection, pause/focus/return, retained
region/minimap guidance, actual Havok walking and disposal. Root reviews live
motion of opening the guide at different public developer floor placements and
normal movement; publish a sealed desktop preview with served/public controls,
VE and Telegram motion. Commit/push and ownership teardown. Performance and
production acceptance retain their separate pending gates; no FPS claim from HUD.
