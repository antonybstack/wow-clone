# M5 compact selected-Human animation library — independent review

Date: 2026-10-04. Reviewer: Grok, read-only. Base: `03274d4`. Working tree plus untracked `src/character/runtime/ashen-playable-motion.js` and `scripts/character-assets/compact-playable-animations.mjs`. Authoritative docs: `docs/CURRENT.md`, `docs/plans/character-mmo/m5-saved-identity-2026-10-04.md` checkpoint D. No browsers, servers, benchmarks, agents, commits, or product/doc edits. Tests and live cases cited below were not re-executed here; parent reports 200/200 character tests and 11 compact refinement cases on the dev route, with built motion recording in progress. User-owned WoW is active; timing is contaminated. 399 KB/body is a published-size pilot, not a load or FPS result.

## Verdict

The change matches the stated M5 compact-startup invariants. Selected first play loads the compact body; the full 57-clip library stays published; optional identity edits still request that full pack; gear-only refinement keeps the live actor, native groups, and mixer phase. Shared `ASHEN_PLAYABLE_CLIP_NAMES` owns the selected set. Compaction is native glTF Transform Animation disposal plus accessor/buffer-only prune. No highest-consequence defect is evidenced in the current diff and runtime wiring.

## Findings

None at highest consequence.

## What was checked

**Shared clip set (22).** `ASHEN_PLAYABLE_MOTION` in `src/character/runtime/ashen-playable-motion.js` spreads `resolvePlayableBody('?character=human-source').clips` and overwrites `cast` with `FireBlast_Upper`. `ASHEN_PLAYABLE_CLIP_NAMES` is the unique union of those clip values, `castMotion.lowerClip`, and every `castMotions` upper/lower. Ordinary `src/ashen-reach/main.js` now spreads that object. The compiler imports the same name list.

Counted names: Idle_Loop, Walk_Loop, Sprint_Loop, Jump_Start, Jump_Loop, Jump_Land, Spell_Simple_Enter, Spell_Simple_Idle_Loop, Spell_Simple_Exit, Walk_Carry_Loop, Jog_Bwd_Loop, Jog_Left_Loop, Jog_Right_Loop, Turn90_L, Turn90_R, Hit_Chest, FireBlast_Upper, FireBlast_Lower, LavaBall_Upper, LavaBall_Lower, PyreBurst_Upper, PyreBurst_Lower. `Spell_Simple_Shoot` is dropped because exact-mode `cast` is Fire Blast. That matches `resolveVisualClips` (`src/character/runtime/body-visual.js` 186–188).

**Runtime consumers of those names.**

- Directional locomotion: walkBack / strafeL / strafeR / turnL / turnR from the shared clips object (`body-visual.js` 166–170; `body.js` 534).
- Channeling: spellEnter / spellLoop / spellExit (`body.js` 509–528, 862–868).
- Hit: `clips.hit` → Hit_Chest (`body.js` 1218–1225).
- Melee: hardcoded `MELEE_CLIP = "PyreBurst_Upper"` (`body.js` 78, 1202–1215). Present in the keep set via `castMotions.pulse.upperClip`.
- Carry: `clips.twoHand` → Walk_Carry_Loop (`body.js` 627–643).
- Casts: FireBlast / LavaBall / PyreBurst upper+lower through `castMotion` / `castMotions` (`ashen-playable-motion.js` 14–21; inspection `src/character/runtime/inspection-preview.js` 15–17).
- Inspection options: idle, walk, run, jump, land, fire, lava, pulse, carry; Jump_Loop only when `includeAirborne` (`inspection-preview.js` 9–20). Missing clips are filtered with `every(Boolean)`.

`Sword_Attack` is an uncomposed remote-presence fallback (`src/character/remote-pieces/renderer.js`), not a player mixer clip. Exact mode does not use samba or idleArmed.

**Compiler.** `prepare-production-human-identities.mjs` still encodes the full body first (lines 87–97), then `compactPlayableAnimations(doc)` (101–105), then encodes `body-compact`. `manifest.items.body` stays the 57-clip pack; `manifest.compactItems.body` is the playable subset with `detail: 'playable'` and `playableClips`. Geometry SHA of compact is asserted equal to full (105). Provenance walks local imports from the prepare script (`scripts/ashen-reach/startup-provenance.mjs` 8–21), so `compact-playable-animations.mjs`, `ashen-playable-motion.js`, and `playable-body.js` participate.

**Native prune.** `compact-playable-animations.mjs` 13–31: require every keep name, snapshot geometry hash and keep-set curve hash, dispose unused Animation channels then samplers then the Animation, `prune({propertyTypes:[ACCESSOR, BUFFER], keepAttributes:true, keepExtras:true})`, re-assert both hashes. No new runtime loader or mixer.

**Exact samples and relative order.** Compact tests hash the remaining animations against `identityAnimationHash(full, {names: keep})` (`scripts/test-production-human-identities.mjs` 77–81). That hash includes name, target node, path, interpolation, and full input/output arrays (`human-identity-proof.mjs` 16–20) in `listAnimations()` order. Disposal of unused clips leaves kept clips in source-relative order; a reorder would fail the hash. `playableClips` is required to equal remaining names in file order (79).

