# World composition and readability — V20–V22

Requested after V19 frame pacing. Inspect the active game at ordinary player height; preserve the Gothic town, sunset atmosphere, shadowed fog, source character and restrained pixel rendering. The user's World of Warcraft sunset reference calls for layered silhouettes and directional atmospheric light. Existing Elden cliff references support drifting ash, but the current full-basin gold field overwhelms that hierarchy.

## Live audit, 2026-09-24

Matched 1280×720 captures: `ve-capture/ashen-reach/v19/loop/{spawn,gate,town,north,meadow}.png`, plus portrait. These are current gameplay, not historical screenshots.

- Spawn: the path and arch provide direction. Thin branches and dense bright particles compete with the distant gateway. Preserve the near tree framing and graveyard identity.
- Gate: large fern/grass cards intrude into the path. Source `scene.js` only fully excludes the meadow path below z=26; the approach continues beyond that boundary.
- Town: foliage is intentionally allowed at 12% density even on the street center. It obscures the stepping stones and enemy feet. Lamp pools already establish good rhythm; keep their shadows and material response.
- Meadow: thousands of golden particles read as a luminous carpet across the basin. The source defaults to 12,000, enlarges distant particles, and only fades at 55–120 m. Air movement should be local enough to support depth rather than erase it.
- North terrace: castle roof line reads, but lower mass merges with similarly colored trees and terrain. Foreground paving is broad; preserve its terrace identity. The castle is a backdrop outside the playable boundary, not a promised reachable destination.
- Remaining broader limits: simple distant tree shapes, repeated building kits, plain enemy proxies, branch aliasing and camera/terrain edge cases. These need separate art or gameplay slices; this pass does not claim complete world art.

## V20 — continuous walking corridor

Introduce one pure clearance policy used by meadow and town placement. Protect the center across the entire traversable route, account for plant card footprint, feather vegetation into the verge, retain sparse low growth outside the protected strip. Keep physics, terrain and route layout unchanged. Test exclusion/transition for all route zones; compare spawn/gate/town, walk both directions and portrait. Deliver reviewed live motion, commit and push.

## V21 — local atmospheric accents

V20 completed: the ground shader had a second gap (church path ended at z=28, street started at z=40). Extended its blend to meet the street, removed center growth through all route zones and allowed 0.6 m for cards when scattering. Matching gate/town captures now show continuous paving and visible feet. Reviewed 13.58-second live motion includes labeled cuts and real keyboard walking. Pure policy tests and live packed-root assertions pass; pause/resume, portrait and runtime/GPU checks pass. No global exposure or fog change was needed. Video: https://ve.sparkify.dev/wow-clone/ashen-reach/v20/2026-09-24-walk.mp4.

Reduce the uniform mote population and distance/size amplification. Keep seeded motion, smooth birth/death and lens fade; let fixture proximity contribute gently without filling every view with gold. Use existing single-batch billboard infrastructure. Compare meadow, gate and town, including moving camera. Verify shader compilation and no runtime/GPU errors; deliver motion, commit and push.

## V22 — castle sightline and silhouette

V21 completed: 4,200 seeded motes replace 12,000; distance fade is 18–60 m, size compensation tops out at 1.35× instead of 3.2×, brightness is 70% of the old value. Matching meadow capture now separates terrain, fog and distant silhouettes; nearby ash still moves with parallax. Shared CPU/WGSL visibility policy has continuity/end-point tests. Reviewed 13.42-second live keyboard motion, packed path-root assertions and runtime/GPU checks pass. Video: https://ve.sparkify.dev/wow-clone/ashen-reach/v21/2026-09-24-walk.mp4. Review also found two V20 refinements for the next pass: use a complementary paving blend at z=40–48 and reserve more footprint for large fern cards.

Protect a widening view corridor from the north terrace to the castle in distant tree placement. Keep clustered woods on both sides, mountains and the real sun shadow caster geometry. Avoid unrelated exposure/fog tuning that would wash out foreground combat. Check north view plus oblique viewpoints so the corridor reads as a plausible opening, not a rectangular cut. Test placement mask and deterministic counts, capture motion and portrait, benchmark separately, commit and push.

## Acceptance and iteration

Implement one milestone at a time. Review the same live views before choosing corrections. New GPU errors, blocked walking controls, visibly abrupt vegetation transitions, lost silhouettes or increased frame stalls fail the pass. Run focused unit and live regression checks, a final build, and an isolated 1280×720 seven-enemy traversal without recording. Report actual rendered FPS and p95/p99; retain the >120 FPS goal and disclose remaining tails. Publish reviewed MP4 evidence on Telegram and record retrospective findings. Production deployment is a separate action from this request's commit/push workflow.
