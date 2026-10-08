# One authored shield — implementation and acceptance

Continue the fourth recommended package in [CURRENT](../../CURRENT.md), preserving
the original five-priority goal's release and physical-device exits. The useful
result is one playable shield, rather than catalogue breadth or a new attachment
system. Root authors and reviews; Grok handles bounded operations/review.

## Asset and interface

Author **Bastion heater shield**: a curved, closed heater silhouette, restrained
metal rim/crest, wooden or painted face, visible back and leather hand grip. Follow
the accepted armor's dark cloth/steel/brass palette. Author original geometry in
isolated pinned Blender 5.2.1, exported through its native glTF exporter. Retain a
descriptor, source builder and reproducible artifact; do not introduce a texture
download for this first prop. Aim for at most 2,200 triangles, three material
groups and 96 KiB. The origin is the center of a real horizontal carrying grip.

Use a rigid **unskinned** glTF prop. Source-65 sockets already evaluate animation
through the native palette; a second skeleton would add ownership and fit work
without improving a rigid shield. Inspect the installed Lite 1.31.1 loader,
`src/character/sockets.js`, `equipment-stream.js` and grip/stow helpers. Retain
source curves, movement and the existing transaction/cancellation/cache owners.
References: [pinned native loader](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/loader-gltf/load-gltf.ts),
[Lite skeleton](https://doc.babylonjs.com/lite/architecture/13-skeleton/),
[Blender glTF exporter](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html).

## Execution

1. Add a narrowly scoped rigid-prop descriptor/builder entry point. Reuse existing
   pinned Blender version, GLB validation, triangle canonicalization and NodeIO.
   Independently reject skins, clips, morphs, external resources, unexpected
   materials/meshes, invalid topology/normals, excess dimensions or cost. Repeat
   native builds byte-for-byte before accepting a candidate.
2. Audition that asset on existing evaluated off-hand sockets in the actual game.
   Check neutral Human/Orc/Undead plus Human height/build endpoints, front/side/back,
   carrying run/jump and all casts. A diagnostic candidate on an existing item
   identity proves visual fit only; it is not catalogue or transaction acceptance.
   Correct grip orientation and back stow from actual motion before integration.
3. Add the canonical off-hand item and explicitly evolve the appearance catalogue
   to v9 while freezing v8 membership. Reuse existing hand occupancy, committed
   grip masks and cast transitions. Load the authored asset through native
   `loadGltf` and the existing buffer lease/transaction owners. Define exact mesh
   names and authored resource identity; do not continue assuming every hand
   factory has zero transfer bytes or a procedural mesh-name prefix.
4. Include the shield in saved-start preloads, maximum compact payload enumeration,
   appropriate delivery checks and the remote renderer's current catalogue.
   Share immutable geometry/resource identity across fits with explicit measured
   grip corrections. Keep Human shape and old identity/source bytes exact. Prove
   save/reload, race/shape switches, greatstaff conflicts, swaps to/from the book,
   failed/truncated/corrupt delivery, cancellation/latest-wins, rollback and disposal.
5. Review/deliver canonical live motion on VE/Telegram. Measure cold/resident swap
   cost, draw/geometry/resource cost and separate native 1280×720 settled route
   windows with seven enemies and one renderer. Retain 144 FPS target and >120 FPS
   floor; no recording during timing. Commit/push the accepted package. Production
   promotion still requires the full existing sealed startup/release gates and a
   demonstrated fix for the retained failure. A private preview is not a release.

Use focused continuous fixtures, not another full static wardrobe matrix. No
shield combat mechanics, new races or generalized prop authoring platform are
required. Track actual results and remaining integration work in CURRENT.

## Verified prototype checkpoint — 2026-10-07

Original source and native repeat export are now available at
`blender/characters/props/bastion-shield.json` / `.glb`. Build with
`node scripts/character-assets/prepare-authored-prop.mjs blender/characters/props/bastion-shield.json --out .cache/<new-directory> --repeat`;
run `npm run test:authored-prop`. Twelve refusal controls pass. The source has
1,104 triangles, three native material groups and 67,352 bytes, with no rig,
animation, morphs, external resources or texture requests.

The first native stow pointed the board inward and intersected the torso.
Closed-surface/normal checks proved this was not a missing board face. Turning
both holds outward fixes the demonstrated intersection in the bounded native
views without changing asset bytes. Retain these measured socket-local values
for canonical integration; they are not world transforms:

| Fit | Hold position | Hold quaternion | Prop scale |
| --- | --- | --- | --- |
| Human / Undead | `[.005,-.080,.020]` | `[0,1,0,0]` | 1 |
| Orc | `[.0176,-.0956,.0192]` | `[0,1,0,0]` | 1.12 |

Shared back position `[0,.18,-.17]`, quaternion
`[.985426,.015120,-.114652,-.124749]`; back uses the same race prop scale.
Human height/build remains owned by the existing actor and evaluated sockets.
Root reviewed seven fits / 35 complete native run, jump and cast chapters plus
three normal Havok run/jump cases. The private harness uses the committed book
identity solely for its existing left-hand grip mask. It does not prove shield
catalogue membership, occupancy, resource ownership or transaction acceptance.
The original appended movement assertion failed at its end fixture; its failed
receipt remains alongside the separately passed movement operation.

Continue steps 3–5 above. In particular, count the shield's real transfer bytes;
current hand-factory branches incorrectly imply procedural construction and
zero network cost for an authored item. Preserve v8's exact membership/hash,
keep the Human identity index at v6, and give the rigid native meshes their own
container/disposal and pre-visibility PBR fence. Add the resource to selected
startup preloads, maximum outfit enumeration, delivery coverage and remote
catalogue publication. Use the existing transaction/grip/stow owners.
