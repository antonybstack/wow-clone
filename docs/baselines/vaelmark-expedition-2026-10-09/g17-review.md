# G17 product-integration review (G10–G16)

Candidate product HEAD named by root: `4f1771e`. Reviewer did not mutate git, run tests/builds/browsers, publish, or edit product source. Live helper-only edits belong to root. Reviewer owns zero renderers. No worker live-video claim; root owns motion review.

Scope is three questions only.

**Verdict: no consequential product defect on the three questions.** G17 fresh whole-episode retry through Bell Watch/return, twenty-minute soak, and performance remain pending. The recorded G17 helper failure is an operator-check limitation on existing Tab targeting, not a journal/sequence defect.

Bell/reliquary live in `src/ashen-reach/exploration-props.js`. There is no `exploration-bell.js` or `exploration-reliquary.js`.

---

## 1. Sequence / persistence (optional reads, unsupported saves)

No consequential source defect.

Required phase contract (`exploration-state.js` 3–35): `unstarted` → `inscription-read` → `bell-rung` → `relic-claimed` → `returned`. `PHASE_DISCOVERIES` must match phase index. Required actions advance only when `phase === actionPhase`; earlier is `blocked`; later is `changed:false`. Regional IDs are independent of phase and idempotent. `scripts/test-exploration-state.mjs` pins complete-once, premature block, reverse-order regionals before and after `returned`, unknown/corrupt/oversized rejection, restore-without-replay, corrupt-key retention plus recovery backup on the next real save, quota failure leaving the old key, and missing/denied storage.

`exploration.js` `pick()` (56–67) maps the memorial to `claim-relic` only at `bell-rung`; otherwise the same anchor is `read-inscription`. Hollowmere before `relic-claimed`/`returned` writes clue text and returns without `transitionExploration` or `saveExploration` (89–93). `activate` saves only when `next.changed && !sessionOnly` (99). `resetSession` requires `?dev` and sets `sessionOnly=true` (131).

`reliquary?.snapshot().open` is continuous optional chaining. A null reliquary yields a falsy `open` and does not throw (72, 77). The earlier G12 grouped-form throw is a false positive; root already adjudicated it.

`loadExploration` (`exploration-store.js` 10–15): missing key → empty record; no storage → session warning; decode throw → empty in-memory record, original `ashen.exploration.v1` left in place. `saveExploration` (20–28) validates, copies an undecodable old value to `ashen.exploration.recovery` before overwrite, and returns false on throw without erasing the live key.

Journal paint indexes `JOURNAL_ENTRIES[id]` (`exploration.js` 108–110) with no missing-key guard. That is safe for records that passed `validateExploration` against the current `DISCOVERY_IDS` set in `exploration-content.js`.

Episode knowledge is cosmetic in this owner: `combat.js` awards XP on enemy kill and watchman-objective complete (231–239, 598–601). `exploration.tick` does not call `awardXp`. G12 connected cathedral case keeps `progress.xp === 0` / watchman `idle`. G14 altar X leaves the pre-X combat snapshot unchanged (journey combat to level 2 is separate). G16 each of five optional reads records `unchangedInteractionCombat` at level 1 / xp 0 / watchman remaining four grave-shades, phase still `unstarted`.

**Native corroboration**

- G12 `g12-native.json` passed: fresh inscription/bell/relic/nave, then three labelled saved-phase reloads (`bell-rung` open+visible, `relic-claimed`/`returned` open+hidden, bell `rings:0`).
- G14 early `g14-early-native.json`: unstarted / inscription-read / bell-rung altar visits stay on their phase with no credit. Later connected well failure of that enclosing run is retained; it is not the passing G14 receipt.
- G14 `g14-native.json.gz` passed: labelled `relic-claimed` origin, ordinary return, one-time `returned` with four episode IDs, actual reload without fixture reseed.
- G16 `g16-native.json.gz` passed: five out-of-order optional reads (bell-watch, southwatch, ash-tower, westwatch, moor-tower), each `unchangedInteractionCombat`, actual reload `{phase:'unstarted', discovered:[ash-tower-view, bell-watch-view, moor-tower-view, southwatch-account, westwatch-account]}`.

**Unchecked here:** a real browser quota dialog; unsupported-save journal UI under live `localStorage` denial in this G12–G16 receipt set (G10 labelled that case earlier); regional reads after a live `returned` session (unit tests and G17 helper source cover it; G16 native is `unstarted` plus five optionals).

---

## 2. Initial critical path / native Lite lifetime, audio, prop, shadow, resource safety

