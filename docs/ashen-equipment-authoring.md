# Ashen equipment: first fitted Human slice

Stages B and the Human magic-set Stage C increment of [the living plan](armory-and-equipment-plan.md), 2026-09-17. This is the reproducible path for the current mail/cloth tunics, trousers, boots and Graveweaver magic set; it is not a universal fitter or a completed multi-race catalogue.

## Sources and outputs

- MakeHuman suits02 **CC0** Viking tunic, trousers and boots by **Rehman Polanski**, and Monk robe/hood by **Donitz**: https://static.makehumancommunity.org/assets/assetpacks/suits02.html . Original mesh, UVs, diffuse textures and MakeClothes fitting references are reused. Local source/license/hash records: `blender/characters/sources/armory/{README.md,provenance.json}` and original `.mhclo` headers.
- MakeHuman gloves01 **CC0** short gloves by **Margaret Toigo** (original header MRT): https://static.makehumancommunity.org/assets/assetpacks/gloves01.html . `gloves-provenance.json` retains the archive and extracted-file hashes.
- Original procedural sword: `src/ashen-reach/arming-sword.js`. No downloaded sword dependency. `mage-props.js` authors the staff/grimoire; the fitting script authors the small bronze/amethyst pendant.
- Existing Human base: `public/ashen-reach/wanderer.glb`. Its actor/rig/animation provenance continues to apply separately; garment CC0 does not relicense those assets.
- Prepared playable pack: `public/ashen-reach/wanderer-equipment.glb`, with `equipment-provenance.json`. Current 65-joint bind and all 55 animation clips remain exact.
- Editable fitted garments: `blender/characters/ashen-wayfarer.blend`, textures packed. This file contains a temporary export palette, not the final animation rig. Final skin assembly happens in glTF Transform.

## Rebuild

Run from `the repository root`. Existing base MakeHuman sources and original source-compatible `wanderer.glb` must already exist; the garment fetch does not recreate the actor.

```sh
python3 scripts/ashen-reach/fetch-equipment-assets.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/ashen-reach/fit-armory-clothes.py
node scripts/ashen-reach/prepare-equipment.mjs
npm run prepare:equipment
npm run test:equipment
```

Fetcher verifies the downloaded pack SHA-256 values before extracting the six selected source garments. If upstream changes, investigate rather than bypassing the checksum. Background Blender operates on its own scene; it does not clear the interactive Blender/MCP scene. Read Blender output: process exit code alone can miss Python exceptions.

Fitting reuses this repository's MakeHuman targets, MHCLO parser/fitter, A-rest conversion and source bone mapping. MHCLO references include **helper vertices** beyond the visible body: preserve their weights in fitting, or boots fail or deform incorrectly. Interpolate authored reference weights, collapse them to supported source bones, keep four influences, normalize. Texture sheets are reduced to 256×256, with nearest sampling. This is authored clothing geometry, not a body-offset shell.

Preparation remaps garment joint indices by name, rejects unmapped weighted joints, replaces the temporary palette with the original source skin, preserves the original hierarchy/inverse binds/curves, and splits original body triangles into disjoint visible/covered meshes. Current coverage boundaries are specific to this Human and these garments; they combine conservative coordinate-derived masks with a hand-weight threshold, not reusable anatomy zones for arbitrary races.

## Runtime contract

`equipment-catalog.js` owns stable IDs for all seven slots. Default gameplay streams selected garment GLBs from `public/ashen-reach/equipment/` through `equipment-stream.js` and `equipment-loader.js`. The combined pack remains the authoring source and `?preloadedEquipment` fallback. Selection survives closing armory, but not page reload.

The splitter preserves the exact source skin and identity mesh bind frame; `test-streamed-assets.mjs` checks that boundary. Do not share pose palettes across different binds/orders/mesh frames. Full selections stage invisibly then commit; failures retain the prior outfit, newer requests abort/supersede older requests, and the cache keeps at most two unused entries. Garments restore their owned skeleton before native Lite disposal to protect the shared actor palette. See the living plan for measured swap latency and resource limits.

The sword uses the existing evaluated socket host shared with cast effects. `setParent` in installed Lite **preserves world transforms**; restore authored local position/quaternion/scale after parenting. A green equip check did not catch the initial displaced sword; side-view review did. Each item's local grip orientation belongs to the item/fit contract, not a world-up correction in the socket solver.

Current casting policy: sword, staff and grimoire stow to an authored back transform during Fire/Lava previews and real cast/recovery, then return to their respective hands. This keeps the original open-hand gesture. Stow/draw currently switches instantly; there is no sheath mesh, draw animation or weapon-specific locomotion/melee. Those are presentation extensions, not hidden completed features.

## Verify in the actual game

Vite 5173, owned Chrome CDP 9337. Run browser scripts sequentially against `ashen-reach.html?play&clean`:

```sh
node scripts/ashen-reach/check-graveweaver.mjs
node scripts/ashen-reach/check-armory.mjs
node scripts/ashen-reach/record-armory.mjs --graveweaver
node scripts/ashen-reach/measure-armory.mjs --graveweaver
npm run build
```

