# G11 source review — Vaelmark west bell

**Verdict: no consequential source defects in the three asked questions.** Pre-inscription ring moves the parented mechanism and may play a delayed cue; `transitionExploration('ring-bell')` stays blocked until `inscription-read`. Later rings credit once, then 2s cooldown with `changed:false`. Mute, death, range, and scene abort are rechecked before `playSound`. Spell graphs stay up if the bell decode fails. Parent TRS matches `mage-props.js`; `ashenNonCaster` keeps the two PBR meshes out of the character caster scan.

Working-tree read. HEAD lacks this feature. No tests, browser, or product edits in this review. G10 journal validate/save contract is reused. Helper-fixture mistakes (facing getter, unguarded startup global) are not treated as product faults.

## Questions

### 1. Delayed bell fetch/decode/play vs mute, range, death, lifetime; spell audio on cue failure

**Yes.** `prepareBell` (`fire-blast-audio.js:58-68`) returns `false` while muted or aborted and does not start a fetch. Otherwise it `await prepare()` (same engine, blast/charge buffers first), then `createSoundBufferAsync` + `createSoundAsync` on that engine. Its `.catch` sets `bellError` and returns `false` without `release()`.

`ringBell` (`:73-77`) no-ops when muted or aborted. The play continuation requires `ready`, `!muted`, `!lifetime.aborted`, `engine.state==='running'`, and `stillEligible()`. Native `playSound` (`static-sound.js:78-101`, `_instancePlay` `:177-200`) starts a buffer instance only when `engine.state==='running'`; the caller already requires that.

`stillEligible` is `allowed(lastDead)&&interactionReachable(player,anchor)` (`exploration.js:53`), i.e. scene alive, visible, not dead, input enabled, navigation ready, armory closed, 2.5 m / 1.2 m Havok air path. Prefetch may start inside 10 m / 3 m (`:81`); play uses the interact gate. `lastDead` is latched at tick start (`:77`); `die()` also `setInputEnabled(false)`, so `allowed()` fails even before the next latch. Scene dispose runs `release()` (`fire-blast-audio.js:11`) and `prepareBell` bails if `engine!==created` after decode.

Cue failure after a successful `prepare()` leaves `sound`/`charge` in place. `createSoundBufferAsync` (`sound-buffer.js:39-58`) throws on a bad URL/decode; that throw is the bell catch, not `prepare()`’s `release()`.

### 2. One-time native parent transforms and caster exclusion

**Yes.** `createBellMechanism` (`exploration-props.js:9-36`) builds two batches once, parents them to `createTransformNode(..., ...pivot)` (same `x,y,z` rest args as `player.js` collision nodes), then `setParent` + local identity TRS + `ashenNonCaster=true`, matching `mage-props.js:8`. `ring()` only resets `time`/`active`. `update` writes `clapperRoot.rotationQuaternion` and `ropeRoot.position.y`. Meshes are not rebuilt.

`sun-shadows.js:166-170` skips `ashenNonCaster` in the existing PBR/standard `scene.meshes` character scan. `setWorld` (`:151`) still takes `world.shadowMeshes??world.meshes` from starter-world allocation; `Batch.commit` only `addToScene` (`geometry.js:215-220`), so these meshes are not on that world list. No new shadow map. The hunk adds a predicate on the existing per-frame scan. Mechanism construction is the first allowed 0.2s exploration scan (`exploration.js:80`), inside late `createCombat` (`combat.js:145-159`), not engine/scene boot.

Each `Batch.tube` emits `sides` quads (`geometry.js:186`). Call sides `6+8+12×5+8+10=92` quads → 184 triangles if each quad is two tris.

### 3. Pre-inscription motion, no sequence skip, later credit once, 2s cooldown, save/reload

**Yes.** Bell activate (`exploration.js:49-61`) always `mechanism?.ring()` and sets cooldown `2` before `transitionExploration(record,'ring-bell')`. G10 `transitionExploration`: action index 1 vs phase `unstarted` (0) returns `changed:false`, `blocked:true`, record unchanged. Feedback only; journal does not open. Save runs only on `next.changed&&!sessionOnly`.

On `inscription-read`, the same action advances to `bell-rung` and appends `vaelmark-bell` once. Further rings: phase ≠ 1 → `changed:false`, cooldown still applied, motion still runs. Reload uses existing `loadExploration`; a stored `bell-rung` cannot take the phase action again. `tick` decrements `bellCooldown` every frame (`:78`); the prompt button disables while cooldown > 0 (`:43`).

## Actionable issues

None observed.

## Checked

| File | What was read |
| --- | --- |
| `src/ashen-reach/exploration.js` | Full. Bell pick/activate/cooldown/prefetch/abort. |
| `src/ashen-reach/exploration-props.js` | Full. Batches, parent reset, `ring`/`update`. |
| `src/ashen-reach/fire-blast-audio.js` | Full. `prepareBell` / `ringBell` / mute / dispose. |
| `src/ashen-reach/cathedral-exploration.js` | Scoped diff. `bellInteraction` on both towers. |
| `src/ashen-reach/combat.js` | Scoped diff + `createFireBlastAudio` then `createExploration({engine,...,audio})`. |
| `src/ashen-reach/sun-shadows.js` | `setWorld`, streaming re-set, `ashenNonCaster` scan, CSM membership. |
| `src/ashen-reach/mage-props.js` | Parent compensation (`:8`). |
| `src/ashen-reach/geometry.js` | `tube` / `commit`. |
| `src/player.js` | `createTransformNode(name, x, y, z)` call pattern. |
| `node_modules/@babylonjs/lite/lib/audio/static-sound.js` | Full. `createSoundAsync` / `playSound` / non-running skip. |
| `node_modules/@babylonjs/lite/lib/audio/sound-buffer.js` | Full. URL fetch/decode. |
| G10 `transitionExploration` / store | Reused for skip, idempotence, save-on-changed. |

## Unchecked

- Lite `createTransformNode` implementation body (call sites above take world `x,y,z`).
- `disposeAudioEngine` internals; in-flight `createSoundAsync` after abort is gated by `aborted` / `engine!==created` / `release()`.
- Whether any path pushes later `addToScene` meshes into `world.shadowMeshes`.
- `resetSession` leaving `bellCooldown` / `rings` (dev rehearsal only).
- Exact `Batch.quad` index count (184 follows 92 tubes×sides quads).
- Runtime re-execution of the 24-flight mortal ascent (root already passed; not repeated here).
