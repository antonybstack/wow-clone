# G07 — Vaelmark exploration guide — 2026-10-09

Implemented in the ordinary **Menu → Region map → Vaelmark exploration** panel.
Five selectable views cover nave/chapels, undercroft, gallery/parapet and both bell
towers. Level detection includes height and tower footprint, so vertically stacked
routes do not share a misleading player arrow. Plain directions explain the real
chapel/terrace connections and ordinary return routes. Tower ascent diagrams show
approximate progress by height, explicitly described as a schematic rather than
a floor plan. Existing developer destinations remain the reproducible controls.

The guide uses the existing cathedral route metadata/map primitives/menu input,
focus/scene lifetime. Static layers cache by level and repaint only on open or
selection; no new frame hook, timer, scene mesh, texture, world rebake, physics,
teleport or pathfinder. It stays in the existing late combat/region-map module
graph. Returning preserves the regional destination/minimap pin. Outside/other
levels hide the player marker and say why. Hidden nested controls are omitted from
the existing menu focus trap through native getClientRects.

Four meaningful guide/model tests plus six startup-asset checks pass (**10 total**):
flat routes never connect unrelated floors; location separates the crypt, gallery,
tower staircase/landings and outside/connecting stairs; diagram endpoints clamp
slightly elevated Havok feet and interpolate intermediate runs; shifted source
heights are reflected rather than duplicated coordinates. Startup build passes.

Compiled native checks pass ordinary five-level selection, outside status,
keyboard focus wrap, pause, back focus and retained region selection. Public
existing developer placements reproduce six physical locations (nave, undercroft,
gallery, parapet, west/east bell), each showing its matching view/marker with Havok
active, Fly off and zero recoveries. Normal nave walking resumes; guide and region
nodes disappear on actual scene disposal; no runtime/GPU errors. Existing ordinary
region map/minimap objective/selection/disposal and twenty developer landing /
spawn-link/God/Fly/focus checks also pass locally.

Root reviewed actual captures and corrected overlapping labels, label rectangles
that obscured short connectors, nested-menu keyboard focus and the top bell-marker
wrap. Final public motion/preview details are recorded below after delivery. The
first diagnostic capture at960×540 internal rendering remains superseded locally;
final capture uses1280×720 viewport/canvas, DPR1, square pixels/rotation0/timestamps.

Grok4.6/high source-only reviewer finished five turns (`end_turn`), session
01a120a9-d471-7b51-8177-83a48c43189f. Root received the final report, without observing
an intermediate checkpoint. Its top-landing marker defect was valid and already
corrected in parallel with a pure clamp/interpolation test. Its flat-route concern
is hypothetical for the current strictly ascending tower metadata; UI accurately
labels its height-derived marker approximate. The reviewer did not read metadata,
menu/map primitives or run native checks; root read and tested those. No review
or screenshot alone is performance/visual acceptance.

**Isolated FPS remains pending** along with G06 and the loading candidate: unrelated
user Shadowglass rendering status is unconfirmed. No claim from the captured HUD.
No geometry/asset changes or new per-frame work, but this is not a measured regression
proof. Production's independent startup/required-texture qualification hold remains;
mobile remains explicitly backlogged. No canonical production promotion.

Delivery, exact seal/media bytes, public native checks and final ownership teardown
follow below. Preserve user Edge2931/fifteen tabs, Chrome13883/New Tab, Orca and unrelated
Vite4000. G07 root owns Chrome33002/CDP10037, Vite32939+32977/5873, compiled preview7074
and any motion-only review/media tabs; one game context at a time, functional checks
only. Grok33980 source-only, finished with no browser. Captures/diagnostics remain
.cache/g07-cathedral-guide-2026-10-09; public media is the durable artifact.