Equipment checks inspect **actual skinned mesh nodes**, not same-named parent transforms; a parent's `visible` flag can remain true while its rendered child is hidden correctly. Offline checks prove exact source clips/bind, normalized garment weights, and a nonduplicating body partition. Live checks prove independent swaps, retained animation time, hand attachment, cast stow/recovery and both damage events. Review front/back/side, run, jump, casts and ordinary gameplay; tests cannot prove good tailoring.

Latest evidence: `ve-capture/ashen-reach/graveweaver/`; Stage B evidence remains under `equipment/`. The recorder includes real DOM/gameplay and engine audio; `video/recording.json` records timing and audio offset. The sheet is a diagnostic montage of sampled video frames, not retouched game art. Performance is measured without recording, foreground, one character at the existing 960×540 buffer.

## Next useful expansion

All seven slots, contrasting cloth/mail/magic outfits and staff/sword/book choices are implemented. The `graveweaverGreatstaff` is a real two-handed variant (see below); a shield does not exist yet. Standardize seam/coverage rules and item fit metadata while exercising mixed combinations. Preserve a compact catalogue until a visibly distinct Orc proves the same logical items on another body. Human-only success does not establish Orc/Undead fitting or arbitrary body-slider support.

## Two-handed hold and eased stow/draw (2026-09-18)

- `graveweaverGreatstaff` uses `factory:'greatstaff'` (a longer shaft/fork variant of `createMageProp('staff')`), `twoHanded:true`, and `occupies:['mainHand','offHand']`. Its `gripPosition`/`gripRotation` are authored in the **evaluated right-hand socket frame** so the shaft passes through the right wrist and the left hand. Current values (derived from the carry clip, frame 0): `gripPosition:[.00572,.02636,-.01291]`, `gripRotation:[-.353791,0,-.362037,.862416]`. Re-derive them whenever the carry pose or weapon changes.
- The carry pose is a **retargeted CC0 animation**, not a hand-authored override. `node scripts/ashen-reach/append-carry.mjs` imports Quaternius UAL2 `Walk_Carry_Loop` (CC0; `.cache/animation-research/ual2/UAL2_Standard.glb`) onto the source rig with the vendored MIT retargeter and records provenance in `animation-provenance.json`. `body.js` uses it as the locomotion pose while the greatstaff is equipped: `speedRatio 0` when stationary, `WALK_RATIO`/`RUN_RATIO` while moving, blended out for jumps and casts. `scripts/ashen-reach/sync-equipment-clips.mjs` copies a clip into `wanderer-equipment.glb` when only animation changed (avoids the Blender/garment recomposition), then `npm run prepare:equipment` re-splits the streamed assets. The earlier numeric solver (`solve-two-hand-pose.mjs`), Blender IK exporter and `two-hand-carry-pose.json` are **superseded** — do not restore them or a `Pistol_Idle_Loop`/`Push_Loop` overlay (a source arm pose re-pitches when applied over locomotion).
- Adding a clip changes the count asserted by `scripts/test-ashen-equipment.mjs` (currently **55**) and the `CURRENT.md` motion row; keep them in sync.
- The greatstaff owns a raised `stow` transform; the one-handed staff's stow put the longer butt at ~0.07 m and clipped the ground. Stowed butt is now ~0.39 m above the feet.
- Review the carry with the nested-run vision path (`opencode run --pure -m opencode-go/deepseek-v4.1-flash "<prompt>" -f <png>`), because image tool-results in this session arrive as OCR text. Current honest status: front reads two-handed with no clipping; side/third-person remain ambiguous (dark robe hides hands) and the generic clip's hands drift up to ~1 cm off the shaft over the cycle.
- `resolveHandEquip(current, patch, items)` in `equipment-contract.js` implements interactive hand exclusivity (most recent hand change wins). Direct `validateEquipmentSelection` still rejects a genuine two-handed/off-hand conflict, which the contract test relies on.
- Stow/draw is an eased **0.35 s** travel implemented in `prop-transition.js` and applied in both `equipment.js` and `equipment-stream.js`. The prop reparents to the destination socket immediately (so `equipment.attachment` and the socket parent are committed at once) and only its local transform animates. `equipment.update(dt)` now takes the frame delta from `main.js`.
- Verify with `node scripts/ashen-reach/check-two-handed.mjs` (contact on the evaluated shaft axis within 2 cm, carry release, eased travel, both spell recoveries, conflicts). Contact is a numerical axis distance, not proof of good tailoring; check the actual captures. `measure-armory.mjs --warden` measures performance.



## First mixed-set rules

`equipment-catalog.js` owns the two torso alternatives, separate trousers, boots, and sword. Coverage is a union over selected items; never let an unselected alternative restore body regions hidden by the selected item. `BodyWaist` is shared by torso and legs, while their other regions remain independent. The six body partitions still preserve every original body triangle exactly once.

