# Living plan — Armory and modular equipment

Status: active. Created 2026-09-17. Owner: direct parent implementation and review. This is the current user-authorized equipment initiative; it replaces no working motion or scene system. Update statuses and decisions in this file as evidence changes the implementation. Unchecked goals are not completed features.

## Outcome

In Ashen Reach, open a developer armory, inspect the actual player up close, swap individually equipped pieces, preview motion, and return to play wearing the selection. Establish a small, attractive mixable catalogue, then demonstrate the same logical items fitting distinct Human and Orc bodies before extending to Undead.

Keep the accepted Sword Hero-inspired low-poly, pixel-textured visual language. Keep current Havok movement, native Babylon Lite animation, source-compatible bind and Fire Blast/Lava Ball behavior. WoW/OSRS are equipment-usability references, not instructions to restore the rejected Moonwell art.

## Explicit success criteria

- The armory operates on the real gameplay actor and equipment state. No separate preview model with different binds/materials or duplicate animation implementation.
- Opening provides a full-body close view, orbit/zoom and front/back/side controls. Closing restores the previous gameplay view and camera settings, with equipment retained.
- Armory controls own input. Clicking items, scrubbing or dragging cannot move the player, cast a combat spell or lock the pointer. Escape closes; focus and held keys recover predictably.
- Preview idle, walk, run and available jump/cast clips on the existing mixer; allow pause/time inspection. Preview casts do not deal damage or consume cooldowns. Returning to play resets diagnostic playback cleanly.
- Supported race choices are honest. Human initially; Orc/Undead visibly unavailable until their real meshes, fits and animation compatibility are verified. Do not substitute a tinted/scaled Human and call it a race.
- Equip/unequip helmet, torso, legs, boots, gloves, main-hand and off-hand independently as catalogue support arrives. Provide real available choices; do not present nonexistent items as functional.
- Selected item IDs survive race changes when a compatible fit exists. Missing fits are explicit and leave a coherent visible loadout; no silent wrong-body mesh fallback.
- Mixed outfits have readable silhouettes, consistent seams and no obvious body poke-through during idle/walk/run/jump/both spells at ordinary play distance and armory distance.
- Equipment changes preserve current pose, sockets, movement and combat ownership; no duplicate character, reset to bind pose or visible main-thread freeze.
- Target >120 FPS with stated render resolution and foreground sampling conditions. Report mean/tails and swap stalls separately. Do not generalize single-character results to MMO crowds.

## Starting point and useful existing code

- `src/ashen-reach/main.js`: real scene/character/control wiring. `src/character/body.js`: gameplay motion state machine and one animation manager. `src/character/runtime/body-visual.js`: assembly and animation snapshot/restore helpers.
- Current `public/ashen-reach/wanderer.glb` contains the source-compatible Human, 65 joints and 55 clips (including the retargeted CC0 carry). Surface-defined clothing is still a stand-in. Preserve original source curves/binds.
- `runtime/compose-loadout.js`, `garment-catalog.js`, `loadout-controller.js`, `loadout-client.js` and `fit-contract.js` contain reusable composition, coverage, version validation and asynchronous ownership mechanisms. Their current chest/legs/feet catalogue targets older binds. Do not enable it against wanderer without proving compatibility.
- `src/input.js`, `player.js`, `camera-rig.js`: inspect input/physics ordering before armory integration; Havok steps separately from the render callback.
- Existing character-lab controls are reference/reuse candidates. Avoid importing the complete diagnostic lab as a second renderer.
- Existing evaluated sockets support cast origins. Rigid gear needs full evaluated transforms and authored grip offsets, not attachment to static glTF joint nodes.
- Asset preparation already uses installed glTF Transform. Use it for reproducible glTF processing. Evaluate Blender/MPFB MakeClothes for garment fitting and skin-weight transfer; retain source/license records for every shipped asset.

## Architecture decisions

### Identity and authoring

A logical item has stable ID, display name, occupied slot(s), render type, catalogue thumbnail, compatible fits, material variants, coverage and conflict rules. The item ID is independent of race-specific geometry. A body profile records rig/bind version, body geometry version, dimensions and evaluated socket offsets.

Each skinned garment fit refers to a concrete body/shape/rig contract. Geometry and weights are prepared offline; use body-relative fitting and authored corrections to derive variants. Do not attempt arbitrary real-time cloth fitting every frame. Preserve original 65-joint Human behavior while testing a proportionally distinct race; compatible rig families may reuse animation semantics without sharing literal inverse binds.

Keep provenance separate from compatibility. A changed GLB file hash after adding clips does not automatically invalidate an unchanged garment fit. Preserve meaningful bind and geometry checks.

### Render and attachment

One pose drives the body and compatible skinned garments. Rigid weapons/shields/appropriate helmets use evaluated sockets with per-item grip orientation and per-body corrections. Do not rig an entire robe to one torso socket.

Compose compatible skinned pieces through a shared pose path supported by Lite; reuse the existing composition approach where it survives the new bind. Cache prepared data and avoid reconstructing GLBs on each render frame. Establish one visible equip transition before generalizing catalogue expansion.

