# Woodland geometry

Original seeded ash/oak forms generated with Daniel Greenheck's MIT-licensed
[EZ-Tree](https://github.com/dgreenheck/ez-tree), npm package 1.1.0.
Full license: LICENSE-EZ-TREE.txt. `npm run` is not required; regenerate with
`node scripts/ashen-reach/generate-woodland.mjs` from the repository root.

Three seeded branch-only variants, 1,240 triangles each, normalized to unit height.
Each includes a `reduced` mesh derived from the same generated
branches. The complete stem stays intact; primary branches retain two sections,
secondary branches retain one, and terminal twigs are omitted. A bend that would
reverse a face retains an additional source ring: ash has 396 triangles, oak 388,
and wind-ash 394. Each retained
ring keeps its complete source cross-section. Reduced vertices,
normals, and bark UVs are selected from existing full-detail rings without
regenerating a tree or changing its normalization. Both meshes share the same
seeded shape and runtime placement. The three full-detail variants are unchanged
from release `c67765b`; frozen SHA-256 checks cover their complete JSON records.
No EZ-Tree textures are distributed. Runtime uses the existing Poly Haven bark.
Three.js and EZ-Tree are offline development dependencies only. Their browser
renderer and texture loader do not ship in Ashen Reach. The published npm build
does not expose the newer GitHub createGeometry/LOD API. The exporter observes
`generateBranch` calls without changing them, then selects source rings offline.
Run `node --test scripts/test-woodland-reduction.mjs` to verify original variant
hashes, exact source attributes, valid reduced topology, and reproducibility.
