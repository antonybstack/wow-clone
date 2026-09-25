# Woodland geometry

Original seeded ash/oak forms generated with Daniel Greenheck's MIT-licensed
[EZ-Tree](https://github.com/dgreenheck/ez-tree), npm package 1.1.0.
Full license: LICENSE-EZ-TREE.txt. `npm run` is not required; regenerate with
`node scripts/ashen-reach/generate-woodland.mjs` from the repository root.

Three seeded branch-only variants, 1,240 triangles each, normalized to unit height.
No EZ-Tree textures are distributed. Runtime uses the existing Poly Haven bark.
Three.js and EZ-Tree are offline development dependencies only. Their browser
renderer and texture loader do not ship in Ashen Reach. The published npm build
does not expose the newer GitHub createGeometry/LOD API; reduction is configured
through sections and segments supported by the installed package.