Covered body regions should be removed/hidden by validated masks. Define seams at neck, waist, wrists and ankles; define layering/conflicts so boots, cuffs, collars and helmets work with unrelated items. Hair hiding and two-handed/off-hand rules are explicit. A first catalogue can restrict unsupported layering rather than promising universal combinations.

### Armory lifecycle

Use the current scene and actor, plus a dedicated inspection camera. Snapshot view state on entry. Suspend gameplay input and translation while retaining world animation and settled character placement. Do not advance combat from preview controls. Restore camera, input and animation ownership on exit, including after repeated toggles or pointer lock.

Build a compact in-game panel: race selector, equipment slots and choices, animation controls, orbit presets, return-to-game. Neutral inspection lighting is optional and restored on exit. Keep technical diagnostics in a labelled developer section. No inventory economy, backend synchronization or progression required.

## Delivery stages

### A — Armory on the current Human (implemented and reviewed)

- [x] Add discoverable Armory button and keyboard shortcut, close/Escape behavior.
- [x] Dedicated full-body inspection camera, orbit/zoom and front/back/side presets.
- [x] Suspend gameplay input safely; restore previous view and held-key state.
- [x] Preview original animation clips through the existing manager; pause/scrub and clean return to gameplay.
- [x] Human selection with honest unavailable Orc/Undead states.
- [x] Establish equipment presentation with actual supported items only; label the existing outfit as the current base appearance.
- [x] Playwright real-input checks for entry, camera, previews, close, resumed movement and casting; inspect live captures.

First review: a useful in-game tool that shows the current real character clearly. It is not yet proof of modular clothing or race adaptation.

### B — First real equipment slice (implemented and reviewed)

- [x] Author/reuse one weathered adventurer outfit consistent with the scene; deliver torso/boots plus main-hand equipment first.
- [x] Prove the source-compatible garment fit and the evaluated rigid attachment path in the live armory.
- [x] Equip/unequip actual geometry and keep selected items when returning to gameplay.
- [x] Coverage hides appropriate underlying body geometry and restores it when removed.
- [x] Preserve walking, jumping, cast timing, release sockets and animation phase across swaps.
- [x] Capture front/back/side and gameplay video; correct the largest observed fit/art defect before expanding.

Do not call recolored body regions or generic offset shells a finished modular outfit. A surface variant may be a preview aid but must be labelled honestly.

### C — Mixable Human catalogue (in progress)

- [x] First mixability proof: mail/cloth torso alternatives with real trousers, independent boots, shared waist coverage and boot-tucked cuffs.

- [x] Complete helmet/torso/legs/boots/gloves/main-hand/off-hand support.
- [x] Add a second visually distinct, compatible outfit and actual weapon/off-hand alternatives. Graveweaver adds hood, armored robe top, long skirt, gloves, staff and grimoire; boots remain shared.
- [ ] Standardize seam boundaries, layer precedence, hair/face hiding, grip metadata and two-handed exclusions.
- [x] Exercise representative mixed combinations and edge cases; adding an item should use the catalogue/asset pipeline rather than a new renderer branch.
- [x] Latest-request-wins swaps; failed load keeps the previous equipment; bounded resource ownership and reuse.
- [x] Meaningful fit/slot tests plus real-game visual/performance checks.

### D — Cross-race proof

- [ ] Prepare a recognizably different Orc with validated rig/animation compatibility; preserve the Human baseline.
- [ ] Derive/correct fits for the same catalogue item IDs and corresponding socket corrections.
- [ ] Switch Human/Orc in armory, preserve compatible selections, clearly report unavailable fits.
- [ ] Check race-specific head/shoulder/hand/foot proportions, weapon grip, capsule, camera and motion.
- [ ] Demonstrate mixed outfits walking/jumping/casting on both races in Ashen Reach.
- [ ] Extend the proven process to Undead; validate hunch and limb proportions rather than copying a uniform scale.

### E — Authoring repeatability and scale

- [ ] Document a reproducible new-item/new-fit procedure with source/license and validation commands.
- [ ] Measure equip latency, memory/resource retention and draw calls; optimize observed bottlenecks.
- [ ] Add a new item using the documented process to prove it is repeatable.
- [ ] Assess a representative small crowd separately before making many-character performance claims.

Hundreds/thousands of catalogue items are a supported growth goal, not assets to manufacture during this first milestone. Full body sliders, cloth simulation, weapon-specific melee combat, progression and backend integration remain separate deliverables.

## Review and validation

Use real browser inputs on `ashen-reach.html?play&clean`, owned CDP 9337. Capture ordinary gameplay and labelled armory views under the ignored local `ve-capture/ashen-reach/<pass>/` directory. Review media before sending to the authorized Telegram conversation. Inspect console/WebGPU errors. Reuse relevant existing cast tests; add behavior tests for input ownership, slot rules, fit compatibility and swap recovery as those paths are implemented.

Measure after warm-up, foreground and separately from recording. Record buffer resolution, sample length, mean/p95/worst frame times and any limitations. Tests cannot certify tailoring; inspect actual vertices through representative motion phases.

## Progress and decisions

