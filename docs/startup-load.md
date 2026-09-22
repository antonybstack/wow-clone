# Startup load

How `ashen-reach.html` decides what the player waits for. The goal is an uncached first visit that is as short as it can be without a frozen character or a nude flash. This is the live behavior as of 2026-09-21.

`ASHEN.presentMs` is when the loading overlay comes off. `ASHEN.loadMs` and `ASHEN.ready` are when clothes, combat, churchyard shades, townsfolk and grass are in. Probes wait on `ASHEN.ready`. Do not move `ready` earlier: several checks cast or read the outfit on the next line.

## What blocks the overlay

In `src/ashen-reach/main.js`, in this order:

1. WebGPU engine.
2. The churchyard and Hollowmere geometry in `buildChurchyard`, including the ground, stone, wood, bark, grave-face and sky images those batches are built with.
3. Havok, then the player body. The default file is `public/ashen-reach/equipment/body.glb`. `?preloadedEquipment` still loads the much larger `wanderer-equipment.glb` and is not the path this pass optimized.
4. `registerScene` and `startEngine`.

`enableBoneControl()` runs before `attachBody`, and `startEngine` runs only after `attachBody` returns. Lite skins a mesh from the skeleton built at load. Starting the renderer first and attaching the body on a later frame left Idle_Loop playing (weight 1, time advancing) while the mesh stayed in the bind pose, arms straight out. Do not "fix" the overlay by moving `startEngine` above `attachBody`.

The HTML preload list in `vite.config.js` (`ashen-startup-preload`) is only the body GLB plus `forrest_ground_01` and `rock_wall_08`. Anything else in that list competes with the body on the first connection. The body fetch uses `priority: 'high'`.

## What waits until after the overlay

Started after `presentMs`, and finished before `ready`:

- Grass. `buildChurchyard` returns a `startFoliage()` instead of awaiting the atlas. The foliage meshes are pushed onto `world.meshes` before combat is created, because spell lights snapshot those materials once.
- Combat, enemies, townsfolk, the equipment stream and the armory. Their modules are `import()`ed at that point so they are not in the first script graph. Spell textures and the two fire-blast wavs download with combat, not with the overlay. Spell sprites are deferred builders. `registerScene` flushes that list once, before combat exists, so `main.js` calls `flushDeferredBuilders` after `createCombat`. Skip that and Pyre Burst keeps the ground disc and loses the geyser, sparks and pillars.
- The training dummy and `public/characters/base.glb` (one copy, shared by the shades).
- The Wayfarer tunic, trousers and boots. Their fetch starts at low priority only after the body bytes have arrived, so they do not share the first connection with the body. The body stays hidden until that outfit is on (`dressed`), which is what prevents the nude flash.

Orc and Undead body packs are not on this path. They download when the armory switches race.

Town hostiles stay on the existing `ASHEN.whenHostiles` promise. They are not required for `ready`.

## The body file

On 2026-09-21 the playable body was 8.95 MB. The mesh and the clips were already Meshopt-compressed, about 1.5 MB of payload. The rest was embedded images:

| Map | Was | Now |
| --- | --- | --- |
| Hair (RGBA) | 2048 PNG, 3470 KB | 1024 WebP, 98 KB |
| Body normal | 1024 PNG, 1290 KB | 512 PNG, 233 KB |
| Hair normal | 1024 PNG, 547 KB | 512 PNG, 262 KB |
| Albedo | 2048 JPEG, 569 KB | 1024 JPEG, 41 KB |
| Cloth | 1024 JPEG, 587 KB | 1024 JPEG, 158 KB |
| Roughness | 2048 PNG, 92 KB | 512 PNG, 13 KB |

The file written by that pass is 3.06 MB. `public/ashen-reach/equipment/manifest.json` records the new byte length and sha256 for the `body` item. The compress script updates that entry when it rewrites the file.

Those image buffer views are referenced. An earlier count treated them as unused Meshopt fallback and would have deleted the textures. Do not strip buffer views just because no accessor points at them; images point at them too.

### Why the hair map is WebP

The hair PNG has a transparent surround. JPEG, and `sips` resize, both composite that surround. The hairline UVs then read a silver band on the forehead. WebP keeps the alpha, and Lite decodes it with `createImageBitmap` from the image's mime type (`image/webp` is enough; no Basis transcoder). Normals and roughness stay PNG: JPEG chroma on a roughness/ORM map writes fake metal into the blue channel. Lossy WebP on the normal maps also collapsed them to a few kilobytes and was rejected for that reason.

### How to recompress

```
node scripts/ashen-reach/compress-startup-glbs.mjs body.glb
```

`compress-startup-glbs.mjs` resamples the body images with `sharp`, then writes the GLB back through Meshopt. It refuses the write if vertex counts change.

Do not call `reorder()` or `quantize()` on this file, or on Wayfarer trousers. Primitives share POSITION and JOINTS accessors; reordering those collapsed the meshes in the engine. The script's default for `body.glb` leaves both off.

Re-running the script on an already-shrunk body is safe: `putImage` skips a result that is not smaller. Re-running it on a freshly exported body with the original 2048 maps is how a new export gets back down to this size. A full `prepare-pyre-cast` or `prepare-wanderer` that rewrites `equipment/body.glb` from another source will put the large maps back. Run the compress script again afterwards and check the hairline in play, not only the file size.

Orc and Undead bodies were not part of this pass.

## What is still on the critical path

The overlay cannot drop before the skinned body exists, so an uncached visit still downloads that 3 MB, the Havok wasm (about 2 MB), the first script graph, and the churchyard images. The churchyard is also built on the main thread before the first frame, so `presentMs` on localhost is several seconds even when every file is already on disk. That number is CPU, not the network. A cold connection used to be dominated by the 9 MB body; that part is now the 3 MB file.

Getting closer to zero means a cheaper first scene (ground first, town geometry after) or a smaller body, not another preload of shades, the dummy, or the grass atlas. KTX2/Basis was not added: the transcoder is another wasm fetch, and the browser already decodes WebP and JPEG.

Reviewed after the recompress: [walk](https://ve.sparkify.dev/wow-clone/ashen-reach/startup/2026-09-21-body-textures.mp4).
