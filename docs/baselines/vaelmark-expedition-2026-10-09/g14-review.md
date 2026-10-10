# G14 source review — Hollowmere return

**Verdict: no consequential defect on the three questions.** Working-tree diffs: `buildings.js`, `scene.js`, `exploration.js`, `menu.js`; untracked `scripts/ashen-reach/check-hollowmere-return.mjs`. Early altar visits never call `transitionExploration` or `saveExploration`. Repeat `returned` is idempotent (`changed:false`). Altar metadata is the chapel `building()` return, JSON-cloned into prepared metadata and spread onto the prepared world, and attached on the direct `api`. Interact is air in front of the cap. `journal-region-map` hides the journal pane, opens the late region-map provider with `open()`, and leaves input/focus/abort with the existing menu.

No tests, browser, renderer, build, source edits, commit, deploy, or user message. Parent owns live verification and adjudicates. This report does not claim visual acceptance. A checkpoint was written after the first batched read.

Unparenthesized `reliquary?.snapshot().open` and `world.hollowmere?.altar` short-circuit; they are not thrown reads.

## Questions

### 1. Early altar visits, repeats, unknown saves, duplicate reward

**No skip, overwrite, or duplicate credit on the contracts read.**

`pick()` always offers `hollowmere-return` / `return-hollowmere` at the altar. `activate` intercepts before the store when `phase` is not `relic-claimed` or `returned` (`exploration.js:85-89`): clue text only, `paint()`, `return true`. No `transitionExploration`, no `saveExploration`, no `onOpenJournal`. `unstarted` uses the local clue; `inscription-read` / `bell-rung` reuse `explorationGoal(phase)`. Journal does not start.

`transitionExploration` (`exploration-state.js:24-29`): `return-hollowmere` is action index 3. Advance only when `phase===3` (`relic-claimed`) → `returned` and append `PHASE_DISCOVERIES[3]` (`hollowmere-return`) once. Any other phase returns `{record:current, changed:false, blocked:phase<actionPhase}`. `returned` is index 4, so a repeat is `changed:false`, `blocked:false`. `validateExploration` requires `ids.has(id)===(i<phase)` for the four phase discoveries and unique IDs, so `hollowmere-return` cannot already be present at `relic-claimed` and cannot be missing at `returned`.

Save (`exploration.js:95`, `exploration-store.js:20-27`) runs only when `next.changed&&!sessionOnly`. Repeat completion does not write. `saveExploration` `JSON.stringify`s a validated four-field record. A corrupt on-disk value is copied to `ashen.exploration.recovery` before replacement; quota failure returns false and leaves the old key. `loadExploration` catch returns `emptyExploration()` plus a warning and does not write. Early visits never reach save, so they cannot replace an unknown record.

`onOpenJournal` runs for `returned` rereads (`changed:false` still opens the journal). `discovered.map` in `paintJournal` would duplicate articles only if the array held duplicate IDs; the transition never appends on `changed:false`. Combat `awardXp` is not on this path. `resetSession` is `?dev` and sets `sessionOnly=true`, so a rehearsal completion does not write over the saved journal.

### 2. Canonical `toWorld` / plinth, prepared and direct, air target, walking geometry

**Yes on the files read.** Landmark `yaw` (`Math.PI/2` on `hollowmere-chapel`) is destination heading; chapel `building` yaw is `EAST` (`Math.PI`) so the door faces the street. That mismatch is not a geometry error.

`toWorld=(lx,ly,lz)=>[x+lx*cos+lz*sin, gy+ly, z-lx*sin+lz*cos]` with `plinthY=.22` (`buildings.js:67-78`). Altar is set only for `kind==='chapel'` inside `enterable`, using that transform (`:200`):

- `standingSurfaceY: gy+plinthY`
- `stand: toWorld(-w/2+1.65, plinthY, 0)`
- `interact: toWorld(-w/2+1.2, 1.38, 0)`

Solid cap: `piece(-w/2+.60, 1.13, 0, [.90,.18,2.10])`. Full-size box: cap local x `[-w/2+0.15, -w/2+1.05]`, y `[1.04, 1.22]`, z `[-1.05, 1.05]`. Interact local `(-w/2+1.2, 1.38, 0)` is `0.15` m in front of the cap’s +x face and `0.16` m above its top. Cross pieces sit at local x `-w/2+.20`, toward the back wall. `interactionReachable` requires a Havok ray with `!hit.hasHit` (`exploration.js:33-34`).

Walking colliders: G14 only adds the `altar` object. `piece()` visual/collision volumes, door opening `2.4`, benches at `side*2.35`, and floor/wall `collision()` calls are unchanged.

