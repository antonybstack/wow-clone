# Undead foot geoset compiler — independent review

2026-10-07. Compiler diff only. Public assets and mask/source fields unchanged; publication pending. Encoder registration is present. Parent reports 17 focused partition/manifest/Human native-foot cases passing. This review did not rerun them.

## Verdict

No remaining consequential defect in the compiler. `deriveHumanFootCore` is `deriveFootCore(doc,'human')`: same mesh-frame ankle, `>0.98` Foot/Toe mass, all-three-corner index split, `human-ankle-foot-v1`. Undead uses its own landmarks and `undead-ankle-foot-v1`. On accepted `equipment-undead/body.glb`, compiled sequential torso-then-foot keeps **8741** oriented triangles, shared attributes, 65-joint bind/frames/clips, and **659** foot triangles below native ankle (`ankleLimitY` 0.15162). Semantic adapter in `compileCoverageManifest` strips `foot` from `UndeadV1Body` and adds `UndeadFootCore: ['foot']`. Shipped coverage glb is still Body+Eyes+TorsoCore.

## Proof limits

- No Undead analogue of `native-foot-faces.json`. Human published bodies still have that winding+ulp gate; Undead tests prove union/bind and `coveredTriangles>0`.
- 373 remaining body triangles sit entirely below the ankle; 116 have all corners `y<0.05`, with min-corner Foot/Toe mass ≤0.976. That is the inherited 0.98 rule, not a Human classifier change. Root reports a live Wayfarer screenshot with toes hidden; this review did not open that capture. Duskguard, bare restoration, and Havok controls are still in the parent run.
- Live hide after publish still needs the compiled `coverage.bodySegments` to match `body.meshes` (`manifestBodyCoverage` → `equipment-stream`). Static `RACE_BODY_SEGMENTS.undead` and remote `prepared.json` still name the fused body. Do not treat this as a released fit.
