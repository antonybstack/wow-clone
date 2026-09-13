---
name: babylon
description: Guides Babylon.js 9 / WebGPU / WGSL work in this repo. Use when writing or debugging scenes, ShaderMaterials, cameras, character motion, lighting, shadows, post-process, or Vite + @babylonjs/core code; when the user mentions Babylon, Babylon.js, WebGPU, WGSL, playground, NME, inspector, or ShaderStore.
---

# Babylon.js

This repo (snowflow) uses Babylon as a **GPU/runtime shell**, not a stock renderer. Match existing code first. Reach for official docs and playgrounds only when this repo does not already have the pattern.

## This repo's contract

- **WebGPU only.** `WebGPUEngine` + `await engine.initAsync()`. No WebGL path.
- **JavaScript + JSDoc.** Do not add TypeScript files.
- **Deep ESM imports** from `@babylonjs/core/...` subpaths. Never `from "babylonjs"` or the `@babylonjs/core` barrel.
- **All visuals are custom WGSL** via `ShaderMaterial` + `ShaderLanguage.WGSL`.
- **No stock pipeline.** Do not add `DirectionalLight`, `ShadowGenerator`, `DepthRenderer`, `StandardMaterial`, `PBRMaterial`, NodeMaterial, Havok, `SceneLoader`, Inspector, or `@babylonjs/gui`.
- `@babylonjs/materials` is an unused dependency. Do not import it.
- Dev server: `npm run dev` — Vite on port **5173** (`strictPort: true`).

| Tempting | Use instead |
|---|---|
| `Engine` / `WebGLEngine` | `WebGPUEngine` |
| Barrel `@babylonjs/core` | Deep subpath (see below) |
| PBR / Standard / NodeMaterial | `ShaderMaterial` + WGSL |
| `ShadowGenerator` / `CascadedShadowGenerator` | `src/render/shadows.js` |
| `scene.enablePhysics()` | `src/character/controller.js` |
| glTF / `SceneLoader` | Procedural `VertexData` + `Mesh` |
| GLSL | `src/shaders/*.wgsl` imported `?raw` |

## Imports

```js
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3, Color4 } from "@babylonjs/core/Maths/math";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import { ShaderStore } from "@babylonjs/core/Engines/shaderStore";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
```

Copy existing side-effect imports when you need a prototype patch (e.g. `@babylonjs/core/Engines/AbstractEngine/abstractEngine.timeQuery`). Do not invent new ones.

## Shader workflow

`registerShaders()` in `src/shaders/registry.js` must run **before** any material is constructed.

1. Write `src/shaders/<name>.vertex.wgsl` and/or `<name>.fragment.wgsl`.
2. Shared code lives in `src/shaders/lib/` and is pulled in with `#include<snowXxx>` — do not copy lib text into a shader.
3. Register in `registry.js`:
   - includes → `ShaderStore.IncludesShadersStoreWGSL`
   - shaders → `ShaderStore.ShadersStoreWGSL` as `<name>VertexShader` / `<name>PixelShader`
4. Construct the material with the store name, not a file path:

```js
const mat = new ShaderMaterial("snow", scene, { vertex: "snow", fragment: "snow" }, {
    attributes: ["position"],
    uniforms: ["viewProjection", "cameraPos"],
    samplers: ["heightTex", "skyLUT"],
    shaderLanguage: ShaderLanguage.WGSL,
});
```

5. `await whenReady(mat, "label", [mesh])` from `src/core/gpuUtil.js` before first use. A material that never becomes ready is almost always a WGSL compile error — check the browser console.
6. If the mesh **displaces in the vertex shader**, register matching custom materials with `ShadowSystem.registerCaster` and `DepthPass.registerCaster`. A stock depth pass will draw a flat sheet.
7. Add `async warmUp()` that **actually draws** the mesh. `isReady()` compiles shader modules; the WebGPU render pipeline is keyed on blend/depth/cull/target formats and is only built on a real draw. Missing this causes a hitch the first time the effect appears.

`bakeOnce(proceduralTexture)` compiles then renders a bake pass once.

## Scene, camera, frame loop

Rendering groups: **0** sky, **1** opaque, **2** alpha (water, spray). Depth is **not** cleared between groups 1 and 2 — `scene.setRenderingAutoClearDepthStencil(1|2, false)`. Do not re-enable those clears.

Camera is `CameraRig` wrapping `UniversalCamera` with **no** `attachControl`. `rig.forward` / `rig.right` / `rig.up` are the source of truth for "forward" (spells, movement).

Do not reorder the frame loop in `src/main.js` without reading it. Current order: character → camera rig → post-process jitter → sky/shadows → spells → terrain → figure sync → wake → spray → `scene.render()` → `post.endFrame()`.

Post-process resolution chaining is inverted (pass *i* writes into pass *i+1*'s texture). Read the header in `src/post/postChain.js` before touching it. TAA jitter must run after the rig update; depth prepass and beauty pass both read `scene.getTransformMatrix()`.

## Allocation

Hot paths: module-scope scratch `Vector3`s and preallocated `Float32Array`s. No per-frame `new`. Use `bindMatrixArray` instead of `ShaderMaterial.setMatrices` (the latter allocates every call).

## Debug

`globalThis.SNOWFLOW` exposes `engine`, `scene`, `rig`, `terrain`, `sky`, `shadows`, `post`, `S`, and the other systems. Settings live in `src/core/settings.js` (`S` + `onChange`). Overlay is DOM (`src/ui/overlay.js`), not Babylon GUI. `F1` or `` ` `` toggles it.

When a visual change is in play, run `npm run dev` and look at the canvas. A compile that is green is not enough.

## Looking things up

When this repo does not already have the pattern:

1. Docs map: https://doc.babylonjs.com/journey/learningTheDocs/
2. Playground **code** search: `https://doc.babylonjs.com/playground/?q=QUERY&type=code` (example: `thirdperson`)
3. WebGPU / WGSL ShaderMaterial notes: https://doc.babylonjs.com/setup/support/webGPU/webGPUWGSL
4. Vite (already configured here): https://doc.babylonjs.com/guidedLearning/usingVite/
5. Tools index: https://doc.babylonjs.com/toolsAndResources
6. Community demos: https://www.babylonjs.com/community/

Do not paste Playground `BABYLON.*` globals or barrel imports into this repo. Translate to ESM subpaths and WGSL.

## Local third-person references

This repo already has `CameraRig` + `CharacterController`. Read those first. These external projects are useful for comparison, not as something to drop in:

- https://github.com/crazyramirez/BJS_Character_Controller_V2 — `~/dev/BJS_Character_Controller_V2`
- https://github.com/BarthPaleologue/ThirdPersonTemplate — `~/dev/ThirdPersonTemplate`

## More

MCP servers for the node editors, Babylon.js 9 feature index, and playground tips: [reference.md](reference.md)
