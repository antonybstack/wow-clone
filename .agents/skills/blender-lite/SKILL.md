---
name: blender-lite
description: Babylon Lite game and asset workflow for Ashen Reach, including source-rig characters, Blender export boundaries, and live visual verification. Use for Lite scene, character, or GLB work.
---

# Babylon Lite and asset workflow

Start with [current direction](../../../docs/CURRENT.md). Active gameplay is **Ashen Reach**, `ashen-reach.html`, port **5173**, debug global **ASHEN**. The character lab and body preview are diagnostics. Duskwell is archived under `archived/duskwell`; its Classic Babylon rules do not apply to Ashen Reach.

## Runtime contract

- **@babylonjs/lite + WebGPU**, not `@babylonjs/core`, `beginAnimation`, `ImportMeshAsync`, or Classic particle systems.
- Reuse existing Havok movement, input and camera; physics owns translation/heading. New visuals should not silently change movement speeds or ground/jump policy.
- Use installed Lite APIs and the exact Vite module graph. In a browser probe, discover the transformed game's optimized Lite import URL, including its query. A second raw package import can create separate registries and false engine failures.
- Current equipped character is `public/ashen-reach/wanderer-equipment.glb`, built from `wanderer.glb`, the source-compatible Human with a 65-joint bind. See the [equipment authoring guide](../../../docs/ashen-equipment-authoring.md) before rebuilding garments. Native Lite animation/mixer and evaluated hand sockets drive it. Current clip selection and spell profiles live in `src/ashen-reach/main.js`.
- Use [character authoring notes](references/character-authoring.md) when changing skinning, motion or equipment. Keep original source curves/binds intact unless the task explicitly requires a new compatible asset contract. The playable Orc is the print-sculpt pipeline in [orc sculpt pipeline](../../../docs/orc-sculpt-pipeline.md): isolated Blender 5.2.1 LTS (not MCP 9876), collapse the FBX, bake HP normals, Mixamo 65-joint bind.
- Real game captures are the visual authority. Follow [Dream Loop](../dream-loop/SKILL.md); use the [browser/capture guide](../../../docs/debug-view.md).

## Choose the appropriate asset path

- Ashen scene layout/materials are in `src/ashen-reach/`. Do not run shrine export to update this scene.
- Reuse licensed assets/tools first. Generated textures, procedural low-poly scene/effect geometry and Blender-authored assets are all valid when they achieve the reference. No mandatory asset-service step.
- Character rebuild: `node scripts/ashen-reach/prepare-wanderer.mjs` from the repository root; this preserves the fitted source body and derives directional/cast clips. Read source/license provenance before regenerating inputs.
- A detailed body or garment requires credible geometry, UVs, skinning and bind compatibility. Do not pass a lathed cloak or socket-parented robe off as a finished skinned character.
- Author separate characters in an isolated Blender file/process. Do not clear or hijack the live shrine to make unrelated assets. Blender MCP **9876** is useful when the task needs it, not a prerequisite for shaders, motion reuse or spell work.

## Export boundaries

The old Moonwell shrine export commands were removed. Use the current equipment authoring guide and scripts declared in root `package.json`. Inspect the connected Blender file before any mutation and preserve unrelated open scenes. Blender Z-up to glTF Y-up is `(x,y,z) → (x,z,-y)`; let the established exporter own conversion.

## Verification and delivery

Play the active route after changes. Check body pose and actual input, inspect screenshot/video, and run relevant tests/build. Measure performance separately from recording, always stating render resolution and limitations. Use existing session authorization for Telegram; send reviewed evidence without leaking credentials or claiming monitoring after the turn ends.
