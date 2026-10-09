# G04 region map — independent source review

Date: 2026-10-09
Scope: dirty root G04 Region map (working tree). Product edits, browser, builds, benchmarks, publishing, subagents: none.
Reviewer: source-only. Root owns native UI tests and visual acceptance.
Status: report-only salvage after the initial eight-turn cap. This review did not finish a clean CLI exit and does not claim native acceptance.

## Review mandate (from G04 plan)

Useful region map in the existing Esc/Menu hub during ordinary play. Eight registry names, authored roads, central street (well-square detour), north, current position, cathedral bridge. Textual list beside canvas. Select highlights existing route + distinct minimap pin; Clear destination removes it; preserve watchman objective. Share per-instance map-coordinate transform. Draw large map on open/selection. Combat minimap cadence for guidance pin. Closed panel out of the frame loop. Map drawing/geometry on late combat/minimap path; early menu only requests an already-ready provider. No Classic Babylon imports or invented engine paths.

## Observed

Dirty G04 files: `ashen-reach.html`, `src/ashen-reach/{map-drawing,region-map,minimap,menu,combat,main}.js`. Unrelated dirty `AGENTS.md` and `docs/plans/character-mmo/next-ten.md` ignored.

New modules: `map-drawing.js` (pure transform + static/pin painters), `region-map.js` (late chart; imports `./geometry.js` and `./map-drawing.js`).

Wiring:

- `menu.js` adds a hidden Region map pane and a `getRegionMap` getter. It imports only `../input.js`.
- `main.js` constructs the menu early with `getRegionMap:()=>combat?.regionMap`, then after `await createCombat(...)` calls `menu.refreshRegionMap()`.
- `combat.js` statically imports `createRegionMap` from `./region-map.js`. `createCombat` is loaded with `import('./combat.js')` in a later `Promise.all` (combat/enemies/npc/townsfolk/armory), not as a top-level `main.js` import.
- Combat constructs `createRegionMap({player, world, signal:lifetime})` and passes `destination: () => regionMap.selected` into the minimap. Watchman remains `marker()` from `objective?.snapshot()`.
- Minimap dropped module-level `viewBounds` / `worldToMap`. Each view now calls `createMapTransform(bounds, width, height, padding?)`.
- `ashen-reach.html` adds panel CSS for the chart/list. No new input shortcut.

Registry (from `region-layout.js` + `scene.js`):

- `world.landmarks` is `REGION_LANDMARKS`; `world.routes` is `REGION_ROUTES`. Region map reads `world.landmarks` / `world.routes`. Minimap uses `world.routes || REGION_ROUTES` and `world.landmarks || REGION_LANDMARKS`.
- Eight authored names: Eastwatch, Westwatch, Southwatch, Ash Tower, Moor Tower, Bell Watch, Hollowmere Chapel, Vaelmark. Towers have distinct names on the large chart/list; the small minimap still paints `T` for every tower.
- `initializeRegionRoutes` attaches `.route` only for the seven `authored` ids. Vaelmark is not in that list and has no `.route` on the landmark object as read.
- `pathX` is `z => Math.sin(z*.14)*1.25`. Map street detour is `streetMapX` around `buildingPads[8]` `{x:0,z:136,w:16,d:11}` (west x = -2.8 for z in [132, 140], with approach/leave blends). Both maps share that painter.

Lifecycle (from `menu.js`, `region-map.js`, `minimap.js`, `main.js`, `combat.js`, `scene-lifetime.js`):

- Menu open still calls `setInputEnabled(false)` and `showHub()`. Region map action hides hub/keys/dev, shows the map pane, calls `refreshRegionMap()`, `focusFirst()`.
- `onBeforeRender` returns early when `menu.isOpen`, skipping `combat.beforeAnimation` / `afterAnimation`. Large-map `paint()` is invoked from `open()` and destination/clear clicks only.
- Region-map static layer is filled once in `mount()`. Subsequent paints `drawImage` that cache, then selection overlay + player pin.
- Abort (`sceneLifetime` on scene dispose): region map removes content, clears `selectedId`, nulls canvas/ctx/staticLayer. Destination buttons use `{signal}`. `paint()` returns if `!canvas || signal.aborted`. `open()` after abort returns `false`. Minimap abort removes wrap/style.
- Menu itself has no abort/lifetime. `combat` is assigned after create and was not observed being nulled on dispose in the lines read.

Native check script present on disk: `scripts/ashen-reach/check-region-map.mjs` (open/select eight names/pause/focus/retain/clear/Esc, pixel-count blue diamond vs gold watchman). This review did not run it.

G04 files `map-drawing.js`, `region-map.js`, `minimap.js`, `menu.js` have no `@babylonjs` Classic imports. `combat.js` / `main.js` continue to use `@babylonjs/lite` only (pre-existing).