- 2026-09-17: Plan created after explicit user approval of an in-game developer armory and modular/race-compatible equipment. Existing rig/motion are preserved. Initial implementation starts with Stage A; unavailable races/items remain clearly unavailable.
- 2026-09-17, Stage A: implemented the in-game armory, opened with **C** or the **Armory** button; Escape/Return restores the previous view. Front/back/side/face/full-body cameras, drag orbit, scroll zoom and optional inspection fill light are available.
- Uses the actual gameplay actor and its native animation manager. Idle/walk/run, jump takeoff/landing and Fire Blast/Lava Ball pose previews support pause and time scrubbing. Spell previews have no gameplay damage/cooldown effects. These are clip/pose diagnostics, not a full physics jump or particle preview.
- Implemented `setInputEnabled` in shared input; held keys/autorun/cast edges and pointer lock clear on modal transitions. Pending casts cancel on entry. Existing already-launched projectiles can continue in the live world. Exiting resets diagnostic animation ownership to idle, then normal locomotion resumes.
- Visual review corrected the initial too-tight full-body framing. A timeline-range update lag after switching clips was corrected. The joint-freeze probe now samples actual rendered mesh skin bindings, rather than the descriptive skeleton object.
- **Verification:** 22 real-browser armory checks; 20 automated gait/spell/source-motion checks; production build passed. Browser checks cover modal input, original motion, actual frozen/seeked joint palettes, spell previews without damage, live casting after exit, pending-charge cancellation/recovery, repeated toggles and reference/game camera restoration. No recorded browser errors.
- **Performance:** separate foreground samples, 792 frames each over about 5.5 seconds: gameplay 144.00 FPS, p95 8.0 ms, worst 8.6 ms; armory with running animation/fill light 144.00 FPS, p95 8.0 ms, worst 8.7 ms. Both at 960×540, 23 maximum draws, zero frames over 16.67 ms. Short local single-character evidence only.
- **Media:** The Stage A walkthrough was reviewed and delivered during that pass; its local frames and logs were removed during cleanup.
- **Stage A limits at delivery:** equipment rows deliberately disabled; no new swappable clothing or weapon has shipped in this stage. Human is the only available race. Existing body/clothing quality is unchanged. Neutral background, full jump sequencing, cloth simulation and fit diagnostics are not implemented.
- **Stage A next review point (now completed below):** Stage B, one credible torso/boots fit on the existing source-compatible Human plus a rigid weapon. Prove visible equip/unequip and animation before expanding all slots or races.

### Current reproduction commands

Run from `the repository root` with Vite 5173 and owned Chrome CDP 9337. Browser scripts share one target and must run sequentially.

```sh
node scripts/ashen-reach/check-armory.mjs
node scripts/ashen-reach/measure-armory.mjs
node scripts/ashen-reach/record-armory.mjs
node --test scripts/test-gait-phase.mjs scripts/test-fire-blast.mjs scripts/test-lava-ball.mjs scripts/test-source-motion.mjs
npm run build
```

The recorder writes raw JPEG frames, ffconcat timing, engine audio and timeline metadata under `armory/video/`. Encode H.264/AAC using those timestamps and the recorded audio offset, following the existing spell-capture workflow. Frame-time measurement runs without recording. The armory implementation is in `src/ashen-reach/armory.js` and `armory.css`; actor-local diagnostic playback is in `src/character/runtime/inspection-preview.js` and enters through `body.beginInspection()` / `endInspection()`.



### Stage B review — 2026-09-17

