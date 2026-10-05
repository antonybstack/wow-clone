# M5 compact saved identity startup — first checkpoint

Local implementation and reviewed motion are delivered. **M5 stays open and
unreleased.** Production remains M7 source `4063f49` / Pages
`b3fdafd8-c343-4147-ae2e-760a155c8d06`. This follows the
[saved integration](m5-saved-identity-2026-10-04.md); it does not establish the
one-second target or a new settled-performance result.

## Change and native tools

The fixed identity catalogue request begins alongside the optional identity module.
Early preload and main share one promise, with validation, failure invalidation and
retry retained. An unsaved or original-face boot never fetches this catalogue.
Storage selects bounded identifiers, never URLs.

Native glTF Transform dense accessor storage removes sparse index/value overhead
without changing a body vertex, normal, UV, skin weight, morph or any of the 57
source curves. Full and compact body descriptors remain identical. Accessor dedup
saved nothing and was not added. Compacting the tiny torso coverage primitive would
duplicate its already-shared attributes and was not added. Hair simplification
experiments remain unpublished.

Only the first-play fitted hood is reduced, through the same installed native
`simplify({ratio:.4,error:.002,lockBorder:true})` used for released clothing. Full
hood bytes stay unchanged and arrive through the existing equipment transaction.
The complete approved face is present at first play. Native remapping keeps skin
and morph streams together; no skinning replacement or animation retiming is added.
Implementation comments link [Accessor](https://gltf-transform.dev/modules/core/classes/Accessor),
[simplify](https://gltf-transform.dev/modules/functions/functions/simplify), and
[installed meshoptimizer 0.22](https://github.com/zeux/meshoptimizer/blob/v0.22/js/README.md).

| Preset | Previous body bytes | Lossless body bytes | Full hood bytes | Compact hood bytes |
| --- | ---: | ---: | ---: | ---: |
| Prime bald | 1,241,379 | 1,215,036 | 376,208 | 197,700 |
| Prime ponytail | 1,541,329 | 1,514,649 | 376,208 | 197,700 |
| Weathered bald | 1,246,743 | 1,220,349 | 379,232 | 199,577 |

These are actual encoded files. Young and Weathered compact hoods have 4,430 / 4,483
triangles. Independent edge analysis finds 239 / 234 full-hood boundary positions;
every indexed boundary vertex retains its exact POSITION, NORMAL, UV, JOINTS,
WEIGHTS and both morph records. Removing a required record deliberately fails the
comparison. Body/source fingerprints and the exact canonical 65-joint bind stay
guarded against approved inputs.

The independent [Grok review](../../../reviews/character-mmo/m5-compact-identity-startup-2026-10-04.md)
found missing cache policies for the new identity folder. Fixed: the mutable index
revalidates; hashed manifests, packs and textures are immutable. The existing release
verifier checks these response headers as well as bytes. This follows
[Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/).
Native local Wrangler Pages parses 22 rules and verifies **845 served artifacts**
and **17 identity cache policies**. Production CDN headers await release.

## Actual checks and motion

Character **195/195**, focused startup **14/14**, final build/provenance/eager-graph
guards pass. Four identity-startup tests are included in the character total.
Eight ordinary saved-route cases repeat against the build: first-play selection,
race return, choice/undo, queued/reset edits, HTTP/corrupt failure, retry and disposal.

The ordinary-route refinement check passes **11 cases**: three presets at neutral,
short/stout and tall/slender; a failed full-hood download; and an identity queued
while refinement is held. It asserts actual intercepted full URLs, selected body
and compact hood requests before play, native face meshes, saved recipe, outfit,
dyes, shape, Havok and no recoveries. Refinement retires the compact hood while
retaining the actual native body, group objects and paused clip times. Failed detail
leaves the compact actor visible; a queued identity commits afterward.

Three further live recordings show compact walk/jump/cast, refinement,
front/profile/back, full native motion, hair restoration and normal Havok controls.
Reviewed encoded frames and 18 compact/full profile crops retain the opening and
hood/shoulder fit. These are nine bounded fits with one large mixed outfit, not
acceptance of every outfit or every catalogue combination.

An earlier longer recording held an equipment request beyond its unchanged
15-second timeout. It failed refinement and retained the compact actor. Its log
is preserved. The final recorded hold is shorter; the runtime timeout was not
increased for recording. Successful live checks have zero page/GPU errors and
zero recovery teleports.

**Seven desktop mobile checks pass:** three presets each in Chromium 154 and
WebKit 26.6, plus the real injected Chromium depth-bundle fallback. Body editing,
dye editing, identity selection/persistence/independent undo and displayed movement
pass; Chromium also tests capture loss, cancellation, modal and blur recovery.
Viewport is 430×734 CSS, DPR 3; actual mobile buffer **322×550**. WebKit travel uses
keyboard because its automation supports touch taps only. These are functional
checks, not phone-performance or physical iPhone acceptance.

Reviewed motion is Telegram **853** /
[VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m5-compact-identity-2026-10-04.mp4).
H.264, 1280×720, square pixels, zero rotation, **50.329861 s** / 27,238,005 bytes.
Source elapsed time differs by −0.990 ms. Telegram returned matching metadata.
Actual Web inline is 737×414.5625; expanded viewer is 1280×720, both `contain`, with
live playback reviewed. Fullscreen control did not expose a DOM fullscreen element;
actual fullscreen and Telegram Desktop remain unverified. VE returns HTTP 200
`video/mp4`, 206 ranges, and actual direct playback advances with correct dimensions.
Native UI seek attempts did not succeed this pass; UI seeking remains unverified.

## Timing limit and next work

The user-owned World of Warcraft client (PID 92396) was active throughout, including
~35–195% CPU at sampled audits. It is preserved. **No settled FPS or 20-run startup
acceptance is measured under that contention.** Prior isolated numbers remain in
their original checkpoint and are not relabelled as this build.

One fresh-process 50 Mbit/s / 40 ms diagnostic retains its contaminated result:
**1,125.3 ms** playable, 4,289,887 encoded bytes at the boundary. This is neither a
cohort nor a clean comparison. It proves request ordering: catalogue starts at
348.7 ms and module at 348.8 ms, rather than waiting for the module response.
Selected body and hood start at 392.0 / 392.1 ms.

Next: continue the remaining selected-payload investigation with native tooling.
The full face, accepted source and curve pins stay fixed. Inspect animation/geometry
transfer and required first-play clips before choosing another compact representation;
do not assume the approximately 205 KB saving closes the target. A changed compact
body requires guarded native full-body/gear promotion preserving identity, phase,
shape, outfit, dyes, disposal and failure behavior. Run prescribed isolated
20-process cohorts and paired unhooded/Weathered/default route benchmarks when the
user game is gone. Finish current outfit and mixed-motion fits, then production
release/rollback gates. M6 follows M5 acceptance.

[Machine-readable checkpoint](../../../baselines/character-mmo/m5/compact-startup-2026-10-04/checkpoint.json)
links raw checks, manifests, cache verification, contaminated waterfall, captures
and motion proof. Ignored frames are under
`ve-capture/character-mmo/m5-compact-identity-2026-10-04/v3`; VE is the recovery URL.
Owned Chrome/CDP, Vite 5873, both preview lifetimes, native Pages workers, fresh cold
browser and Grok reviewer are stopped. Owned VE tab is closed; user Telegram viewer
is retained paused with zero playing videos. User Vites 5173/4000, WoW, other Grok
and research tabs remain intact. [Ownership](../../../baselines/character-mmo/m5/compact-startup-2026-10-04/ownership.md).
