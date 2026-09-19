# Orc print sculpt (authoring source)

High-poly form reference for the from-scratch Orc body. This directory is **not** a runtime pack.

- **Form:** original FBX `Orc_22.fbx` (CC-BY 4.0, Crayon / Sketchfab `miao850520`).
- **Look:** Sword Hero night-churchyard (ashen peat-olive). The green concept PNG is heroic form only, not churchyard albedo.
- **Game mesh:** derived by `scripts/character-assets/orc_from_sculpt.py`, then assembled onto the 65-joint source bind. See [docs/orc-sculpt-pipeline.md](../../../../docs/orc-sculpt-pipeline.md).

Do not copy these binaries into `public/`. Do not join every mesh in the Sketchfab GLB — that file stacks several overlapping copies of the same sculpt (hence ~2.5M tris).

Credit required on anything derived from the sculpt; text is in `license.txt` and `provenance.json`.