## Findings

### Correctness

1. **Vaelmark has no registry route, so selection cannot highlight one.** Static paint falls back to `cathedral?.route || [[0,0,145],[0,0,298]]` for the bridge. Selection overlay calls `strokeMapRoute(ctx, transform, site.route)`, which returns immediately when `site.route` is missing. Status text still says “Follow the blue route from the central street” for Vaelmark. Plan requires selecting a destination to highlight its existing route. The cathedral bridge is drawn as static ink, not as a selected overlay.

2. **`check-region-map.mjs` reads `s.route.length` for every landmark.** With Vaelmark’s `.route` absent in `region-layout.js`, that evaluate would throw before the eight-name assertions. This review did not execute the script, so runtime failure is inferred from source, not observed.

3. **Guidance uses the same landmark objects as the world registry** (ids, names, `entrance`, seven attached routes). No second destination table was added. Developer jumps stay in Developer tools.

4. **Well-square detour is in shared `streetMapX`, keyed off `pads[8]`.** `buildingPads` has 13 entries; index 8 is the north square. There is no length/identity guard; a shorter pads array would throw inside `paintMapStatic`. Current callers pass `buildingPads`.

5. **Shared painter changed minimap projection.** Old `worldToMap` stretched X and Z independently to fill 128×148. `createMapTransform` uses uniform scale and letterboxes. Destination pins also clamp to a 7 px inset. Source-level coordinate shift for the existing minimap; live magnitude not measured.

6. **All eight landmarks sit inside region-map `CORE_BOUNDS` {-260..260, -250..380}.** Southwatch z=-214, Vaelmark z=330, Eastwatch x=196. Chart padding is 28 on a 560² canvas.

### Performance / startup

7. **`menu.js` does not import geometry, region-map, or map-drawing.** The early menu only stores a getter. Opening the pane before combat-ready leaves “Preparing the region map…”; `refreshRegionMap` no-ops until `combat?.regionMap` exists.

8. **`region-map.js` → `geometry.js` is on the combat module graph**, which `main.js` already loaded dynamically with minimap (minimap already imported `buildingPads`/`pathX` from geometry). `createRegionMap` at combat construct time allocates closures and an abort listener; DOM/canvas work waits for first `open()`/`mount()`.

9. **`main.js` already imported `height` from `./geometry.js` at the top** before this slice. That pre-existing main-path geometry import is outside G04’s “do not pull procedural geometry into the early menu” rule; G04 does not add a new menu-side geometry import.

10. **Large map is not ticked.** Closed panel has no RAF hook. Minimap `update()` still runs from combat `afterAnimation` when combat `visible` is true, including `paintDestinationPin`. Static minimap cache still rebuilds when the 64 m cell key changes.

11. **Vite chunk membership was not measured.** Source imports keep region-map off `menu.js`. Whether the bundler emits region-map/map-drawing onto an early shared chunk is unverified.

### Accessibility / input

12. **Reuses the existing dialog.** Region map is a pane inside `#game-menu` (`role="dialog"`). Esc still closes the whole menu; Back (`data-action="hub"`) returns to the hub. No second pause manager, no new keybinding.

13. **Focus loop includes the map pane** (`activePane` prefers `.game-menu-map`). Destination controls are `<button>`s with `aria-pressed`. Clear is `disabled` when nothing is selected and is omitted from `focusable()`. Canvas is `role="img"` with an `aria-label` rewritten in `paint()`. Status node is `role="status"` and `textContent` is assigned only when the string changes.

14. **First focus after opening the map is the first destination button** (`focusFirst()`). Close restores input (unless death veil/armory) and focuses `#renderCanvas`.

15. **Developer-tools / keys actions do not hide `mapPane`.** Ordinary flow cannot reach those actions from the map pane (only Back). `open()` and `showHub()` do hide the map pane.

### Lifecycle / disposal / late UI

16. **Region-map `paint`/`open` after abort do not read `player.body`.** Buttons are aborted with the scene signal. `selected` becomes `null`, so the minimap destination getter stops returning a site.

17. **Menu is not cancelled with the scene.** After dispose, the hub can still open Region map; `open()` returns `false` and does not remount. If the pane was already mounted, abort `content.remove()`s the chart, leaving title/Back and an empty `[data-region-map]` (the “Preparing…” placeholder was already replaced).

18. **Minimap `update()` still reads `player.body.position` with no `lifetime.aborted` guard.** Combat `afterAnimation` likewise has no abort check at its start. That player-body access is pre-existing; G04 adds `destination?.()` (safe after abort) and DOM removal on abort. Whether `onBeforeRender` can still call `afterAnimation` after `disposeScene` was not traced past `sceneLifetime` abort-on-dispose.

