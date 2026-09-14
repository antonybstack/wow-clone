# Moonwell — Babylon Lite

Standalone [Babylon Lite](https://doc.babylonjs.com/lite/01-getting-started/) demo of the Blender moonwell shrine.

Lite is WebGPU-only. Use a recent Chrome, Edge, Firefox, or Safari.

## Run

```bash
cd lite-moonwell
npm install
npm run dev
```

Open <http://localhost:5180>

WoW third-person controls. Movement is Babylon Lite's Havok Physics V2 character controller (`createPhysicsCharacterController`) against the shrine colliders — collide-and-slide only. Wish velocity is instant (no Havok `calculateMovement` easing). The camera is an `ArcRotateCamera` driven by our rig: **no** `attachControl`, inertia 0.

The playable figure is `public/hero.glb` (hooded mage, Blender-authored). Physics stays a hidden capsule; the glTF is cosmetic and faces with the controller. Staff-tip and boot ember lights live in `src/hero.js`. Run clips are in-place (16 frames @ 24 fps, `step=0.30`); the director plays them at ~2.05 Hz at 7 m/s. Stance travel is still shorter than ground speed, so a little skate remains — lengthening the authored stride enough to cancel it would blow the IK reach.

|                     |                                                   |
| ------------------- | ------------------------------------------------- |
| `W` `S`             | forward / back along facing                       |
| `A` `D`             | turn (strafe while RMB is held)                   |
| `Q` `E`             | strafe                                            |
| `Space`             | jump (~1.05 m apex; hold to hop again on landing) |
| **Right mouse**     | hold to look — face the camera; A/D strafe        |
| **Left mouse**      | orbit without turning                             |
| Both buttons        | run forward + look                                |
| `Shift`             | walk (default is a run)                           |
| `=` / NumLock / MMB | autorun (`S` cancels)                             |
| Wheel               | zoom                                              |

Blender must be open with **MCP for Blender → Connected on port 9876** for export commands.

## Iterate (Blender → Lite)

```bash
npm run trees               # replace blob trees with Poly Haven photogrammetry trees, then export
npm run export              # GLB + lights/camera sidecar → browser full-reloads
npm run export -- --save-blend
npm run export:safe         # temporarily zero transmission (Lite PBR workaround)
npm run save                # write blender/moonwell.blend
npm run status              # ping Blender, scene, GLB mtime
npm run shot                # viewport still → .cache/blender-view.png
```

Geometry, UVs, and materials live in Blender. Light _positions/colors_ come from `public/moonwell-runtime.json` on export; intensities are tuned in `src/blender-runtime.js`. Area lights become Lite points. Hemisphere fill, IBL, and motion stay in `src/main.js`.

![screenshot](public/image-references/image.png)