The trousers have a main mesh and a lower-cuff mesh split inside the current boots at y=.31m. Boots suppress cuffs; removing boots restores them. This rule is specific to the current tall boots; a future short shoe must declare its own coverage rather than inherit an unconditional tuck rule. The Pilgrim tunic is cut from the authored robe at .76m in Blender, interpolating UVs and weights at the hem. It is not a generic cloak generator. Original source/derivative license remains CC0.

MHCLO readers must stop vertex mapping at `delete_verts` and skip comments. Those entries describe body masking rather than garment vertices. The current pipeline uses its own reviewed fit-specific partitions; it does not apply the source robe's full-length delete mask after shortening the robe.

## Graveweaver magic set and outfit selection

Ahrim's OSRS hood/robe/skirt/staff silhouette is reference only: https://diamondlobby.com/osrs/best-magic-armor-osrs/ . Local reference `.dream-loop/ahrim-reference/ahrim.jpg` is not a shipped texture. All geometry is derived from the licensed sources above or authored in this repository.

- `graveweaverHood` uses Donitz's hood. Equipping hides `HumanHair`; removing restores it independently of other slots. Face remains visible beneath the hood opening.
- `graveweaverTop` crops the Viking mail tunic below .84m, adds the original skinned chest pendant, and covers the same torso/waist regions. Muted cold material factors distinguish it from Wayfarer.
- `graveweaverSkirt` crops the Monk robe to .12–.99m. Lower panels are eased outward over the trouser layer, fading the ease at the waist. The continuous authored hem avoids disconnected strips from cutting the fitted surface. The item includes trousers underneath for coverage and follows the boot/cuff rule. This is ordinary skinning; deep jump folds stretch and are not simulated cloth.
- `graveweaverGloves` uses fitted Toigo gloves. `BodyHands` consists of body triangles whose averaged hand/finger skin weight exceeds .75; hiding it prevents finger poke-through. The source triangle partition remains exact.
- `graveweaverStaff` and `graveweaverBook` use evaluated right/left hand sockets with authored local quaternion offsets. They stow independently on the evaluated back socket during casts, leaving the existing gesture/particle origins intact. No extra dynamic lights or texture assets are added for these props.
- `EQUIPMENT_PRESETS` contains complete Wayfarer, Pilgrim and Graveweaver loadouts. `setLoadout` validates a candidate copy before committing; malformed items/slots leave the previous selection unchanged. A preset preserves the current pose/actor/resources. This is atomic synchronous selection, **not asynchronous failed-load recovery**.
- The armory's Graveweaver preset button equips all seven slots and widens full-body framing for the tall staff. Individual controls remain independent; closing keeps the chosen combination.

Verified combinations include magic top with trousers, cloth top with robe skirt, complete magic set, no hood, no gloves, and no off-hand. Thirty complete preset swaps retain resource counts and paused phase. Human-only fits, preloading, instant stow/draw and generic source weapon locomotion remain explicit limitations. Future two-hand gear needs occupancy/conflict rules before being added.

## Held-item contact (2026-09-18)

Props declare `gripPosition`, `gripRotation` and `gripPose` in `equipment-catalog.js`. Positions are metres in the **evaluated socket frame**, not source bone axes. On this mirrored Human, socket-local +Y points toward the wrist; do not assume a positive Y offset moves toward the fingertips. The shaft must cross the curled fingers, not run along the palm. Inspect front, palm, underside and normal gameplay views with gloves both on and off.

`src/character/runtime/hand-grip.js` adjusts only the 30 finger joints using rest/closed samples from the shipped source `Idle_Loop`. The fitted bind already has finger curvature; playing the original roughly 78-degree bend at all three segments folds the tips into the palm. Equipment uses a reduced curl, empty hands relax, and casting releases the finger masks to the original spell clips. Both gameplay and Armory call the same evaluator. Whole-body source clips remain unchanged.

Use native Lite `setBonePoseDeferred` **before** the native animation-manager evaluation, with the affected finger channels excluded from the current clip masks; restore those masks afterward. `bakeSkeleton` after animation would reset the entire body to rest. Do not create a second animation clock or manually update the GPU palette. Streamed gloves continue to borrow the body palette.

Regenerate the source samples with `node scripts/ashen-reach/prepare-hand-poses.mjs` if the reviewed source asset changes. These translations/rotations fit **Human source-65, bind 1 / shape 1**; they are not a universal race-independent grip fit. New race binds need reviewed grip data and offsets. The book has a raised rear leather strap to provide a real surface for the fingers to enclose; staff/sword grip thicknesses are fitted to the same hand.

`node scripts/ashen-reach/check-grips.mjs` checks contact stability through idle/walk/run/jump/land, cast release/regrip, empty hands and glove removal in streamed and preloaded modes. `record-grips.mjs` captures close-ups plus actual gameplay. Both accept `ASHEN_URL`; captures accept `ASHEN_CAPTURE_DIR`. Contact stability checks do not establish visual contact by themselves: review the actual capture.
