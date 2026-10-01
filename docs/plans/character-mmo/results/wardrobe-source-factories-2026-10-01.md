# Wardrobe source factories — candidate checkpoint, 2026-10-01

Two native Blender factories compile fifteen independent per-race source fits: Lector cloth coat and four Duskguard articulated armor items on accepted Human, Orc and Undead bodies. **Milestone 6 remains open; neither design is advertised or released.** Descriptors remain candidate-only; the future publisher refuses that status before writing production assets. Production remains Pages `0c2f92c1-a4f8-43ab-838f-45c0f622df4b`.

## Implemented and verified

Descriptors pin Blender 5.2.1, actual body/underlayer hashes, slots/layers/deformation, materials, rig/bind/shape interfaces and rights provenance. Frozen Wayfarer inputs prevent cumulative tailoring. Existing body grant limitations remain. Native BMesh, Solidify, Data Transfer, original skin groups, glTF Transform and existing bind/shape tools are reused; source comments link their documentation.

Lector retains the source torso/waist with a real stand collar, folded lapels, flared cuffs and underarm panels. Duskguard has four independent items, steel shells/brass solid rims, one full intended bone weight per rigid piece and skinned underlayers/gussets. The actor retains animation ownership. Human fitting handles deformation per primitive; compact generation preserves any actual rigid primitive, including mixed cloth/plate items. New design startup/performance remains unmeasured.

Independent written-file validation requires exact 65-joint order/inverse binds, matching frames/rest palettes, finite indexed geometry, body-relative bounds, normalized four-influence skinning, explicit deformation and rigidity. Six mutation controls cover bad bind/palette, 100× geometry, bending plates, absent metadata and mixed compact policy. **145 character / 82 equipment tests and normal/Pages builds pass.** Twenty-four existing Human family artifacts reproduce byte-identically; only producer provenance changes. Starter bytes and catalogue IDs remain unchanged.

Lector's initial native repeat failed despite identical geometry: BMesh reordered identical wound triangles and Data Transfer varied tiny weights. Canonical cyclic triangle ordering plus explicit 10⁻⁶ weight quantization stabilizes the new candidate, without vertex reindexing. Largest applied weight delta is **1.49012×10⁻⁶**; normalized totals remain explicit. Final repeat: **all fifteen source artifacts byte-identical**. Native influence reduction is reported separately. Roughly two seconds per Lector race is compilation time, not authoring labor.

## Live failures retained

- Current Wayfarer at identical camera/shape/phase reproduces Lector's Human stout rear trouser and small front skin breaches, and Undead rear trouser breach. These inherited defects remain failed acceptance gates.
- Duskguard underarm gussets close the confirmed Human stout rear-cast skin breach. Independent Grok review confirms real bind/rigidity/material policies and visible recesses between torso bands. Reducing standoff 35→16 mm causes cloth-through-metal on stout Human/Undead; reject it and retain 35 mm pending a proper joint/layer design.
- Donitz long/short tails, global/rear transfers, shrinkwrap/subdivision, hip-cropped Wayfarer/full lining and copied-body torso fail. The latter adds jagged shoulders, exposed belly and a rib silhouette instead of credible cloth. Do not repeat offset/weight sweeps or whole-body replacement.
- Blank reset captures are rejected. A local check loaded the historical developer garment manifest; the harness now routes both manifest paths to current immutable data. Runtime success alone is not visual acceptance. Do not rebuild audition files concurrently with a capture reading them.

Reviewed Duskguard live motion: **Telegram 830**, [VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/duskguard-source-motion-2026-10-01.mp4), 190.322 seconds, 1280×720, square pixels, zero rotation; three races, Human endpoints, source motions and normal Havok movement. Parent inspected video frames and actual advancing public VE playback. Failed Lector fit probe: **Telegram 831**, [VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/lector-source-fit-limit-v2-2026-10-01.mp4), 15.577 seconds, same proportions. Telegram returned matching dimensions; its Web client did not display the new messages during inspection, so new inline/fullscreen presentation remains unverified. These isolated fit recordings provide no FPS, cold-start, physical-phone or full-design acceptance claim.

## Resume

Run `node scripts/character-assets/build-lector-coat.mjs`, `node scripts/character-assets/build-duskguard-armor.mjs`, then `node scripts/character-assets/prepare-wardrobe-auditions.mjs lector` / `duskguard`. Outputs remain in `.cache/character-mmo/wardrobe-v1`; the harness owns one game and labels legacy aliases.

Tracked [evidence](../../../baselines/character-mmo/wardrobe-source-factories-2026-10-01/) retains reports, reproduction hashes, independent review and unretouched failure/control frames. Full recordings/manifests remain under `ve-capture/character-mmo/`; public reviewed videos preserve motion.

Continue the [conservative layer coverage plan](../layer-coverage-implementation.md): actual independently hideable body/garment regions, preserved source accessors/curves, explicit conditional rules and same-pose bare/equipped checks. Then review five designs, migrate/publish the real catalogue, implement bounded remote preparation and pass performance/load/production gates. M5 identity/headwear and M8 hub capacity remain open.
