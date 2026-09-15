# Moonwell — Babylon Lite

Starter hamlet around the moonwell shrine. Babylon Lite (WebGPU). Chrome, Edge, Firefox, or Safari.

```bash
cd lite-moonwell
npm install
npm run dev
```

Open <http://localhost:5180>

Phone-clickable screenshots go to Cloudflare R2 (same bucket as fardel): `npm run ve -- ve-capture/foo.png foo.png` → https://ve.sparkify.dev/wow-clone/foo.png. See `ve-capture/README.md`.

## Character

The player **body** is Mixamo `public/characters/base.glb`. Gear is unskinned item GLBs parented to sockets (`public/characters/items/`, `src/character/catalog.js`) — plate look is item-quality, not `poc-a-plate.jpg`. `createRibbon` primitives are fallback only.

Architecture: **one skeleton + sockets + items**.

- `enableBoneControl()` once in `src/main.js` before the character `loadGltf`.
- Havok capsule in `src/player.js` is the collider. The glTF is parented to it; the capsule is hidden.
- Sockets copy Mixamo joint worlds onto helper TransformNodes (`src/character/sockets.js`). Gear is **not** a second skeleton.
- Default loadout: Void Cowl (head), Dusk Cape (back), Dusk Robe (torso), Nightstaff (mainHand), sleeves, boots, skin 1, height 1.0, Idle.
- HUD stance prints the live Mixamo clip (`Sprint_Loop` / `Walk_Loop` / `Jump_*`). S and Q/E do not fake sprint — there is no back/strafe clip.
- `C` paper-doll lists slots; click a slot or catalog row to cycle. `[` `]` height also resizes the Havok capsule. `P` tints `Alpha_Surface` only.
- A second Mixamo Idle stands in for `NpcGreeter`. `?crowd=8` is the L8 budget check.

## Play

Spawn at the well. Dirt path south to a straw **Training Dummy**. Hold **RMB** and **W** to sprint there (Shift+W walks). **Tab** to target it (Shift+Tab cycles back). **1–5** is the void bar. **B** / **C** are bag / character panes. **H** toggles the hint.

| | |
| --- | --- |
| `W` `S` | forward / back along facing |
| `A` `D` | turn (strafe while RMB is held) |
| `Q` `E` | strafe |
| `Space` | jump (~1.05 m apex; hold to hop again on landing) |
| **Right mouse** | hold to look — face the camera; A/D strafe |
| **Left mouse** | orbit without turning |
| Both buttons | run forward + look |
| Click (no drag) | select nearest hostile in front |
| `Shift` | walk (default is a run) |
| `=` / NumLock / MMB | autorun (`S` cancels) |
| Wheel | zoom |
| `Tab` / Shift+Tab | cycle hostiles (the dummy) |
| `Esc` | unlock pointer; then close a pane; then clear target |
| `1` | Crescent (instant) |
| `2` | Beam (hold to channel; release stops) |
| `3` | Eruption (instant) |
| `4` | Shards (instant) |
| `5` | Swirl (instant) |
| `[` `]` | height 0.90–1.15 |
| `P` | cycle skin |
| `N` | toggle helm |
| `U` | unequip helm |
| `B` | bag stub |
| `C` | character pane (paper-doll slots) |
| `H` | hint on/off |

Query overrides: `?h=1.1&skin=1`.

The shrine/hamlet is **`public/moonwell.glb`**. Do not pack the character into `moonwell.glb`. Physics is a hidden capsule.

The greeter is a Mixamo Idle instance at the old `NpcGreeter` pose (not a target). `DummyYard` is the pad under the dummy, not a unit. Tab only hostiles.

## Remaining debt

- Mixamo dummy + blockout item GLBs — not the painted `blender/ref/poc-a-plate.jpg` fidelity. Robe is a sack; forearms/hands still show dummy skin.
- No `WalkingBackwards` / `Strafe_*` clips in `base.glb` (HUD says so).
- Catalog has Void/Ash cowls and Night/Ember staves (`C` cycles). Cowl tint is subtle on wool; ember gem is the clear swap.
- `?crowd=8` is ~33 FPS (each NPC is a full `loadGltf`). Not a 60 FPS pass.
- `public/hero.glb` / `blender/hero-a.blend` remain on disk but are not the player body.

## Move / camera (implementation)

WoW third-person. Movement is Babylon Lite's Havok Physics V2 character controller (`createPhysicsCharacterController`) against shrine colliders — collide-and-slide only. Wish velocity is instant (no Havok `calculateMovement` easing). The camera is an `ArcRotateCamera` driven by our rig: **no** `attachControl`, inertia 0.

Blender must be open with **MCP for Blender → Connected on port 9876** for shrine export commands. Character work does **not** use `npm run export`.

## Iterate (Blender → Lite shrine)

```bash
npm run trees               # replace blob trees with Poly Haven photogrammetry trees, then export
npm run export              # live Blender scene → moonwell.glb + lights/camera sidecar (does not export the player)
npm run export -- --save-blend
npm run export:safe         # temporarily zero transmission (Lite PBR workaround)
npm run save                # write blender/moonwell.blend
npm run status              # ping Blender, scene, GLB mtime
npm run shot                # viewport still → .cache/blender-view.png
```

Geometry, UVs, and materials live in Blender. Light _positions/colors_ come from `public/moonwell-runtime.json` on export; intensities are tuned in `src/blender-runtime.js`. Area lights become Lite points. Hemisphere fill, IBL, and motion stay in `src/main.js`.

Do **not** `npm run export` while `hero-a.blend` is the live Blender scene (it would overwrite the hamlet).

Lite mapping notes: [docs/character-ve.md](docs/character-ve.md).

![screenshot](public/image-references/image.png)
