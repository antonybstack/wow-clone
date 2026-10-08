# Independent review — boot strap 6 mm candidate

Reviewer: Grok 4.6/high, independent of implementation. No subagents, browsers, builds, tests, Telegram, or VE. Root owns visual acceptance.

## Scope

Offline art correction: move 856 authored ankle-strap vertices 6 mm in rest XZ around the native Foot joint. Leather shells, Y, UVs, weights, materials, and source 65-joint palettes stay exact. Files: `scripts/character-assets/build-boot-straps.mjs`, `blender/characters/wardrobe/boot-straps.json`, `scripts/character-assets/prepare-boot-sole.mjs` `--straps`, plus the post-failure `scripts/character-assets/triangle-index-contract.mjs`. Production and the native startup hold are out of scope.

## Findings

No material defects in the current math, bind/frame preservation, determinism, source pins, publication flags, or the Meshopt index allowance.

The first publication stop on Orc plate `deepEqual` indices was a compression representation mismatch. `assertTriangleRotations` (`triangle-index-contract.mjs:8-14`) allows only per-face cyclic rotation of the same three vertex ids, same buffer length, same face order, same winding. Reversed winding, swapped faces, a changed vertex, and a dropped duplicate are refused in `scripts/test-triangle-index-contract.mjs:23-25`. The native Meshopt control (`:15-21`) encodes the tracked uncompressed `orc-wayfarerBoots-before-straps.glb` with `encodeGltfBuffer(..., 'TRIANGLES')` and requires at least one rotated index so an already-compressed idempotent plate cannot pass silently.

`--straps` uses that helper at `prepare-boot-sole.mjs:76`, `:84`, and `:98-101`, while still requiring semantic arrays exact. The sole `--publish` path keeps `deepEqual`. Provenance records the Orc plate result honestly: `existingPlateArraysExact: false` with `existingPlateSemanticArraysExact`, `orderedWoundTrianglesExact`, and `encodedReadbackArraysAndTrianglesVerified` all true (`public/ashen-reach/boot-straps-provenance.json`). Human and Undead plates stayed index-byte-exact. `productionReleased` is false.

Builder pins and candidate bytes match across authored descriptor, before-straps masters, public canonical copies, hashed immutables, `pinned-verified/`, and `radial-6mm/`:

| race | sha256 |
| --- | --- |
| human | `52c5c2f6df2b0234f4920d08635556469167446ef18e913a38adc41416d3e680` |
| undead | `96df888598dd48ea09871a605d573a1538581225d690cb95a4f3bca646590da5` |
| orc | `e07c5fab32bc1a6403c4cd482b136e859d82b1d622a3af7f3667277b6bbfabf0` |

Descriptor sha `634c4345e3e0928ac4e9ed166d7699c0863e617953b81b6002b63e0edf4dbe02` matches `pinned-verified/report.json`. Duskguard underlayer pins in `duskguard-armor.json` match those hashes. Report rows: 214 vertices × 4 straps, `maxDisplacementM` ≈ 0.006, 65 joints, `worstPaletteDelta` 0, `inverseBindExact` true, `shellArraysExact` / `skinAndUvArraysExact` true. Orc input triangles are compared on a canonical copy (`build-boot-straps.mjs:60-64`); written indices follow the input (`:92`).

Native audition `report.json`: 10 cases, `errors: []`, `recoveries: 0`, `gpuErrors: []`, 65 bones. Equipped boots hide source foot cores; `audition/undead-bare-foot-restoration.png` shows Undead source feet with boots unequipped. Capture and encode wrappers exited 0 (`native-exits.json`, 1280×720 h264, 32.96 s). Stills: Human original/endpoints, Orc, Undead. Straps read as a slightly lifted ring; knot/cuff leather overlap remains. Duskguard plates and underlayers are present.

## Remaining limits

Root reviews the actual MP4. This review used stills and reports only.

Local `--publish --straps` now has canonical plus hashed wayfarer boots and duskguard greaves, matching manifests, coverage-manifest URL rewrites for those two items, and `boot-straps-provenance.json`. `prepare-boot-sole.mjs:58` still publishes boots before the duskguard compile (`:62`) and greave write (`:115`); that sequence is what left boots-only packs on the first Orc index stop. The helper unblocked the greave step. Human shapes, starter compacts, coverage geosets, identity equipment, native remote bounds, live canonical acceptance, and sealed release are still listed as remaining. No game QA or deploy in this evidence.

Ray/open-cuff inside counts are diagnostic. Authored source already overlaps. Bind-pose near-1 mm improvement in `radial-6mm-clearance.json` vs `baseline-clearance.json` does not prove zero clipping in motion. Residuals on the knot and cuff are inherited limits of this 6 mm XZ ring, not a new fitter or rig.

## Suggestions (not defects)

None that should gate root acceptance of this candidate.
