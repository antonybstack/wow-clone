# Babylon.js reference

Read this when you need official tooling, a Babylon.js 9 feature, or a playground/MCP workflow. The project contract stays in [SKILL.md](SKILL.md).

## MCP servers (node editors)

Package: `@babylonjs/mcp-servers`. Docs: https://doc.babylonjs.com/toolsAndResources/mcpServers/

These editors produce **NodeMaterial / node-graph assets**. This repo does not use those graphs. Use an MCP server only when the user asks to work in an official editor, or when you are exploring a stock Babylon feature outside this project's shader pipeline.

Dispatcher (preferred when the client accepts command arguments):

```sh
npx -y @babylonjs/mcp-servers nme
```

Direct binary (when the client wants an executable name):

```sh
npx -y -p @babylonjs/mcp-servers babylonjs-nme-mcp-server
```

| Editor | Dispatcher | Direct binary | URL |
|---|---|---|---|
| Node Material Editor | `nme` | `babylonjs-nme-mcp-server` | https://nme.babylonjs.com |
| Node Geometry Editor | `nge` | `babylonjs-nge-mcp-server` | https://nge.babylonjs.com |
| Node Render Graph Editor | `nrge` | `babylonjs-nrge-mcp-server` | https://nrge.babylonjs.com |
| Node Particle Editor | `npe` | `babylonjs-npe-mcp-server` | https://npe.babylonjs.com |
| GUI Editor | `gui` | `babylonjs-gui-mcp-server` | https://gui.babylonjs.com |
| Flow Graph Editor | `flow-graph` | `babylonjs-flow-graph-mcp-server` | https://flowgraph.babylonjs.com |
| Smart Filters Editor | `smart-filters` | `babylonjs-smart-filters-mcp-server` | https://sfe.babylonjs.com |

Cursor / VS Code `mcp.json` shape:

```json
{
  "servers": {
    "babylonjs-nme": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@babylonjs/mcp-servers", "nme"]
    }
  }
}
```

## Playground

- Search **code**, not titles: https://doc.babylonjs.com/playground/?q=thirdperson&type=code
- Saved snippets are `BABYLON.*` globals on a WebGL-friendly `Engine`. Translate before using here:
  - `BABYLON.Engine` → `WebGPUEngine` + `initAsync()`
  - `BABYLON.ShaderMaterial` + GLSL → `ShaderLanguage.WGSL` + `ShaderStore.ShadersStoreWGSL`
  - `from "@babylonjs/core"` → the deep subpath this file already uses
- Inspector (`scene.debugLayer`) is not wired in this repo. Prefer `SNOWFLOW` + the DOM overlay.

## Vite in this repo

Already set up. Do not follow the beginner Vite tutorial as if starting from scratch.

- `vite.config.js`: `target: "esnext"`, port 5173, `assetsInclude` for `.hdr` / `.env`
- WGSL is imported as `?raw` strings, then registered in `ShaderStore`
- Scripts: `npm run dev` / `npm run build` / `npm run preview`

Official guide (generic projects only): https://doc.babylonjs.com/guidedLearning/usingVite/

## Babylon.js 9.0 features

This project is on `@babylonjs/core` ^9. Release notes: https://github.com/BabylonJS/Babylon.js/releases/tag/9.0.0

Most of 9.0's stock systems **conflict** with the custom lighting / shadow / post / particle path here. Do not adopt them unless the user explicitly wants that stock feature.

| Feature | Doc | Use here? |
|---|---|---|
| Clustered lighting | https://aka.ms/babylon9CLDoc | No — spell lights are a 4-slot uniform pool |
| Textured area lights | https://aka.ms/babylon9TALDoc | No |
| Node Particle Editor | https://aka.ms/babylon9NPEDoc | No — `src/vfx/particles.js` |
| Particle flow maps / attractors | https://aka.ms/babylon9PartFMDoc | No |
| Volumetric lighting | https://aka.ms/babylon9vlDoc | No — atmosphere is custom WGSL |
| Frame Graph | https://aka.ms/babylon9FGDoc | No — `PostChain` + custom RTTs |
| Animation rendering | https://aka.ms/babylon9ARDoc | No — procedural pose in `figure.js` |
| Gaussian splats | https://aka.ms/babylon9GSDoc | Only if asked |
| Babylon.js Editor | https://aka.ms/babylon9EditorDoc | External tool |
| Inspector v2 | https://aka.ms/babylon9iv2Doc | Not wired; overlay covers tuning |
| Large world rendering | https://aka.ms/babylon9LWDoc | Clipmap already handles extent |
| Geospatial camera / 3D Tiles | https://aka.ms/babylon9GSCDoc | Unrelated |
| Physically based atmosphere | https://aka.ms/babylon9ATMDoc | No — `src/render/sky.js` |
| OpenPBR (alpha) | https://aka.ms/babylon9OPBRDoc | No PBR materials |
| Dynamic IBL shadows | https://aka.ms/babylon9IBLSDoc | No — custom CSM + PCSS |
| SDF text / outline / navmesh / audio / 3MF | release notes | Only if asked |

Announcement: https://babylonjs.medium.com/welcome-to-babylon-js-9-0-c3edc9ee6428

## WGSL vs GLSL

https://doc.babylonjs.com/setup/support/webGPU/webGPUWGSL

- Write WGSL. Babylon can transpile GLSL → WGSL via a WASM download; this repo does not want that cost or the extra failure mode.
- `ShaderMaterial` options must set `shaderLanguage: ShaderLanguage.WGSL`.
- Store code in `ShaderStore.ShadersStoreWGSL`, not `ShadersStore`.
- If you use a `color` vertex buffer, do **not** list `"color"` in the `attributes` array — Babylon adds it and a duplicate location errors.

## Useful starting docs

- Learning the docs: https://doc.babylonjs.com/journey/learningTheDocs/
- WebGPU: https://doc.babylonjs.com/setup/support/webGPU
- ShaderMaterial: https://doc.babylonjs.com/features/featuresDeepDive/materials/shaders/shaderMaterial
- Tools and resources: https://doc.babylonjs.com/toolsAndResources
- Community: https://www.babylonjs.com/community/
- Forum: https://forum.babylonjs.com/