No consequential source defect on the files and receipts read.

Interaction requires live Havok (`exploration.js` 29–34): `usingPhysics`, standing-surface Δy ≤ 1.2 m, horizontal ≤ 2.5 m, clear player raycast to the interact point. Activation rechecks that reach.

Props are created once on the 0.2 s scan after anchors exist (121–122). `setParent` then local identity TRS (`exploration-props.js` 22–26, 63–64): native parent preserves world TRS; batch vertices are pivot-local, so the child local TRS is reset. `ashenNonCaster=true`. G12 `casterState` sun/local Vaelmark names empty, local slots 2, 512 prop triangles. Reliquary `settle(phase)` opens for `bell-rung` and claimed/returned; live ring sets `pendingReveal` and `reveal()` only within 6 m xz / 1.2 m of the tomb (95–97, 122–123). Reloads pass `record.phase` and do not replay a half-open lid.

`sceneLifetime(scene)` abort removes prompt, style, journal DOM, input-reset subscription, and nulls `mechanism`/`reliquary` (`exploration.js` 114). Mesh/material dispose is not explicit in that abort; the helper soak path asserts `ASHEN.dispose()` leaves 0 meshes / 0 prompts (`check-vaelmark-reliquary.mjs` 150–152). That soak has not run as G17 evidence.

Audio: `ringBell` gated by `allowed(lastDead) && interactionReachable`; `prepareBell` within 10 m / 3 m when unmuted (82, 124). This review did not inspect audio-probe counters inside the native JSON.

Critical path in the current helper (`check-vaelmark-reliquary.mjs` 156–184): `boot('cathedral-nave')` with `?dev&play&at=`, `mortal()` turns God off, then WASD along authored crypt/tower/nave points, X at memorial/bell/reliquary. `completeReturn` continues nave → terrace → bridge → well detour → town → chapel, altar X, map, chapel escape, then Bell Watch optional read and return. Soak, if requested, `jump('cathedral-undercroft')` only for the initial crypt placement and labels `diagnosticInitialPlacement:true`. Default `ASHEN_SOAK_SECONDS` is 0.

`g17-cpu.json` is seven focused Node logs (touch stick/lifecycle, region-stream, cathedral-guide, prepared-region, region-structures, exploration-state), all `pass:true`. It is not a live episode, soak, or GPU result.

**Unchecked here:** GPU memory; scene recycle without full `ASHEN.dispose()`; audio context close vs `gainsAfterClose`; twenty-minute soak resource rows; settled FPS.

---

## 3. Ordinary mortal traversal versus diagnostic teleport

Existing native evidence proves labelled-start then ordinary Havok walking on the **separate** G12, G14, and G16 routes. It does not prove one fresh mortal session from nave through Hollowmere, Bell Watch, and return.

**What the receipts do show**

- G12 case 0: `initialDeveloperNaveSetup:true`, start `(0, …, 310)`, `physics:true`, `recoveries:0` on 99 steps, God/Fly fields absent from that older JSON (helper `mortal()` existed; G12 steps do not record `god`/`flying`). End on nave floor, still `recoveries:0`. Tomb contact `x=-8.565` with feet on crypt floor. Phase `relic-claimed`. This is connected inscription/bell/relic/nave, not Hollowmere.
- G14 passing receipt: `initialDeveloperNaveSetup:true`, start same nave, `god:false`, `flying:false`, `physics:true`, `recoveries:0` on 19 steps, end at town `(≈0.32, …, 114)`. Phase `returned`. README: labelled `relic-claimed` save then ordinary nave/terrace/bridge/well-detour/chapel. Combat clears are actual Tab/sword/Fire Blast on town wraiths; XP to level 2 is that combat, not the altar.
- G16: `initialPlacement` is `"public developer spawn link only"`. Each of five sites has a `*:developer-entrance` sample, then hall/reading/escape (keeps add courtyard). All samples `physics:true`, `recoveries:0`, `god:false`, `flying:false`. Root motion review: five labelled Developer entrance URLs plus ordinary entry/read/repeat/escape; loading transitions between cases; not a continuous cross-region walk.
- Helper `go()` asserts `physics && !god && !flying` every step and `recoveries` unchanged (`check-vaelmark-reliquary.mjs` 29–31, 81, 96, 176). `jump()` is used for labelled saved-phase boots (`boot('cathedral-undercroft')`, `boot('hollowmere-chapel')`) and soak placement.

**G17 live path (root-owned, not passed as a whole)**

