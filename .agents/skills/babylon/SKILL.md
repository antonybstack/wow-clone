---
name: babylon
description: Work with Babylon Lite, WebGPU and WGSL in the active lite-moonwell game. Use for Lite scenes, shaders, cameras, animation, effects, lighting and runtime debugging.
---

# Babylon Lite in the active game

The current product is **lite-moonwell / Ashen Reach**, using `@babylonjs/lite`, WebGPU and Vite **5180**. Start with [current direction](../../../lite-moonwell/docs/CURRENT.md) and [the Lite workflow](../blender-lite/SKILL.md).

The previous skill described the separate root snow-demo engine. Its Classic imports, procedural-only asset rules, no-PBR/no-glTF/no-Havok restrictions, port 5173 and SNOWFLOW globals do not govern this game and have been removed.

- Read the relevant installed Lite declarations and implementation before relying on an API. Reuse the native animation mixer, billboard pools, sound engine, hand sockets and Havok collision world.
- Do not add `@babylonjs/core`, `beginAnimation`, `ImportMeshAsync` or Classic particle-system snippets. Official Babylon community examples may target a different engine; translate the idea only when Lite has the required API.
- The Ashen environment uses custom textured diffuse WGSL. Character/prop PBR and glTF are valid existing paths. Adding a point light does not automatically illuminate the custom world shader; it needs explicit uniforms. Concurrent effects need independent light inputs.
- Runtime WGSL examples are in `lite-moonwell/src/ashen-reach/materials.js` and `lava-ball-vfx.js`. Preserve required attributes, uniform declarations and scene registration order.
- Browser probes must import the exact optimized Vite/Lite module used by the game; duplicate raw imports can create separate caches/registries and misleading failures.
- Verify in the live browser, inspect errors, review captures and measure frame times at the reported resolution. Use [Dream Loop](../dream-loop/SKILL.md) for visual iteration.

If the user explicitly returns to the root application, inspect its current code and dependencies as a separate task; do not transplant either engine's API assumptions into the other.