### Map-coordinate / registry

19. **Transforms are per-instance closures.** `createMapTransform` holds no module state. Region map uses fixed `CORE_BOUNDS` + padding 28. Minimap rebuilds a new transform from the current cell bounds. The large chart cannot mutate minimap coordinates through shared bounds.

20. **Watchman and destination are separate draw calls.** Gold chevron from `marker()`; cyan diamond from `paintDestinationPin`. Selection does not write `objective`. Hollowmere chapel entrance `[4.1, …, 114]` is not the watchman at `pathX(75)+1.45, z=77.4`. Destination is edge-clamped; watchman is not. A clamped destination can occupy the same pixels as an on-canvas watchman in some cells; that overlap was not simulated.

## Explicit assessments

### Can geometry leak onto the early menu / startup?

**From source imports: the early menu module does not import geometry or the chart.** `getRegionMap` is a runtime getter onto the combat-created provider. Region-map’s `geometry.js` import sits behind `import('./combat.js')`.

**Not established:** actual Vite/Rollup chunk graph, first-play byte delta, or whether HTML/CSS for the hidden pane has a measurable startup cost. `main.js` already imported `geometry.js` before G04.

### Do large-map and minimap transforms interfere?

**From source: they do not share mutable transform state.** Each view builds its own `createMapTransform`. The previous minimap module-level `viewBounds` is gone.

**Not established:** live pin alignment after the uniform-scale change, or visual clash of a clamped destination with the watchman chevron.

### Is the static cache drawn only on events?

**Large map, from source: yes.** `paintMapStatic` runs once in `mount()`. `paint()` runs on open and on select/clear. Menu-open skips combat `afterAnimation`, so the open chart is not on the frame loop.

**Minimap, from source: static layer rebuilds on 64 m cell change; destination/player/enemies/watchman draw every visible combat tick.** That matches the plan’s “reuse the combat minimap cadence for the selected guidance pin.”

### Does selection preserve the watchman objective?

**From source: selection does not mutate the objective object.** Marker and destination are independent. The native check script asserts objective snapshot equality and counts both gold and blue pixels.

**Not established:** that pixel coexistence holds in the running game (script not executed). Residual on-canvas overwrite remains possible when a clamped diamond lands on the chevron.

### Does disposal prevent late UI access?

**Partially, from source.** Region-map paint/open/click paths are abort-safe and drop `selectedId`. Minimap DOM is removed on abort.

**Insufficient to call it complete.** The menu is not on `lifetime`. An already-open map pane can be emptied rather than restored to the preparing status. Minimap `update` / player-pin still touch `player.body` if a combat tick runs after abort. `combat` was not observed being cleared on dispose.

## Executed vs proposed probes

Executed:

- `git status` / `git diff` of the named G04 files
- Read G04 plan, `docs/CURRENT.md`, dirty `map-drawing.js`, `region-map.js`, `minimap.js`, `menu.js`, relevant `combat.js` / `main.js` slices, `region-layout.js` landmarks/routes, `geometry.js` `buildingPads`/`pathX`, `objective.js` watchman, `scene-lifetime.js`, `scripts/ashen-reach/check-region-map.mjs`
- Ripgrep of G04 imports, `createRegionMap` / `getRegionMap` wiring, `@babylonjs` in those files, landmark/objective/minimap usage, menu tests

Proposed, not executed:

- Bundler/import-graph or first-play byte measurement
- Running `check-region-map.mjs` or any native UI test
- Browser open/select/clear/Esc, live clip, FPS windows
- CPU probe of `streetMapX` / `createMapTransform` / `paintMapStatic`
- Exhaustive repo search for any later `vaelmark.route` assignment outside `region-layout.js`
- Full `reset()` / `disposeScene` path for `combat` nulling and post-abort `onBeforeRender`

## Not checked

- Live visual acceptance, motion clip, Telegram/VE
- Native UI test execution and harness ownership
- Builds, FPS, startup timing
- Vite chunk split of `region-map.js` / `map-drawing.js`
- Label overlap/clipping on the 560² chart
- Touch/mobile layout of the new pane (plan defers mobile)
- Unrelated dirty `AGENTS.md` / character `next-ten.md`
- Whether root’s in-flight native tests already caught Vaelmark `.route`

## Limits

Source-only, no product edits, no browser, no builds/benchmarks. Visual acceptance and native UI tests belong to root. Salvage used only evidence gathered before the eight-turn cap; remaining probes above were not run. Findings 1–2 (Vaelmark route / test `s.route.length`) are source inferences. Do not treat this file as a pass or as a substitute for the live map-selection clip.