Chapel is the same `building()` result in `buildChurchyard` (`scene.js:305-306`). Direct world: `api.hollowmere=chapel` (`:581`). Prepared: `dataOnly` metadata `plain({…, hollowmere:chapel})` (`:559`); `plain` JSON-clones and drops `collisionBatch`/functions; `altar` is numbers/arrays and survives. `createStarterWorld` sets `api={...m,…}` (`starter-world.js:389-430`), so `world.hollowmere.altar` is the packet copy of that object.

With chapel yaw `π`, `cos=-1`, `sin=0`: door local `+w/2` maps to world x `7.4-3.3=4.1`, matching the landmark entrance `[4.1, 7.328, 114]`. Stand/interact sit in the aisle in front of the east altar, not in the west door.

### 3. Journal → Open region map

**Yes on the menu/provider path.**

`journal-region-map` is grouped with hub `region-map` (`menu.js:366-372`): `hub`, `keysPane`, `devPane`, and `journalPane` hidden; `mapPane` shown; `region-map-open` set; `refreshRegionMap()` → `getRegionMap?.()?.open(...)`; `focusFirst()`. That is the destination chart (`region-map.js:68` `open` / `paint`), not `openGuide`. `journal-guide` remains the Vaelmark plan.

Late provider: `main.js:324` `getRegionMap:()=>combat?.regionMap`. `createCombat` constructs `regionMap` before `createExploration` (`combat.js:158-159`). Journal buttons `disabled=!getRegionMap?.()` (`menu.js:174`) — `?.()` invokes the getter, so both journal map buttons stay disabled until `combat.regionMap` exists.

Input: `open()` already called `setInputEnabled(false)`. The map switch does not `restoreInput`. `close()` (`:315-324`) `showHub()`, clears `region-map-open`, `restoreInput()`, focuses `#renderCanvas`. Focus trap uses `activePane()`; after the switch that is `mapPane`. `focusFirst()` takes the first rendered `button|input|select` with a client rect (destination buttons after `mount`, or the map pane `Back` if the provider is still empty).

Scene cleanup: `createRegionMap` abort removes map content (`region-map.js:66`); guide abort is separate (`cathedral-guide.js:75`). Menu hide does not unmount, same as hub Region map. Journal DOM stays in the hidden journal pane.

## Actionable issues

None at a severity that justifies a source change from this review.

## Speculative (not filed)

- `guide.isOpen` stays true if Journal → Vaelmark guide → Esc without “Back to region”. A later `open()` refreshes the guide instead of the destination chart. Pre-existing `journal-guide` / `open()` pairing; `journal-region-map` uses the same `open()`.
- On-disk prepared packets built before this metadata key are unread here; current `dataOnly` source includes `hollowmere`.
- `resetSession` does not clear `feedbackFor`; `feedbackTime=0` still hides the prompt text.

## Checked

| File | What was read |
| --- | --- |
| `src/ashen-reach/exploration.js` | Full. Early altar guard, `feedbackFor`, pick order, save/journal gates. |
| `src/ashen-reach/exploration-state.js` | Full. Phases, `transitionExploration`, `validateExploration`. |
| `src/ashen-reach/exploration-store.js` | Full. Load catch, recovery key, validate-on-save. |
| `src/ashen-reach/exploration-content.js` | `hollowmere-return` entry present. |
| `src/ashen-reach/buildings.js` | `toWorld`, plinth, chapel `piece`/`altar` return. |
| `src/ashen-reach/scene.js` | Chapel `building()`; `dataOnly` and live `hollowmere:chapel`. |
| `src/ashen-reach/starter-world.js` | `api={...m}` prepared metadata spread. |
| `src/ashen-reach/menu.js` | `openJournal`, `journal-region-map`, `close`/`focusFirst`/`restoreInput`. |
| `src/ashen-reach/region-map.js` | `open` vs `openGuide`, mount, abort. |
| `src/ashen-reach/cathedral-guide.js` | Guide mount/abort/`isOpen`. |
| `src/ashen-reach/main.js` | `getRegionMap:()=>combat?.regionMap`. |
| `src/ashen-reach/combat.js` | `regionMap` then `createExploration`. |
| `src/ashen-reach/region-layout.js` | Landmark yaw `π/2`, entrance `[4.1,…]`. |
| `src/ashen-reach/dev-destinations.js` | Landmark heading for `hollowmere-chapel`. |
| `scripts/ashen-reach/check-hollowmere-return.mjs` | Intended cases; not executed. |

## Unchecked

- `masonryBox` / Havok box rotation bodies (cap AABB taken from `piece` local size + `toWorld`).
- Live Havok ray at the interact point; parent records motion.
- Stale prepared region packets on disk.
- Combat objective module body beyond the check script’s snapshot comparison.
- Runtime menu focus order after destination buttons mount.