Root states a current native run completed the fresh whole episode through Hollowmere, then failed helper-only unnecessary town combat: the camera/player-forward Tab cone excluded a respawned enemy. Root removed that stop and will retry through Bell Watch/return. This reviewer did not observe that run and does not claim the retry.

That failure matches existing targeting, not an exploration bug. `combat.js` 641–645 calls `targeting.tab(player.body.position, {x:sin(rig.yaw), z:cos(rig.yaw)})`. `src/targeting.js` 10–34 keeps hostiles beyond 2.2 m only when flattened dot ≥ 0.15 against that forward (`MIN_DOT=0.15`, `CLOSE_DIST=2.2`). The helper’s `clearNearbyHostiles` (45–62) treats any living LOS enemy within 12 m as required Tab prey and asserts the desired id within 8 Tab presses. An enemy 2.2–12 m outside the 0.15 cone is nearby for the helper and invisible to Tab until the body yaws. Root’s removal of an unnecessary town stop is an operator-check change.

`finishReturn` still clears chapel-doorway hostiles before the altar (73–75). That G14-era clear is in product-helper source; whether the G17 failure was that stop or a later town stop is a root live-log fact this reviewer did not open.

---

## Defects

None filed as product defects.

Operator-check limitation: G17 helper Tab assertion versus `Targeting.inFront` cone (`src/targeting.js` 10–34, `combat.js` 641–645, `check-vaelmark-reliquary.mjs` 45–55). Trigger: a living LOS hostile 2.2–12 m from the player with flattened facing dot < 0.15. Consequence: helper throws; the player can still turn and Tab. Severity: check flake, not sequence/persistence breakage.

Unproven concern (not a finding): abort nulls prop handles without an explicit mesh dispose (`exploration.js` 114). Full scene dispose is what the unrun soak asserts.

---

## What this evidence cannot establish

- Physical iPhone play.
- Universal cold start / first-visit boot.
- GPU memory.
- Telegram application inline or fullscreen playback (API dimension receipts exist on earlier gates; this review did not open them as G17 proof).
- Twenty-minute ordinary soak (`ASHEN_SOAK_SECONDS` default 0; no soak object in G12/G14/G16 receipts).
- Settled FPS / performance (capture HUD rates are excluded by prior root notes; `g17-cpu.json` is Node unit logs).
- G17 retry of the whole path to Bell Watch and return (pending).
- One continuous mortal walk visiting all five regional sites from town (G16 is five labelled entrances).
- One already-passed fresh-journal session covering inscription through Bell Watch (G12 stops at relic/nave; G14 starts labelled `relic-claimed`; G17 whole path is incomplete).
- Worker-owned motion review of G17 video (none claimed; root owns it).

---

## Checkpoint after first source read

Written before native receipts and tests. Files read: `exploration.js`, `exploration-state.js`, `exploration-content.js`, `exploration-store.js`, `exploration-props.js`, `cathedral-exploration.js`; `main.js`/`combat.js` by grep. No defect filed at that checkpoint. Second batch: `scripts/ashen-reach/check-vaelmark-reliquary.mjs` plus compact G12/G14/G16 native receipts (no frame arrays). Third batch: `scripts/test-exploration-state.mjs`, `combat.js` exploration/Tab owner, G16 `discoveries`/`reload` payloads, `g17-cpu.json`, `src/targeting.js` cone. Stop.


## Root adjudication / current acceptance boundary

Grok4.6/high ended normally in10 turns, session01a12485-5455-78e2-9f69-815d36ea3509; owns zero renderers. Root agrees with no consequential source finding. The initial full G17 run completed the episode/Hollowmere before a test-only unnecessary town target stop failed; its report is retained. The corrected compiled retry now passes the continuous episode and Bell Watch/return, actual completed reload and ordinary torso change plus reload, with God/Fly off, Havok active and zero recoveries. Twenty-minute soak and final settled FPS remain pending at this checkpoint. Current seven-case native journal/menu/death/storage-denial/disposal check,20 diagnostic watchman checks, native map pause/focus/selection and five core failure/retry/disposal checks also pass. Source audio/prop owner is unchanged; G11 bounded native audio/failure evidence remains applicable. Later root evidence completes worker-unchecked acceptance; a worker source verdict alone is not that acceptance.

Final root update: the corrected capture-free path, both real reloads/torso persistence,1201s/110-circuit soak/ten revisits and21 isolated raw FPS windows pass. These are root evidence beyond the worker checkpoint. Source verdict remains unchanged. Public G18 motion is pending; cold-start remains unqualified.