- Shipped separate **Wayfarer mail tunic**, **Wayfarer boots** and **iron arming sword**, selectable independently in the same armory and retained in gameplay. Tunic/boots start equipped; sword is optional. Removing an item restores covered body geometry. Human remains the only enabled race.
- Reused Rehman Polanski's CC0 MakeHuman Viking tunic/boots, authored UVs and fitting references. Converted fitted geometry/weights onto the exact source-compatible 65-joint Human, with all 54 clips intact. New playable asset is `wanderer-equipment.glb`; base `wanderer.glb` remains the input. [Rebuild, provenance and runtime contract](ashen-equipment-authoring.md).
- Kept the first two garments preloaded for synchronous swaps without actor reconstruction. This is a bounded first slice, not the loading strategy for thousands of catalogue items. Current coverage regions and back/grip transforms are fit-specific.
- Live review found and corrected a floating sword caused by Lite world-preserving parenting, then corrected blade orientation. Open-hand casting exposed another interaction; the sword now stows on the evaluated back socket for cast/recovery and returns to the hand. Original body curves and hand-based particle origins are preserved.
- Reviewed actual front/back/side, walk/run/jump and cast frames, plus sampled frames from a **24.2-second** CDP gameplay walkthrough with engine audio. No gross garment separation appeared in those inspected poses. This is not exhaustive tailoring validation; long hems remain ordinary skinning without cloth simulation.
- Validation: **24 automated tests**, **14 equipment browser checks**, the existing **22 armory browser checks**, and production build pass. The armory regression run preceded the final stow policy; the final equipment run includes live cast stow/recovery. No captured browser errors.
- Separate foreground samples: equipped gameplay **144.00 FPS**, p95 **7.8 ms**, worst **8.7 ms**; equipped running armory **144.01 FPS**, p95 **7.9 ms**, worst **8.6 ms**. About 5.5 seconds each, **960×540**, max **31 draws**, zero frames over 16.67 ms. This meets the local single-character target, not a crowd/native-resolution guarantee.
- Media: The Stage B walkthrough was reviewed and delivered during that pass. Its local frames and logs were removed during cleanup. Public MP4: [equipment walkthrough](https://ve.sparkify.dev/wow-clone/ashen-reach/equipment/2026-09-17-equipment-walkthrough-v1.mp4).
- Remaining: other slots, second outfit, mixed-set seam rules, race-specific fits, catalogue loading/cache contracts and weapon-specific motions. Stow/draw switches instantly; no sheath/draw animation or melee behavior. Selection does not persist across page reloads. The base charcoal trousers remain surface-defined until the next item expansion.
- Next focused deliverable: Stage C, a second mixable Human outfit with real trousers and additional slot support, before expanding to Orc. Avoid expanding the catalogue until contrasting combinations have been viewed in motion.


### Stage C first increment — 2026-09-17

- Added **Pilgrim cloth tunic**, a shortened, rope-belted derivation of Donitz's CC0 Monk robe, and separate **Wayfarer trousers** from Rehman Polanski's CC0 Viking outfit. Both use the original Human skin/animation. The existing mail tunic remains an alternative; both tops mix with the new trousers and existing boots/sword. This is two torso silhouettes sharing lower equipment, not two complete independent gear sets.
- Legs are now a real armory selection. Unequipping restores the original base appearance; no claim of bare-skin underwear art. All four garments remain in the small prepared pack; broader catalogue streaming/cache work is still open.
- Added a small data-only `equipment-catalog.js` and union-based coverage resolution. A shared waist mask stays hidden while either torso or trousers covers it. Boot equip hides only lower trouser panels; removing boots restores those cuffs and underlying feet. Forty repeated mixed swaps preserve mesh count and frozen animation phase.
- Asset preparation handles MHCLO `delete_verts` sections without interpreting them as vertex mappings. Checked all 10,233 source robe mappings against the authored OBJ; the shortened garment retains interpolated UVs and skin weights at the new hem.
- Reviewed front, back, side, run, jump and cast captures for the cloth/trouser combination, plus a barefoot cuff-restoration view. Garments remain ordinary skinned meshes: no cloth simulation or universal no-clipping guarantee. Weapon-specific locomotion and animated draw/sheath remain open.
- Validation: 27 automated tests, 21 mixed-equipment browser checks and production build passed. Both real spell damage events and sword stow/recovery still passed; no captured browser errors. Local evidence was removed after the pass was superseded.
- Next Stage C work: helmet/gloves/off-hand, further item alternatives and fit/seam contracts. Race changes remain disabled until a distinct body and corrected matching fits are actually ready.

- Mixed-set performance: 792 frames each, about 5.5 seconds/sample, foreground Chrome without recording, **960×540**. Gameplay **144.00 FPS**, p95 **7.9 ms**, worst **8.7 ms**; running armory **144.04 FPS**, p95 **8.1 ms**, worst **8.6 ms**. Max **36 draws**, zero frames above 16.67 ms. Single-character local evidence only.
- Reviewed **28.6-second** mixed-equipment walkthrough with original engine audio, plus full-size garment captures. Raw recording metadata and sampled review sheet are retained locally.

- Public reviewed video: [mixed equipment walkthrough](https://ve.sparkify.dev/wow-clone/ashen-reach/mixed-equipment/2026-09-17-mixed-equipment-v1.mp4). Verified video MIME type, matching byte range/size, browser playback and seeking.


### Stage C magic-set increment — 2026-09-17

- User requested an Ahrim-inspired magic outfit. **Graveweaver** provides an original hooded silhouette, muted mail vestment with bronze/amethyst clasp, long robe skirt, gloves, tall forked staff and closed grimoire. Boots are shared with Wayfarer. Donitz's CC0 hood/robe, Rehman Polanski's CC0 mail and Margaret Toigo's CC0 short gloves are fitted onto the preserved source Human; pendant and rigid props are original. No OSRS asset is shipped.
- All seven slots now work. Outfit buttons equip Wayfarer, Pilgrim or Graveweaver atomically without replacing the actor or resetting the pose. Invalid loadout patches are rejected before changing any selection. This does not implement asynchronous load failure handling.
- Added independent hair hiding under the hood and a hand/finger-weight body partition under gloves. Robe skirt shares the existing trouser underlayer and boot-cuff precedence. Side/back review drove additional lower-panel clearance. Cut vents produced enclosed gaps and loose-looking strips; the final skirt keeps the continuous authored hem. Deep jump folds remain ordinary skinned deformation.
- Staff and grimoire use separate evaluated palm transforms. Both stow during Fire/Lava preview and live recovery, then return to their own hands. The current staff is one-handed. No two-handed conflict rule or shield has been implemented. Full-body inspection framing accommodates the tall staff.
- The browser checks cover all slots, complete and mixed outfits, hair/hand restoration, atomic rejection, thirty preset swaps without mesh/bone/phase changes, both evaluated palm positions, resumed movement, Fire Blast damage, Lava Ball jump interruption and recovery, and no runtime errors.
- **Open at the time of this magic-set pass (see streaming update below):** general fit/seam contracts, two-handed occupancy when a two-handed item arrives, on-demand composition/cache ownership and failed-load/latest-request-wins semantics. The small catalogue remains preloaded. Human only; race fitting is a separate Stage D proof. Long hems use ordinary skinning with visibly stretched deep jump folds; no cloth simulation or bespoke staff locomotion. Stow/draw remains instantaneous.

Reproduce the magic-set pass from `the repository root` (browser commands run sequentially):

```sh
node scripts/ashen-reach/check-graveweaver.mjs
node scripts/ashen-reach/measure-armory.mjs --graveweaver
node scripts/ashen-reach/record-armory.mjs --graveweaver
node --test scripts/test-ashen-equipment.mjs scripts/test-gait-phase.mjs scripts/test-fire-blast.mjs scripts/test-lava-ball.mjs scripts/test-source-motion.mjs
npm run build
```

- **Validation:** 29 relevant automated tests (nine equipment plus twenty gait/spell/source-motion), 19 final live browser checks and production build pass. The equipment checks/build were repeated after final robe geometry changes. No captured runtime errors.
- **Final performance:** 792 frames per sample, about 5.5 seconds each, foreground owned Chrome without recording/encoding, **960×540**, max **50 draws**. Gameplay **143.98 FPS**, p95 **7.9 ms**, worst **8.6 ms**; running armory **143.99 FPS**, p95 **7.8 ms**, worst **8.7 ms**. Zero frames over 16.67 ms. This is single-character local evidence, not native-resolution/crowd validation.
- **Reviewed media:** 28.5-second CDP walkthrough with original engine audio, full-size idle/back/side/run/jump/cast captures and sampled video frames. `ve-capture/ashen-reach/graveweaver/` retains checks, measurements and timing metadata. Public video: [Graveweaver walkthrough](https://ve.sparkify.dev/wow-clone/ashen-reach/graveweaver/2026-09-17-graveweaver-v1.mp4).

- Public upload verified: HTTP 200, `video/mp4`, matching 17,971,636-byte object, HTTP 206 range response, browser playback and seeking to 20 seconds. Reviewed MP4 and final front screenshot delivered to the authorized Telegram chat (messages 552–553).

## Next focused deliverable

The two-handed prop/pose and eased stow/draw proof is delivered (below). Next, Stage D: prepare a recognizably distinct Orc with validated rig/animation compatibility and derive/correct the same logical catalogue items and socket fits onto it, preserving the Human baseline. Continue correcting observed seam defects on real mixed outfits, and qualify geometric seam closure beyond the current fits. Semantic fit declarations alone do not establish that cross-race proof.

### Stage C two-handed increment — 2026-09-18

- Added **`graveweaverGreatstaff`** (a longer `greatstaff` prop variant) and a **Warden** outfit. The item declares `twoHanded` and `occupies: ['mainHand','offHand']`; `validateEquipmentSelection` still rejects a two-handed/off-hand conflict, and the interactive `resolveHandEquip` helper makes the most recent hand change win (equipping the greatstaff clears the book, and equipping the book clears the greatstaff). This does not change the one-handed staff/book behaviour.
- Real two-handed pose: a **retargeted CC0 animation**, not a hand-authored override. Quaternius UAL2 `Walk_Carry_Loop` (CC0, OpenGameArt) is imported onto the source rig with the vendored MIT retargeter by `scripts/ashen-reach/append-carry.mjs`, which records provenance. It is used as the carry locomotion pose whenever the greatstaff is equipped: frozen at `speedRatio 0` while stationary, cadence-scaled while moving, and released for jumps and both casts. `hand-grip.js` keeps only the finger grip. The earlier numeric arm solver, Blender IK attempt and `two-hand-carry-pose.json` are superseded and removed from the runtime — see the reuse note below.
- Draw/stow is now an eased **0.35 s** travel between the hand and back sockets, replacing the instant snap for all held props in both the preloaded and streamed paths. Ownership is still committed immediately (the prop reparents on the first frame), so existing attachment assertions remain valid; only the local transform animates.
- Both spell recoveries hold with the greatstaff: Fire Blast and Lava Ball stow the weapon to the back, release the carry-pose overlay, deal their existing damage, and return the weapon and the two-hand grip afterwards.
- Validation: **23 automated equipment/contract tests**, **18 live two-handed checks**, plus the **22 armory**, **19 Graveweaver** and **19 grip** checks and the production build. No captured runtime errors. Anti-cheat note: contact is verified on the evaluated shaft axis, not by a screenshot.
- Performance (foreground owned Chrome, no recording, single actor, **1521×990**): gameplay and running-armory 792-frame samples at **144 FPS**, p95 **7.9 ms**, worst **8.6 ms**, max **44 draws**, zero frames over 16.67 ms. Local single-character evidence only.
- Reviewed video: [two-handed walkthrough v2](https://ve.sparkify.dev/wow-clone/ashen-reach/two-handed/2026-09-18-two-handed-neutral-hold-walkthrough.mp4) — 14.7 s, 1280×720 H.264/AAC with real engine audio, recorded by `scripts/ashen-reach/record-two-handed.mjs` (CDP screencast + `audio.capture()`). Covers armory Warden equip, carry pose front/side, live carry walk, Fire Blast stow/release/recovery, Lava Ball stationary charge/release/recovery and re-grip, with the neutral-phase stationary hold. Verified HTTP 200, `video/mp4`, matching 14,877,583 bytes and HTTP 206 ranges; delivered to the authorized Telegram chat (message 566). Stills: `ve-capture/ashen-reach/two-handed-v8/` (paired neutral-vs-extreme phases) and `ve-capture/ashen-reach/two-handed-v7/`. `ffmpeg` is not on PATH — the bundled `/Applications/BabylonJS Editor.app/Contents/bin/ffmpeg` (7.1, libx264/aac) encoded the `frames.ffconcat` + `audio.webm` with the recorded `audioOffset`.
- Letting the greatstaff stow like the one-handed staff put its butt at ~0.07 m (ground clipping). It now owns a raised `stow` transform; the stowed butt sits ~0.39 m above the feet.
- **Open and honest limit:** independent image review (nested `opencode run -f`, see [debug-view](debug-view.md)) finds the **front view reads two-handed with no visible clipping**, but side and third-person views remain ambiguous because the dark robe hides the hands and the generic carry clip's hands drift up to ~1 cm off the shaft over the cycle (the check accepts ≤2 cm). This is a **reuse win, not a bespoke pose**: an existing CC0 clip was retargeted instead of authoring one. A purpose-built weapon or a dark-outfit grip-contrast pass would improve readability. Do not present the stills as finished tailoring or cross-race validation.
- **Reuse note (process):** an earlier pass built a numeric arm solver (`solve-two-hand-pose.mjs`) and a custom Blender IK exporter before checking free animation libraries. That was over-engineering: the vendored MIT retargeter + the CC0 Quaternius UAL2 `Walk_Carry_Loop` clip already cover this. Follow the [workflow](reference-led-workflow-2026-09-17.md) reuse rule first; see the `ashen/animation-reuse` Serena memory.
- Posture follow-up (2026-09-18): freezing the carry loop while stationary parked lean-back walk extremes, so the idle read as hauling a heavy weight and snapped to normal on cast. The full free Quaternius set (UAL1 46 + UAL2 43 clips, verified by inventory; the 130+ figure includes paid Pro tiers) contains no relaxed two-handed hold, so no new asset was added: stationary now eases to the loop's most neutral phase (`TWO_HAND_STILL_TIME = 0.9` s, from `scan-carry-neutral.mjs`) within 0.25 s, and the existing 0.25 s clip blends cover cast enter/exit. Contact at the hold needs no grip change (right ~0, left ~1.1 cm). Paired-phase image review confirms upright/relaxed vs braced. The dramatic lean is banked for a future heavy-weapon type, not the staff.

Reproduce the two-handed pass from `the repository root` (browser commands run sequentially, `ASHEN_URL` selects the server):

```sh
node scripts/ashen-reach/check-two-handed.mjs
node scripts/ashen-reach/measure-armory.mjs --warden
npm run test:equipment
npm run build
```

### Stage D slice 1 — Orc source bind (2026-09-18)

- The 163-joint MakeHuman Orc (zero clips) is migrated onto the 65-joint source-compatible bind following the sanctioned Human pipeline, not substituted: `scripts/character-assets/bind_source_orc.py` (isolated background Blender: anatomical hip-socket pelvis, source torso rest curve, arm repose, weight collapse to mapped ancestors) exports the rest mesh + fitted centres; `scripts/character-assets/bind-source-orc.mjs` assembles `public/characters/candidates/orc-source-v1.glb` (65 joints, all 45 source rotation keys unchanged, Hips translation constant +14.97 cm rest offset, recomputed inverse binds, OrcV1 surfaces with remapped palette) plus provenance.
- Validation: generalized `test-source-motion.mjs` passes (both candidates plus the new `orc-source` diagnostic route), `validate-character-body.mjs --profile orc-male-v1` is valid with 0 errors, and an offline Hips→Neck lean table (`lean-table-orc.mjs`) reproduces the Human bind-v2 numbers exactly (Δ0.00° on all 8 matched phases) — no posterior-Hips lean.
- Audition: `body-preview.html` loads the candidate (`BODY_PREVIEW.load`, new `orc-source` route id and asset entry; views auto-fit the 2.14 m extents). Evidence: `ve-capture/orc-motion/bind-v1/` (idle front/side/three-quarter, walk front/side, sprint side, hands closeup, Human front reference). The preview's hands fallback (A-pose extents estimate) misses reposed candidates, so the hands shot aims from the FK-computed frozen-phase hand centre instead.
- **Open and honest limit:** the MakeHuman Orc source is modestly bulkier than the Human (shoulders ×1.21, 2.10 m) but has no tusk/fang sculpt and reads more green-human than separate species — a source-asset limit, not a bind defect. MH seams (hairline, chin, wrists) and the fist-closed Idle are shared with the Human. Single-frame "hunch" reads were rebutted objectively: head/hair sit exactly over the hips (0.000, both bodies) and rest arms match the Human candidate exactly. No garments, no socket refits, no armory race switch yet — those are the next slices.
- Bulk pass toward Grommash scale (2026-09-18, user reference): `scripts/character-assets/bulk_orc.py` warps the Orc flesh before binding — radial girth around arm/leg/neck bone axes plus torso width/depth, weighted by existing MH vertex groups (helpers inherit via parent walk; hands/feet/head excluded). Mesh-only: warps are radial/symmetric so joint centres stay valid. First pass read massive but broken (armpit webbing, buried neck, pinched waist); the correction moves arm joints outboard into the muscle (+0.06 girdle shift, segment lengths preserved), trims traps/neck and grows hips/thighs/belly. Image review confirms v2: webbing gone, neck seated, solid trunk, powerful from front/side/three-quarter. Remaining faceting is coarse source geometry + studio light, verified no tear. Evidence: `ve-capture/orc-motion/bulk-v2/` (supersedes `bind-v1/` stills). All gates re-ran green after the bulk (tests, validator, lean Δ0.00°).
- Orc convincing-anatomy pass (2026-09-18, delegated Grok 4.6 worker — 5 resumed passes, 110 turns, parent reviewed every pass): `bulk_orc.py` was rewritten for a correct depth warp (the earlier `WIDE` `p.z *= factor` scaled height from the ground, which tore the mesh — a genuine bug in my first pass), plus a real facial plane (heavy brow shelf, recessed sockets, projecting muzzle/snub nose, wide jaw, cheekbones), pointed ears, **thick up-swept tusks with gum mass rooted at the mouth corners**, a hair-cap replacement (dark topknot + tail, short beard), and a matte mottled skin material (raised roughness, generated tiling detail texture, olive-tan hue). All new geometry is skinned to the temp `mixamorig:Head` palette so the existing assembly remap handles it; `ARM_SHIFT` returned to 0 because the joint shift crumpled posed hands. Grok also caught and fixed a tusk-tube framing bug that had collapsed the tusks into flat plates, and an inside-out body from a bad mesh join, both verified in the preview before handing back.
- Grok worker evidence: `ve-capture/orc-motion/grok-v5/` (8 stills, head crops, `orc-head-montage.png`, `skin-detail.png`, `RESULT.md`); intermediate passes in `grok-v1..v4/`. Independent parent review of the final montage: **convinces as a stylized orc for this art direction** — matte credible skin, tusks read as a defining feature in three-quarter and profile, brow/muzzle/jaw in place. **Remaining polish, not blockers:** the pale band across the muzzle competes with the tusks in pure front view, skin tone variation is still flat versus the reference, and the geometric topknot reads hard against the softer body. It is not a Grommash sculpt match. All gates green after every pass: 5/5 motion tests, validator 0 errors, lean Δ0.00°, build. No garments, no socket refits, no armory race switch yet — those are the next slices.

Reproduce the Orc bind pass from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/character-assets/bind_source_orc.py
node scripts/character-assets/bind-source-orc.mjs
node scripts/character-assets/lean-table-orc.mjs
node --test scripts/test-source-motion.mjs
node scripts/validate-character-body.mjs public/characters/candidates/orc-source-v1.glb --profile orc-male-v1
node scripts/character-assets/review-orc-motion.mjs
```


### Stage C fit-contract increment — 2026-09-18

- Added `src/ashen-reach/equipment-contract.js` and immutable per-item declarations for Human body, source-65 rig, bind/shape version, seam names and occupied slots. Catalogue startup checks catch coverage typos, invalid cuff precedence, missing garment meshes and invalid grip/stow transforms before creating props.
- Entire candidate loadouts are checked for occupied-slot conflicts before changing selection or mesh visibility. A two-handed contract rejects an off-hand item in either selection order. This is tested using a synthetic catalogue entry; the shipped Graveweaver staff remains one-handed. No new two-handed animation or prop is claimed.
- Existing union coverage and boot/cuff rules are retained. Seam names describe authoring boundaries; they do not prove geometric seam closure or eliminate clipping. Bind identity remains a semantic authoring contract, backed by the existing exact bind/animation asset tests, not a new runtime skeleton fingerprint.
- Validation: 15 automated equipment/contract tests, 19 live Graveweaver browser checks, and production build passed. Live checks exercise mixed garments, 30 preset swaps without mesh/pose changes, hair/hand restoration, movement, Fire Blast, interrupted and successful Lava Ball. No captured runtime errors. Reviewed the live front capture at `ve-capture/ashen-reach/fit-contracts/equipped-front.png`.
- Live verification used port 5175 because an old process still owned 5173 from the removed `lite-moonwell` directory. Root application default remains 5173. No new performance claim from this validation pass.
- Next: replace eager catalogue preparation with bounded prepared-item ownership and atomic asynchronous swaps. Keep the working synchronous actor path while implementing cache eviction, latest-request-wins and failed-load recovery. Stage C remains open; geometric seam qualification, actual two-handed pose/transition work and distinct Orc fits are still outstanding.


### Stage C on-demand equipment — 2026-09-18

- Default gameplay loads `equipment/body.glb` plus only selected garment assets. `npm run prepare:equipment` derives the body and eight individual garments from the reviewed `wanderer-equipment.glb`; original source/provenance remains authoritative. `?preloadedEquipment` retains the prior synchronous path for comparison/recovery.
- One existing actor/mixer owns all 55 clips. Each loaded garment keeps its own vertex skin buffers and borrows the actor's evaluated bone palette. Split validation proves exact joint order, inverse binds, mesh bind frame and vertex attributes. Before native Lite removal, restore the garment's owned skeleton so eviction cannot destroy the actor palette. This deliberately supports the current source-compatible Human only.
- Full-loadout changes stage invisibly, then commit together. Current outfit remains visible during loading; UI reports failure and retains it. New requests merge with the latest desired selection, abort stale fetches and supersede old results. Preparation is serialized with a 15-second per-item timeout; late cancelled resources are retired. Equipment disposal is idempotent.
- Cache retains equipped entries plus at most two unused entries; during preparation, the old and candidate outfits may coexist. Garment downloads are limited to 16 MiB each. These are resource-count and compressed-asset limits, not a measured GPU-byte budget. Item textures and data can be duplicated across fits; this is not yet crowd-scale memory validation or a faster-startup claim.
- Validation: **21 automated equipment tests**, **19 live outfit/motion/spell checks**, **8 live streaming checks**, production build. Injected HTTP 503, delayed fetch supersession, retry, repeated evictions and retained actor/palette all passed. Source skin/geometry and all original animation curves remain exact. No captured runtime errors.
- Foreground Chrome, no recording, **1521×990 buffer**: 792 frames (~5.5s) each for gameplay and running armory, **144 FPS**, p95 **7.6 ms**, worst **7.8/7.9 ms**, max **47 draws**, zero frames above 16.67ms. Separate 12-swap sample: cached selection **0.3–0.6 ms**, garment re-preparation **23.4–49 ms** elapsed asynchronously; 205 sampled frames, p95 **7.6 ms**, worst **7.8 ms**, zero over 16.67ms. Local warmed HTTP cache, single actor; not wide-area download or crowd performance.
- Reviewed front/run captures and sampled frames of a **29.3-second** live CDP walkthrough with engine audio: [streamed equipment walkthrough](https://ve.sparkify.dev/wow-clone/ashen-reach/streamed-equipment/2026-09-18-walkthrough.mp4). Public object verified HTTP 200, video/mp4, 17,866,885 bytes and HTTP 206 byte ranges. Evidence: `ve-capture/ashen-reach/streamed-equipment/`.
- Reproduce: `npm run test:equipment`, `node scripts/ashen-reach/check-equipment-stream.mjs`, `node scripts/ashen-reach/check-graveweaver.mjs`, `node scripts/ashen-reach/measure-armory.mjs --graveweaver`. Browser checks/recording accept `ASHEN_URL` for an explicitly selected server; run browser tasks sequentially. Captures can use `ASHEN_CAPTURE_DIR`.
- Still open (two-handed prop/pose and eased stow/draw were delivered in the 2026-09-18 Stage C two-handed increment below): geometric seam qualification beyond current fits, Orc/Undead and body sliders, persistence across reload, and many-actor resource budgeting. The one-handed Graveweaver staff remains one-handed; the two-handed `graveweaverGreatstaff` is the two-handed proof.

Delivery: reviewed MP4 sent to the authorized Telegram chat (message 554); HTTP MIME/length/range verification completed before sharing.

### User-prioritized correction: hands and held props (2026-09-18)

- [x] Diagnose on bare hands as well as gloves: source fist over-curl plus misaligned prop orientation/position caused the reported artifacts.
- [x] Add source-derived, finger-only equipment grip poses through the existing Lite mixer. Relax empty hands; release for original spell motion.
- [x] Fit the staff across the palm, give the grimoire a leather carrying strap, and align prop offsets in evaluated socket coordinates. Match sword grip to the same fitted hand.
- [x] Apply to both streamed and preloaded equipment; retain native whole-body locomotion and casting.
- [x] Pass 21 equipment unit/asset tests, 19 existing live equipment/spell checks, and 19 new grip checks across both loading paths. Review gloved/bare close-ups and gameplay video.
- [x] Measure without recording: roughly 144 FPS at 1521×990, foreground Chrome, single equipped actor, idle gameplay and running Armory preview (46 draws). This is not crowd-scale evidence.

This is a fitted one-handed contact correction, not a two-handed IK/draw animation system. The next separately scoped equipment deliverable remains a real two-handed prop/pose with convincing transitions, followed by distinct Orc fitting. Do not treat the Human grip samples as universally reusable race data.

Reviewed 21-second [grip correction video](https://ve.sparkify.dev/wow-clone/ashen-reach/grips/2026-09-18-grip-review.mp4), also delivered with close-up stills through Telegram. Silent raw game capture; first section uses the Armory inspection light and diagnostic close-up cameras, followed by normal gameplay. Local reproducible evidence: `ve-capture/ashen-reach/grips/` (ignored).