**Full library and identity edits.** `preloadHumanIdentityPack` defaults `compact=false` (`human-identity-assets.js` 16–24). The ordinary identity transaction in `main.js` (~714–715) omits the compact flag. Startup selected packs pass `{compact:true}` (`startup-preload.js` 11; `main.js` 92). Live compact check forbids a request for `manifest.items.body.url` (`check-compact-human-identity.mjs` 77).

**No body promotion; gear-only refinement.** Compact live check builds `fullUrls` from equipment slots whose compact URL differs (50–51), not from the body. After the held hood upgrade it asserts the same container, the same AnimationGroup object identities, and the same `currentTime` values (126–138). Texture upgrade (`startup-assets.js` 10–44) rebuilds materials and leaves the skeleton and mixer. Failure mode keeps the compact hood visible and records `appearanceDetailError`. Queued identity is allowed to replace the actor.

**Failure ownership.** Missing keep-clip throws before the dispose loop (`compact-playable-animations.mjs` 16). The unit test disposes `LavaBall_Lower` on a full body, expects that throw, and asserts the remaining hash is unchanged (`test-production-human-identities.mjs` 58–64).

**Pins.** Compact and full body rows still run `assertCopiedSkinBind` (65 joints), geometry hash, morph target count 2, face meshes, and ponytail presence (`test-production-human-identities.mjs` 65–91). Full `items.body` still requires 57 animations matching the reference hash (73–74).

## Limits (unverified here)

- This review did not load a compact GLB, run the 200 tests, or watch the 11 live refinement cases. Parent status is taken as reported.
- Compact-before-release inspection drives walk/jump/fire only (`check-compact-human-identity.mjs` 113). After the unchanged compact actor is retained, the harness drives walk/run/jump/land/fire/lava/pulse/carry plus Havok W / Space / Digit1 / T (150–156). Channeling (held 2), `playHit`, and back/strafe/turn are wired in source and present in the keep set; they are not in that live loop.
- `MELEE_CLIP` in `body.js:78` is a second name, currently equal to `castMotions.pulse.upperClip`. Drift would make melee return false on a compact mixer or keep a clip melee no longer names. Not a current mismatch.
- `resolvePlayableClips(ASHEN_PLAYABLE_CLIP_NAMES, definition)` (`test-production-human-identities.mjs` 48–50) is self-referential. The hardcoded name includes (51–54) and the compact GLB assertions are the real pins.
- Shared-sampler dispose in `@gltf-transform/core` was not read. Kept-curve hash equality after prune is the guard; a shared Sampler object disposed from a dropped clip would have to survive that hash to ship.
- Compact runs on the in-memory document after the full-body `encode()` has already densified accessors, shrunk embedded textures, and attached meshopt. The second `encode()` disposes meshopt and rewrites. Published compact hashes are what tests see; the intermediate meshopt graph was not inspected.
- Identity `head.url` / `hair.url` still point at the full body URL (`prepare-production-human-identities.mjs` 125–126). The compact saved route does not fetch that URL in the live assertion; other callers were not exhaustively searched beyond `preloadHumanIdentityPack` and the two compact live scripts.
- No isolated cold-start or FPS claim. User WoW is active.

AGENTS.md in the same tree is unrelated and was not reviewed as part of this change.

## Parent disposition

The current implementation and the full/compact assets are verified directly. The
review ran Grok 4.6/high, session `01a109ca-85cc-7831-92d2-8025639fa87d`, eight initial
turns plus two report-only turns. Both CLI invocations ended at their turn caps;
the written verdict above was produced. This is a source review, not independent
visual or benchmark acceptance.

The valid future melee-name drift observation is addressed: the native actor now
imports `ASHEN_MELEE_CLIP` from the same contract used by the compiler. Required
clip declarations, exact geometry and coverage also run in the release verifier.
All full-body/item descriptors are byte-identical to `03274d4`. Native source data
and retained samples are checked after decoding; all 57 full curves remain exact.

The missing live-operation observation is addressed with three final built-route
cases / 30 operations. Normal keyboard input drives back/strafe/turn; public native
actor APIs drive hit/melee diagnostics. Normal game 2 is Lava Ball, so channel
enter/loop/exit is tested on the existing `?animationLab` route, explicitly labelled
diagnostic. Each operation checks the actual playing native group, Havok, no
recovery and no GPU errors. This does not claim gameplay damage for the injected
hit/melee calls or normal-root channel controls.

Character 200/200, sealed packs 16/16, startup 14/14, 11dev refinement cases,
8 built saved cases, three built recordings, three final desktop mobile cases,
build and848 native Pages artifacts/20 identity cache policies pass. Actual encoded
frames and published motion were reviewed by the parent. Isolated cold/FPS gates,
broader fits, physical phone and release remain open while user-owned WoW runs.
