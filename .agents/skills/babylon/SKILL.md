---
name: babylon
description: Work with Babylon Lite, WebGPU and WGSL in the active Ashen Reach game. Use for Lite scenes, shaders, cameras, animation, effects, lighting and runtime debugging.
---

# Babylon Lite in the active game

The current product is **Ashen Reach at the repository root**, using `@babylonjs/lite`, WebGPU and Vite **5173**. Start with [current direction](../../../docs/CURRENT.md) and [the Lite workflow](../blender-lite/SKILL.md).

The previous skill described the separate root snow-demo engine. Duskwell is now under `archived/duskwell`; its Classic imports and procedural-only restrictions do not govern Ashen Reach.

- For Lite API and module questions, use the **`babylon-lite-docs` MCP** (`search_docs` → `read_doc` on `architecture/…` then `api/…`). Do not use Classic Babylon.js docs MCPs or `@babylonjs/core` TypeDoc. After the spec, confirm against this repo's installed `@babylonjs/lite` declarations and existing Ashen code; the MCP tracks npm `latest`, which can be newer than the game.
- Reuse the native animation mixer, billboard pools, sound engine, hand sockets and Havok collision world.
- Do not add `@babylonjs/core`, `beginAnimation`, `ImportMeshAsync` or Classic particle-system snippets. Official Babylon community examples may target a different engine; translate the idea only when Lite has the required API.
- The Ashen environment uses custom textured diffuse WGSL. Character/prop PBR and glTF are valid existing paths. Adding a point light does not automatically illuminate the custom world shader; it needs explicit uniforms. Concurrent effects need independent light inputs.
- Runtime WGSL examples are in `src/ashen-reach/materials.js` and `lava-ball-vfx.js`. Preserve required attributes, uniform declarations and scene registration order.
- Browser probes must import the exact optimized Vite/Lite module used by the game; duplicate raw imports can create separate caches/registries and misleading failures.
- Verify in the live browser, inspect errors, review captures and measure frame times at the reported resolution. Use [Dream Loop](../dream-loop/SKILL.md) for visual iteration.

If the user explicitly requests work on archived Duskwell, inspect its code and dependencies as a separate task; do not transplant either engine's API assumptions into the other.
