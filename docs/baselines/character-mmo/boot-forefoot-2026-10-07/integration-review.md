# Forefoot integration review — 2026-10-07

Read-only of `build-boot-sole.mjs`, `prepare-boot-sole.mjs`, `record-boot-fit-motion.mjs`, `boot-sole.json`, `duskguard-armor.json`, prior review, and cache candidate/integrated/audition artifacts. Decode proof: `integration-decode-proof.json`. Did not run prepare, tests, a game browser, or git. This is **not** native canonical acceptance or production proof. Private audition metadata is not a Pages release. Production startup hold, physical iPhone, and wider motion-camera limits stay open.

## Checks

Descriptor revision 2, SHA `45594ea7…836451fa`, pins and bounds hold (`minY===fullBelowM`, `fullFromY===fadeEndM`, `maxY` 80 mm, Z 0.10→0.14). Sole pass still runs first on the before-sole masters; forefoot then raises only when `height >` post-sole Y inside `forefootBlend`.

Decoded Human/Undead arrays:

- Candidate GLB SHA equals integrated GLB SHA (`dfce594f…` / `a2e61858…`), and those equal the prospective Duskguard underlayer pins in `duskguard-armor.json`.
- X/Z, indices, `TEXCOORD_0`, `JOINTS_0`, `WEIGHTS_0` match the pinned before-sole inputs.
- Every vert with `forefootBlend==0` matches the pinned sole-only Float32 Y (`84539c76…` / `d92d6e57…` in audition-dist). Sole band above 25 mm is untouched.
- No Y lowered versus that sole-only baseline. Raises: Human 174 verts, max 53.0 mm; Undead 52 verts, max 38.9 mm. Window has 384 verts; the rest already sit at or above the target (roof kept).
- No source X=0 verts. Factory rows in the integrated report: 65 joints, inverse binds exact.

`prepare-boot-sole.mjs` rebuilds twice, refuses publication unless the Duskguard pin SHA already equals the new boot bytes, publishes boots, then compiles greaves and asserts existing plate arrays and reviewed underlayer arrays. That preflight was not executed here.

Private idle stills of the three prior defect cameras show the deep vamp cavity lifted. Remaining leather pleats, cuff/strap overlap, and aliasing match root’s private note. Dark pixels are still not skin. Root owns native acceptance; this review does not.

## Defects

None consequential in the integrated builder or publisher wiring. Do not treat the inherited preview tree or this decode as production or FPS evidence.
