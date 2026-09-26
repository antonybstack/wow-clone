# F4 — Orc vertex-color cleanup (2026-09-26)

The Orc source candidate and playable body carried only opaque white `COLOR_0` values. They contributed no authored color variation; the existing albedo texture supplies the visible skin detail. The runtime previously suppressed the Orc color buffer through the private `_gpu.colorBuffer` field. F4 removes the redundant attributes in the offline assets and removes that runtime override.

| Asset | F3 bytes | F4 bytes | Removed |
| --- | ---: | ---: | --- |
| `public/characters/candidates/orc-source-v1.glb` | 8,011,632 | 7,896,932 | 2 primitive bindings and 2 accessors |
| `public/ashen-reach/equipment-orc/body.glb` | 8,634,436 | 8,519,660 | 7 primitive bindings and 2 shared accessors |

The source binder and equipment preparation both call `removeWhiteOrcColors()`. It rejects nonwhite or translucent values so later authored color cannot be silently stripped. The one-time application script updated shipped assets and their manifest/provenance hashes. Source SHA-256: `cf631fd423fecc0487c497255b89189e1298f55abc355b1ebdea43680e2f91d1`; body SHA-256: `25a24f13965a7e8c691f50aa210dcd2d6598c48aa82121b77efaa0637444c001`. The implementation follows the documented [glTF Transform `Primitive` API](https://gltf-transform.dev/modules/core/classes/Primitive) for offline attribute removal.

Focused color, F3 chest-hit, Orc streamed-asset and metadata-integrity tests pass. Character and equipment suites and the production build pass. Live Orc equipment checks pass across Wayfarer, Pilgrim and Graveweaver, spell damage, and gameplay movement. The sunlight probe found 41 actor-shadow samples, 15.47 m keyboard movement, 38 receiving meshes, portrait resizing and no runtime or GPU errors. Armory front and three-quarter screenshots show the Orc skin and outfits lit without color corruption. A [15.422-second timestamped live MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/lite1311-f4/2026-09-26-orc-color-motion.mp4) was reviewed at front, side and gameplay moments; its 1280×720 frames have square pixels and 16:9 display aspect. It shows Wayfarer and Graveweaver motion, equipment sockets, Orc gameplay movement and casting with no capture errors. VE served `video/mp4` with byte ranges, and Telegram message **776** returned matching dimensions and duration.
