# M7 persistence review — saved dyes and atomic recolours

Reviewer: Grok 4.6 (read-only). HEAD `1412770` plus the working dye-persistence diff. Scoped to equipment-loader, equipment-stream, main, creator, production dye session, remote-pieces/renderer, multiplayer/client, the two node tests, check-dye-persistence, and measure-dye-gap. AGENTS.md ignored. No game, harness, or git mutations.

Parent reports 24 live functional cases, 13 remote lifecycle cases, and 40 zero-gap recolours. Those do not cover the player fence on a **new equipment instance** or on **idle reuse**, which is what this file flags.

## Summary

Same-item replacement in the loader is sound: the committed owner stays in `cache` through prepare/fence/failure, the new owner lives in `replacements` until `commit`, and `finally` disposes only uncommitted replacements. Slot dyes are filtered to occupied streamed slots, written through `rememberAppearance` only after `status==='applied'`, and the dye session records undo after that commit and restores the map on apply failure. The defect is the **player** `beforeCommit` predicate, which treats “this dyed id is not the current live entry” as a recolour and then force-rebuilds every PBR group in the scene, including while a previous outfit is still the visible one.

## Issues

### Issue 1 -- Severity: bug

- File: src/ashen-reach/equipment-stream.js:388
- Description: `newColour` is true whenever a dyed id in `next` is not already the `liveEntries` owner. That is the same-item replacement case, and also three paths that have **no replacement of a currently visible piece**:
  1. Boot of a **new** `createStreamedEquipment` with dyed `bootLoadout`. `liveEntries` starts empty, so every dyed boot id satisfies `cache.get(id)!==liveEntries.get(id)` and `cache.get(id).dye!==null`.
  2. Compact→full after playable (`main.js:567`), race switch (`main.js:466`), and first body-family promotion (`main.js:668`). Each constructs a fresh stream with `dyes:previous.getDyes()`, `visible:false`, then awaits boot **while the previous impl is still visible**.
  3. Re-showing a **reusable idle** dyed piece (same id, `isReusable` true, nothing in `replacements`). `liveEntries` still holds the other slot occupant, so the idle id compares unequal and the fence still runs.

  When `scene._built` is set, that predicate does not no-op. It dynamically imports `src/character/crowd-probe/town.js` (module header: “Never imported by the shipped route”), claims **every** staged cache mesh (worn, idle, and replacement overlay), and `await rebuildScenePbrPipelines(scene, true)`. Lite’s rebuild walks all PBR groups, holds per-mesh disposers, and retires the previous GPU pipelines (`node_modules/@babylonjs/lite/lib/scene/scene-rebuild.js`, `rebuildSceneGroups` / `retireOld`). The still-visible compact/previous outfit and the rest of the built scene are in those groups.

  Undyed boots skip this (`dye===null` and no live dye). Dyed saved-character promotion is the persistence path this work exists to land.

  `context.recolour` is still computed at line 408 and is unused by the fence.

- Suggestion: Fence only when a **live** id is being replaced: `liveEntries.get(id) && cache.get(id)!==liveEntries.get(id)` (or `replacements.size` if that map is passed through). Keep addToScene’s normal queue for first insert, idle reuse, and hidden boots. Pull `claimQueuedBuilds` out of `crowd-probe/town.js` if the player path must call it.
- Status: open
- Evidence: demonstrated in source. Whether it hitches is a measurement the parent owns; the predicate and the full-group rebuild are not speculative.

### Issue 2 -- Severity: suggestion

- File: src/ashen-reach/equipment-loader.js:73
- Description: Player `createStreamedEquipment` now always passes `beforeCommit`, so `dispose()` takes the delayed `chain.then(dispose cache)` path whenever any request is `active`, not only remote native builds. `replacements` are still not in that snapshot; the in-flight `finally` (line 53) disposes them. Race/compact-full dispose the previous impl after swap and after `actorRequest` serialisation, so the usual promotion path is not this case. A player `dispose` during an in-flight equip/recolour will leave the old cache meshes in the scene until the fence finishes, and the fence does not take the abort until after `rebuildScenePbrPipelines` returns (`equipment-stream.js:400`).
- Suggestion: Delay cache disposal only when a native fence is actually running (the `newColour` / remote `options.beforeCommit` await), or hide via `setVisible(false)` before delaying, matching the remote `options.beforeCommit` hide in `equipment.dispose`.
- Status: open
- Evidence: demonstrated control-flow change. No live failure shown; the 13 remote lifecycle cases exercise the remote hide+drain path, not this player branch.

## Checked, no defect found

**Loader replacement / failure / cancel.** Non-reusable ids go to `replacements` rather than overwriting `cache` (`equipment-loader.js:30-31`). `staged` overlays them for fence and `commit`. Success swaps then `old.dispose()` then `replacements.clear()`. Failure/supersede/dispose leave `cache` on the committed owner; `finally` disposes leftovers. Tests in `scripts/test-equipment-loader.mjs` pin retain-until-commit, failed pipeline, and dispose-during-fence keeping both owners until `drain`.

**Idle colour identity.** `isReusable` compares `entry.dye` to `context.dyes[slot]??null` (`equipment-stream.js:371`). A moss idle tunic is reused when the slot dye is still moss and rebuilt when it is not. `dyeSelection` drops dyes for empty slots (`equipment-stream.js:123`), so unequip clears colour. `entries` is a `Set` of owners, so disposing the retired copy cannot delete the replacement.

**Save / undo.** `equipRequest` calls `rememberAppearance` only on `applied` (`main.js:409-411`), overlaying `impl.getDyes()` onto the loadout recipe. Failed `setDye` does not write storage. `createProductionDyeSession` validates, applies, then pushes the pre-apply map; apply failure does not record undo; undo failure pushes the map back (`production.js:21-26,43`). Equipment/race signature clears colour history; body shape does not. Creator `runDye` restores selects from the committed appearance in `finally`.

**Startup / remote / presence wiring.** Human boot passes `bootAppearance.dyes` (`main.js:367`). Compact→full, race restore, and body promotion pass `getDyes()` / `restoreAppearance.dyes`. Remote boot and live `setLoadout` pass `recipe.dyes`. Presence `applyLocal` passes `value.dyes`. These are the right hand-offs; the cost of a dyed **new-instance** boot is Issue 1.

**Phantom recipe.** `dyeSelection` rejects unknown slots/ids before `loader.request`. Stream `dyes` is assigned only in `commit` after `apply`. Creator `applyDyes` throws unless `status==='applied'`.
