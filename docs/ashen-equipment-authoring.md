# Ashen equipment: first fitted Human slice

Stages B and the Human magic-set Stage C increment of [the living plan](armory-and-equipment-plan.md), 2026-09-17. This is the reproducible path for the current mail/cloth tunics, trousers, boots and Graveweaver magic set; it is not a universal fitter or a completed multi-race catalogue.

## Sources and outputs

- MakeHuman suits02 **CC0** Viking tunic, trousers and boots by **Rehman Polanski**, and Monk robe/hood by **Donitz**: https://static.makehumancommunity.org/assets/assetpacks/suits02.html . Original mesh, UVs, diffuse textures and MakeClothes fitting references are reused. Local source/license/hash records: `blender/characters/sources/armory/{README.md,provenance.json}` and original `.mhclo` headers.
- MakeHuman gloves01 **CC0** short gloves by **Margaret Toigo** (original header MRT): https://static.makehumancommunity.org/assets/assetpacks/gloves01.html . `gloves-provenance.json` retains the archive and extracted-file hashes.
- Original procedural sword: `src/ashen-reach/arming-sword.js`. No downloaded sword dependency. `mage-props.js` authors the staff/grimoire; the fitting script authors the small bronze/amethyst pendant.
- Existing Human base: `public/ashen-reach/wanderer.glb`. Its actor/rig/animation provenance continues to apply separately; garment CC0 does not relicense those assets.
- Prepared playable pack: `public/ashen-reach/wanderer-equipment.glb`, with `equipment-provenance.json`. Current 65-joint bind and all 54 animation clips remain exact.
- Editable fitted garments: `blender/characters/ashen-wayfarer.blend`, textures packed. This file contains a temporary export palette, not the final animation rig. Final skin assembly happens in glTF Transform.

## Rebuild

Run from `the repository root`. Existing base MakeHuman sources and original source-compatible `wanderer.glb` must already exist; the garment fetch does not recreate the actor.

```sh
python3 scripts/ashen-reach/fetch-equipment-assets.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/ashen-reach/fit-armory-clothes.py
node scripts/ashen-reach/prepare-equipment.mjs
node --test scripts/test-ashen-equipment.mjs
```

Fetcher verifies the downloaded pack SHA-256 values before extracting the six selected source garments. If upstream changes, investigate rather than bypassing the checksum. Background Blender operates on its own scene; it does not clear the interactive Blender/MCP scene. Read Blender output: process exit code alone can miss Python exceptions.

Fitting reuses this repository's MakeHuman targets, MHCLO parser/fitter, A-rest conversion and source bone mapping. MHCLO references include **helper vertices** beyond the visible body: preserve their weights in fitting, or boots fail or deform incorrectly. Interpolate authored reference weights, collapse them to supported source bones, keep four influences, normalize. Texture sheets are reduced to 256×256, with nearest sampling. This is authored clothing geometry, not a body-offset shell.

Preparation remaps garment joint indices by name, rejects unmapped weighted joints, replaces the temporary palette with the original source skin, preserves the original hierarchy/inverse binds/curves, and splits original body triangles into disjoint visible/covered meshes. Current coverage boundaries are specific to this Human and these garments; they combine conservative coordinate-derived masks with a hand-weight threshold, not reusable anatomy zones for arbitrary races.

## Runtime contract

`equipment-catalog.js` has stable item IDs (`wayfarerTunic`, `pilgrimTunic`, `wayfarerTrousers`, `wayfarerBoots`, `ironSword`) independent of UI labels. All seven slots (head, torso, legs, boots, gloves, main hand, off-hand) are supported now. The fitted garments are preloaded in one prepared GLB; equip changes visibility and corresponding body coverage synchronously. Unequipping restores underlying body triangles. Swapping neither rebuilds the actor nor restarts animation. The current selection survives closing the armory but is not saved across page reloads.

This small preloaded catalogue proves one shared pose and fit. **Do not preload hundreds of garments this way.** Stage C must establish compatible on-demand composition/cache ownership, failure recovery and latest-request-wins semantics before a large catalogue. Older garment loaders target other binds and cannot be enabled blindly.

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

All seven slots, contrasting cloth/mail/magic outfits and staff/sword/book choices are implemented. The current staff is deliberately one-handed; no two-handed weapon or shield exists yet. Standardize seam/coverage rules and item fit metadata while exercising mixed combinations. Preserve a compact catalogue until a visibly distinct Orc proves the same logical items on another body. Human-only success does not establish Orc/Undead fitting or arbitrary body-slider support.


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
