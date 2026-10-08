# Closed policy review — authored bastion shield

2026-10-07. Read-only. Scope: `scripts/character-assets/prepare-authored-prop.mjs`, `scripts/test-authored-prop.mjs`, `blender/characters/props/bastion-shield.json`. `bastion-shield.glb` was not decoded.

**Verdict: one actionable defect, in the test file.** `verifyAuthoredProp` implements the stated gates on the source that was read. The hole / reversed-face controls never reach two of those gates.

## Defect

**Surface opposite-orientation and positive signed-volume predicates are unpinned.**

`verifyAuthoredProp` walks each primitive and then requires every exact-position welded edge `count===2` and `direction===0`, and `signedVolume>0` (`prepare-authored-prop.mjs` 65–83).

`scripts/test-authored-prop.mjs` 63–67 mutates the native first primitive only as:

- `indices.slice(3)` → `/surface is open/` via `count!==2`
- swap `indices[0]`/`indices[1]` → `/normal disagrees/` at the first-vertex cross test (line 72), before the edge map and volume sum run

No control produces `count===2` with `direction!==0` (two triangles on the same position-edge, same winding, first-vertex normals still agreeing). No control produces a closed group with inward winding and matching normals (`signedVolume<=0` with the normal test passing). Either conjunct can be removed from line 83 and both existing tests still pass.

Action: add two native-GLB mutations on a real group — (1) duplicate-winding neighbor on an existing edge after making that triangle’s first-vertex normal agree with the new cross; (2) reverse every triangle in that group and flip its normals — and assert `/surface is open or inward-facing/`.

## Rules that are present

| Rule | Evidence |
|---|---|
| Declared +Z / +Y grip | Descriptor `front:"+Z"`, `up:"+Y"`, `axis:"X"`, `origin:[0,0,0]`. `validatePropDescriptor` line 20. Test 69–70 mutates `front`/`up`. |
| Connected default scene / identity mesh | Lines 42–44: one mesh named `d.mesh`, one scene, default scene is that scene, one child node, that node owns the mesh, matrix within 1e-7 of identity. Test 30–32 `setTranslation([0,.1,0])` → `/grip frame/`. |
| Triangle agrees first-vertex normal | Line 72 uses `normals[a+k]` for `a=indices[i]*3`. |
| Per-material exact-position weld | Edge map is inside the primitive loop; key is `positions.slice(i*3,i*3+3).join(',')`; `count===2` and `direction===0`. |
| Positive signed volume | Per-primitive sum of `a·(ab×ac)/6`; `signedVolume<=0` refused. Mesh-total positivity follows. |
| No rig / clip / morph / external resource | JSON `extensionsUsed/Required`, `buffers[].uri`, `images`; graph skins, animations, textures, extensions; primitive `listTargets()`; semantics only POSITION/NORMAL. |
| Budget 2200 / 96KiB / 3 groups | Descriptor and validate: `triangles<=2200`, `bytes<=98304`, three distinct materials. Verify: actual bytes, triangle count, three named draw groups. |
| Tests mutate native GLB | `test-authored-prop.mjs` 8–11: `readFile('blender/characters/props/bastion-shield.glb')`, `readBinary` → edit → `writeBinary`. |
| One-joint skin | Lines 19–21: `createSkin(...).addJoint(createNode('foreign joint'))` on the mesh node; `/undeclared rig/` fires before the extra joint can look like a grip-frame failure. |
| Valid native translation clip | Lines 22–28: SCALAR times `[0,1]`, VEC3 `[0,0,0, 0,.1,0]`, buffer-backed sampler, `targetPath 'translation'` on the mesh node. |
| Descriptor identity | `id` `bastionShield`, `mesh` `BastionShield`, `slot` `offHand`, `deformation` `rigid-prop`, three materials, builder under `scripts/character-assets/`. |

## Limits

- Did not execute tests, hash the builder, spawn Blender, or parse `bastion-shield.glb` (chunk JSON, triangle counts, whether each material group is already a closed solid).
- Did not read `equipment-factory-contract.mjs` (`assertGlbContainer`, `PINNED_BLENDER`, `canonicalizeFactoryTriangles`) or `author-bastion-shield.py`.
- Did not review catalogue, runtime attach, capture, or performance.
- Grip +Z/+Y is a descriptor string plus identity node matrix. Vertex placement versus the declared origin is outside this gate (`remaining` in `prepareAuthoredProp` already names native fit/grip).
