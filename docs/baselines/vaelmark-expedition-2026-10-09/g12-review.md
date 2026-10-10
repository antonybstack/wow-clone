# Root adjudication of G12 review

The worker’s alleged optional-chain exception is **rejected**. Current source uses
the continuous `reliquary?.snapshot().open`, which returns undefined for a null
reliquary. The report substituted `(reliquary?.snapshot()).open`; those parentheses
change JavaScript semantics and are absent from the implementation. Root executed
both forms in Node: current code returns undefined/refuses readiness; only the
grouped form throws. [MDN short-circuiting documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining#short-circuiting) confirms this distinction.
No product change is justified by this finding. Remaining checked paths had no
accepted consequential defect. Root owns runtime/visual acceptance separately.

The seven-turn review wrote a checkpoint; one three-turn report-only continuation
completed the report. The original report below is retained without silently
rewriting its incorrect claim. Its stated unchecked limits still apply.

---

# G12 source review — memorial reliquary

**Verdict: one confirmed defect.** `reliquary?.snapshot().open` still reads `.open` when the reliquary does not exist yet, so `pick()` / `activate()` can throw in the first 0.2s after load at `bell-rung`. Delayed reveal, one-time claim, reload `settle(phase)`, rehearsal restore, Lite visibility, parent TRS, `ashenNonCaster`, reach/menu/death, and combat XP paths otherwise hold on the files read.

Working-tree G12; G11 is `2db6305`. No tests, browser, or product edits. No runtime claims. After the first read, root moved the journal SVG into `remembranceEmblem()` and added a reveal/reload comment; that refactor is unreviewed.

## Questions

### 1. Fresh bell unlock, delayed reveal, claim once, reload appearance, rehearsal reset

**Mostly yes, with the null-snapshot throw below.**

`ring-bell` from `inscription-read` still goes through G10 `transitionExploration` (`exploration-state.js:24-29`): one credit to `bell-rung`, `changed:true`. `exploration.js:65` then sets `pendingReveal`. The box is built, or kept, in the `inscription-read` pose (`:90`, `pendingReveal?'inscription-read':record.phase`). `reveal()` runs only when the player is within 6 m xz and 1.2 m of the crypt floor (`:91`). Tower ring cannot satisfy that.

`pick()` offers `claim-relic` only at `bell-rung` (`:40`). `activate` refuses while the lid is not `open` (`:53`). `claim-relic` then advances once to `relic-claimed` and `reliquary.claim()` hides the bronze (`:66`, `exploration-props.js:71`). Later memorial uses are `read-inscription` with `changed:false`. Save still requires `next.changed&&!sessionOnly`.

`pendingReveal` is session-only. Reload uses `settle(record.phase)` (`exploration-props.js:66-67`): `bell-rung` is already open with relic visible; `relic-claimed`/`returned` open and hidden. `resetSession` (`exploration.js:99`) clears `pendingReveal` and `restore('unstarted')` (closed, relic hidden).

### 2. Native parent TRS, visibility, scene ownership, shadow exclusion, Lite 1.31.1

**Yes on the APIs read.** `createMemorialReliquary` parents case+relic to `reliquaryBase` and lid to `reliquaryHinge`, then local identity TRS and `ashenNonCaster=true` (`exploration-props.js:58-63`), same compensation as the G11 bell and `mage-props.js`. Motion is hinge quaternion only. `setMeshVisible` is the 1.31.1 barrel alias of `setSubtreeVisible` (`node_modules/@babylonjs/lite/index.d.ts` and `lib/scene/scene.js`); same-value calls do not bump the visibility epoch (`lib/scene/visibility.js:8-16,14-22`). Reliquary meshes are `Batch.commit` → `addToScene` only. G11 `sun-shadows.js:170` still skips `ashenNonCaster`; this G12 tree has no `sun-shadows` / `combat` / `main` diff vs HEAD. Abort nulls `reliquary` with the G11 scene-lifetime pattern (`exploration.js:82`). Undercroft solid/route unchanged; only `reliquaryBase` / `reliquaryHinge` metadata (`cathedral-undercroft.js` hunk).

### 3. Reach / floor / menu / death, XP / watchman, early imports, new loops

**Yes on this slice.** `interactionReachable` and `allowed()` are unchanged. Claim still re-picks Havok at activate. Reliquary `update` is O(1) parent TRS on the existing exploration tick. `createMemorialReliquary` is imported only from late `exploration.js` (`combat.js:19,158`). `awardXp` remains on combat kills (`combat.js:232,600`). `main.js` still constructs `createObjective()` at the existing `createCombat` call (`:817`).

## Actionable issues

1. **High — `reliquary?.snapshot().open` throws when `reliquary` is null.** `exploration.js:40`, `:48`, `:53`. Optional chaining stops at `snapshot()`; `.open` then runs on `undefined`. `pick()` returns `claim-relic` whenever the player is at the memorial in `bell-rung`, including before the 0.2s scan that constructs the reliquary (`:89-95` create, then pick; `:95` `activate` can run on an earlier tick). Reload or `?at=cathedral-undercroft` with a saved `bell-rung` record plus X in that window is a TypeError, not a refused claim. Mechanism: `(reliquary?.snapshot()).open`.

## Speculative (not filed)

- Lid hinge axis / floor intersection is visual; collision metadata is unchanged.
- Abort still does not `disposeMeshGpu` the decorative meshes (G11 bell pattern; scene dispose owns them).
- `reliquary.claim()` is unguarded (`:66`); it is only reached after a successful `open` check, so it is not an independent null crash.

## Checked

| File | What was read |
| --- | --- |
| `src/ashen-reach/exploration.js` | Full, first-batch text (pre-`remembranceEmblem` refactor). |
| `src/ashen-reach/exploration-props.js` | Full. Bell unchanged; new reliquary. |
| `src/ashen-reach/cathedral-undercroft.js` | Scoped diff. Metadata only. |
| `src/ashen-reach/exploration-state.js` | `transitionExploration` `:23-36`. |
| `src/ashen-reach/exploration-content.js` | `vaelmark-relic` copy present. |
| `src/ashen-reach/combat.js` | `createExploration` site; `awardXp` call sites. No G12 diff vs HEAD. |
| `src/ashen-reach/main.js` | `createCombat` / `createObjective` site. No G12 diff vs HEAD. |
| `src/ashen-reach/sun-shadows.js` | `ashenNonCaster` scan `:166-170`. No G12 diff vs HEAD. |
| Lite 1.31.1 `lib/scene/visibility.js`, `lib/scene/scene.js`, `index.d.ts` | `setSubtreeVisible` / `setMeshVisible` alias. |

## Unchecked

- Root’s later `remembranceEmblem()` move and reveal/reload comment (after first read).
- Lite `createTransformNode` implementation body (call pattern matches `player.js` `x,y,z`).
- Whether any path later copies `addToScene` meshes into `world.shadowMeshes`.
- `resetSession` leftover `bellCooldown` (dev rehearsal; G11).
- Objective/watchman module bodies beyond the `main.js` / `combat.js` call sites.
- Runtime play, Havok, or journal captures.
