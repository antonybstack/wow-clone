# G10 source review — Vaelmark expedition journal

**Verdict: no actionable source defects in the three asked questions.** Live credit is one memorial action, gated again at activation. Unsupported localStorage stays on disk until a later successful save backs it up.

This is a working-tree read. HEAD does not contain the feature. No tests, browser, or product writes were run in this review. Root’s 20 focused tests and 7 Chromium/Havok cases are corroboration only.

## Questions

### 1. Untrusted / versioned local journal

**Yes.** `decodeExploration` caps size, `JSON.parse`s without a reviver, then `validateExploration` (`src/ashen-reach/exploration-state.js:10-21`) accepts only a plain object with exactly the four known keys, `version===1`, `episode===EPISODE`, a known phase, unique IDs from `DISCOVERY_IDS`, and phase IDs that match the phase index. The returned record is a newly built `{version,episode,phase,discovered}` with sorted IDs.

`loadExploration` (`exploration-store.js:10-16`) never writes. Failed decode or storage access leaves `EXPLORATION_STORAGE_KEY` untouched and uses `emptyExploration()` in memory, with `restored:false`. `saveExploration` (`:20-28`) validates first; if the existing KEY string fails decode it copies that raw string to `EXPLORATION_RECOVERY_KEY` before replacing KEY; any `setItem` throw returns `false` and leaves KEY as it was.

`transitionExploration` (`exploration-state.js:24-35`) is idempotent: the matching phase action credits once; a later same action returns `changed:false`; a premature phase action returns `blocked:true` without mutation; a regional ID cannot move `phase`. Unknown actions throw. The live picker only issues `read-inscription`.

### 2. Input, pause, death, reach, wall, abort

**No unintended credit or owned-listener leak found in the paths read.**

- **Input.** `KeyX` sits behind `isInputEnabled()` (`src/input.js:442,490`). `interactPressed` is set only there and on the prompt button (`exploration.js:45`). Exploration `tick` consumes it (`:58`). `setInputEnabled` always `resetInput()`, which zeroes booleans and runs `onInputReset` (`input.js:95-128`). Exploration registers `clear` there and unsubscribes on abort (`exploration.js:30,55`).
- **Pause.** Menu `open()` calls `setInputEnabled(false)` (`menu.js:301-309`). `main.js` skips `combat.beforeAnimation` while the menu is open. `allowed()` also requires `isInputEnabled()` and no `armory-open`.
- **Death.** `die()` and dead `tickLife` call `setInputEnabled(false)` (`combat.js:278-289,430-432`). `exploration.tick` runs with `dead:life.dead` before the dead return (`:610-619`); `allowed(dead)` clears the prompt and the edge. The prompt button uses `allowed(false)`, which still fails when input is disabled.
- **Reach.** `activate` calls `pick()` → `interactionReachable` again (`exploration.js:10-16,38-44`). Cached prompt is not the credit check. Physics off or a null ray returns false. `!!hit&&!hit.hasHit` treats a Havok hit as blocked.
- **Wall / nave.** Production interact is `[-8.65,y+1.15,329]` with `standingSurfaceY` at the crypt floor (`cathedral-undercroft.js` memorial hunk). Feet more than 1.2 m off that datum fail. Native check `nave-above activation rejected` matches that gate.
- **Abort.** `sceneLifetime(scene)` abort (`scene-lifetime.js:8-11`) runs `offReset()`, `clear()`, and removes prompt, style, and `journalContent` (`exploration.js:55`). Button listener uses `{signal}`.

### 3. Late, bounded, boot path, combat progression

**Yes, on the call sites read.** `createExploration` runs inside `createCombat` (`combat.js:19,158-159`). `main.js:817` still awaits foliage, then `createCombat`, then `combat-ready`. The early menu only received late getters (`getJournal`, `getExploration`) matching `getRegionMap` (`main.js:324`). `createProgression`, `awardXp`, and `settleKill` are unchanged; `exploration.tick` does not award XP or complete the churchyard objective. The undercroft diff adds memorial stand/interact metadata; the route array is the same. The only world action wired in `pick()` is `read-inscription`.

No startup-timing claim.

## Actionable issues

None observed.

## Checked

| File | What was read |
| --- | --- |
| `src/ashen-reach/exploration-state.js` | Full. Validate, transition, goal. |
| `src/ashen-reach/exploration-store.js` | Full. Load/save/recovery. |
| `src/ashen-reach/exploration.js` | Full. Reach, tick, prompt, journal, abort. |
| `src/ashen-reach/exploration-content.js` | Full. Static `JOURNAL_ENTRIES`. |
| `scripts/test-exploration-state.mjs` | Full. Eight node tests for the contract above. |
| `src/input.js` | Working file + scoped diff: `interactPressed`, `isInputEnabled`, `onInputReset`, `resetInput`, KeyX, HUD widget selector. |
| `src/ashen-reach/menu.js` | Working file + scoped diff: journal pane HTML, `open`/`openJournal`, pause `setInputEnabled(false)`, rehearsal reset, guide action. |
| `src/ashen-reach/combat.js` | Working file + scoped diff: `createExploration` in `createCombat`, `tick`/`setVisible`/`die`/`tickLife`/`releaseSpirit`. |
| `src/ashen-reach/main.js` | Menu getters (`:324`), `createCombat` options (`:817`), `onBeforeRender` skip when menu open (`:333`). |
| `src/ashen-reach/region-map.js` | `openGuide`, guide button, abort. |
| `src/ashen-reach/cathedral-undercroft.js` | Scoped diff only: `memorial` metadata. |
| `src/ashen-reach/scene-lifetime.js` | Full. |
| `src/player.js` | `raycast` `:691-708` (`ignorePlayer` → `shapeCast`; null if no physics). |
| `scripts/ashen-reach/check-vaelmark-expedition.mjs` | Full native cases (prompt, reload, menu/armory/dead, wall query, rehearsal/nave, dispose, storage denial). |
| `.cache/vaelmark-expedition-2026-10-09/g10-complete/report.json` | Seven cases, empty `errors` / `gpuErrors`. |

## Unchecked

- `main.js` module-import graph (whether `combat.js` was already a static early import).
- Lite `shapeCast` miss payload in `node_modules/@babylonjs/lite` (native prompt appearing is consistent with `{hasHit:false}` on clear air).
- `register-late-features.js`, `render-loop.js`, `prime-starter-world.js`, starter-manifest JSON.
- `createCathedralGuide` body; `isFormControl`; `syncDevQuery` vs `resetSession`’s `location.search` `dev` check.
- Other files in the “20 focused tests” set beyond `test-exploration-state.mjs` and `check-vaelmark-expedition.mjs`.
- Multi-tab `localStorage` last-write-wins.
- Runtime re-execution of any test.

Limits of this pass: six-turn budget with the report on the closing turn; no further file reads after the first integration batch.
