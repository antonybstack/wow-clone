# World expansion toward an MVP — 2026-09-19

Status: **active**. Started 2026-09-19 from `main` at `6b7f18e`, with the production build and both
test suites green. The Orc character pipeline is complete enough to stop polishing; this plan moves
effort to the world, then to a combat loop.

## Why this plan

Ashen Reach has a credible character, eight fitted garments on two races, two spells and an armory.
It has one small churchyard and one static training dummy. The gap between this and a playable MVP
is world and encounter content, not character fidelity.

## Design: the settlement of Ashen Reach

The churchyard is preserved exactly as approved and the world grows north along the road that
already exists as `pathX(z)`.

| Zone | Extent (z) | Content |
|---|---|---|
| Approach | < 0 | Sparse dead ground, ravine edge as a soft boundary |
| **Churchyard** | 0–40 | Unchanged: spawn, tombs, chapel ruin, lanterns |
| Lych-gate and climb | 40–75 | Road rises out of the burial ground through a gate |
| **Hollowmere** | 75–140 | Walled town: gatehouse, main street, tavern, smithy, chapel, houses, market stalls, well square, watchtower |
| Ridge and vista | 140+ | Citadel of Vaelmark on a distant crag, curtain walls, five towers, lit windows, mountain ridgeline |

Traversable ground grows from roughly 180×240 m to roughly 400×600 m. The citadel is a backdrop and
is not traversable. Night atmosphere and the warm-lamp palette are unchanged.

## Architecture constraints found before starting

The world is generated in code, not imported. `geometry.js` accumulates triangles into a `Batch` per
material and `scene.js` commits nine batches. That produces 46 draws and 126,512 triangles at 144 FPS.

Two properties of that design bound the work:

- **Lighting does not scale.** `materials.js` hardcodes two lamp positions in the WGSL fragment
  shader plus three dynamic slots for fire, hand fire and lava. A town of lit windows and street
  lamps cannot be expressed in that shader as written. Milestone 1 addresses this first because
  every later milestone would otherwise be built on it and need redoing.
- **No culling or level of detail.** One mesh per material means the full triangle set is submitted
  every frame. This is acceptable now and is measured at each milestone rather than pre-optimized.

## Milestones

**M1 — Scalable lighting and the road north.** Replace the two hardcoded lamps with a light set the
shader can iterate, or bake static lamp contribution into vertex colour, whichever measures better.
Extend terrain and road to z=140 with flat building pads. Lych-gate and town walls.
*Gate: the churchyard renders unchanged; FPS measured before and after and reported.*

**M2 — Hollowmere.** A parameterised `building()` builder in `geometry.js` so buildings are composed
rather than hand-placed. Populate the town, add colliders, light interiors visible through windows.
*Gate: walk the full road from graveyard to town in a live capture.*

**M3 — The horizon.** Citadel, curtain walls, mountain ridgeline, sky and fog tuned for depth.
*Gate: reviewed clip of the vista from the town gate.*

**M4 — Enemies and a combat loop.** Roaming enemy with aggro, chase, attack, death and respawn.
Player damage, death and resurrect. `src/character/npc.js` is the starting point.

**M5 — Progression and interface.** Experience, levels, health and mana regeneration, nameplates,
experience bar, minimap.

**M6 — Performance.** Spatial chunking, frustum culling and level of detail, activated only if the
M1–M3 measurements show the >120 FPS goal is threatened.

## Parallel harness

A separate track builds a repeatable worktree harness so more than one agent can verify live at the
same time. Today CDP port 9337 is hardcoded in more than twenty scripts and Vite is pinned to 5173
with `strictPort`, so live verification is a single shared resource. The harness gives each worktree
its own Vite port, its own Chrome profile and CDP port, and one command to start and stop them.

## Invariants for every milestone

- The churchyard as approved on 2026-09-19 renders unchanged unless a milestone explicitly revises it.
- Orc and Human character, garment, spell and armory behaviour are untouched.
- Report actual render resolution and frame-time distribution with any FPS claim.
- Automated checks are not visual acceptance. Nothing is marked accepted while the user is away;
  completed work is staged for review.

## Status log

- 2026-09-19: plan created. `main` pushed to origin at `6b7f18e`. Build and both suites green.
