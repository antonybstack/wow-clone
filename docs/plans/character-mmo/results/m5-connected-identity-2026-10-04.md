# M5 connected Human source checkpoint — 2026-10-04

**Superseded art judgement:** the user subsequently rejected this audition's
face as disproportionate and jarring. Its mechanical checks remain evidence,
but neither the motion delivery nor green tests establish aesthetic acceptance.
See [the corrective plan](../face-refactor-2026-10-04.md). Current reproduction
tools now target the corrected face source; the hashes below identify this
historical, rejected version.

The connected young/bald, young/ponytail and older/bald Human sources are playable
through the existing Armory, equipment and Havok path on the explicit DEV route
`?humanIdentity=young|young-hair|old`. The source audition is reproducible and does
not change saved characters, capability flags, public assets or production.
**M5 remains open:** saved identity, selected compact startup, broader long-hair fit
and production/device acceptance are the next work packages.

## Implementation and source reuse

The starting plan incorrectly resumed a rejected separate-head neck cut. The
[October 1 source](identity-source-2026-10-01.md) already supplied a welded neck,
complete bald scalp and a separate CC0 MakeHuman ponytail. This pass reuses that
source, the original 65-joint bind, all 57 accepted animations, native Blender
BMesh/lattice/Cycles authoring and glTF Transform IO. No new skinning, animation,
material, equipment or character-storage system was introduced.

Eye morph targets now use the same ordered Head girth field as their sockets.
Discarded Blender channels and samplers are explicitly disposed before copying the
accepted curves; copied source nodes are disposed after target remapping. Native
accessor dedup and lossless Meshoptimizer compression then retain only the used
graph. The prepared older body fell from approximately 1.93 MB to 1.22 MB gzip;
this is cleanup, not an accepted first-play strategy. The released shape body is
still smaller at 991,320 gzip bytes.

The current fifteen-entry pack (body plus fourteen garments) replaces the obsolete
nine-item audition.
Native torso partitioning is independently checked after emission, including
attributes, skin, morphs, animation and triangle union. The manifest owns the
separate eyes as `head.face` and ponytail as `head.scalp`, so hood coverage hides
and restores hair through the existing resolver. The full/compact upgrade and
asset promises use the released lifecycle; temporary changes do not write storage.

Two defects needed actual live correction. A posterior torso-atlas hair mark
survived the original narrow nape mask; a bounded anatomical band now removes it
on both welded surfaces before the native colour bake. The full current hood
masked the younger eyes. Its per-head lattice/lining fit now measures the eye
height in the garment frame, forms an arch above the sockets and moves the lower
side curtain outward. These are authored garment changes; stills and motion were
recaptured after correction, without screenshot retouching.

Documentation links accompany the native APIs in source comments, including
[glTF morph targets](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#morph-targets),
[glTF Transform disposal](https://gltf-transform.dev/modules/core/classes/Property#dispose),
[copyToDocument](https://gltf-transform.dev/modules/functions/functions/copyToDocument),
[Meshoptimizer compression](https://gltf-transform.dev/modules/extensions/classes/EXTMeshoptCompression)
and [Vite DEV guards](https://vite.dev/guide/env-and-mode.html#env-variables).

## Reproduction and correctness

From a fresh checkout with the pinned authoring dependencies:

```sh
node scripts/character-assets/reproduce-human-identity-review.mjs
# Visit the existing Vite route with humanIdentity=old, young or young-hair.
```

The complete reproduction was run, not only the cache-reuse shortcut. Blender
5.2.1 LTS source generation, paint bake, current hood fitting and pack preparation
finished with matching tracked source hashes. `--reuse-source` verifies the same
pins before rebuilding hood/pack outputs. No production asset is overwritten.

[Source contract](../../../baselines/character-mmo/m5/head-2026-10-04/source-contract.json):
all three sources retain exact clip inputs, outputs, target names and interpolation;
unused accessor count is zero; node counts are 68/68/69. Across 855 posed samples
per source, neck split position/normal/morph-normal differences are zero, clip
duration difference is zero, and maximum palette-element difference is 1.59e-5.
Maximum eye-field error is 1.86e-9 m.

Different whole-body vertex counts do not imply that every garment needs a new fit.
The contract measures 2,617 physical clothing-surface samples below 1.46 m per
source: maximum position difference 1.16e-6 m, morph difference 2.39e-7 m and
skin-weight difference 1.20e-7. Existing torso/arm/leg fits were retained on that
evidence; the changed head/neck hood was authored separately.

[Current-fit matrix](../../../baselines/character-mmo/m5/head-2026-10-04/accepted-fits/report.json):
162 rows = three sources × neutral/short-stout/tall-slender × six outfits ×
front/side/back. Actual applied shape, coverage, body meshes and seeded-storage
preservation are asserted. All pass with Havok active, zero recoveries and no GPU,
console or page errors. The [final hood pass](../../../baselines/character-mmo/m5/head-2026-10-04/accepted-hood-final/report.json)
adds 27 rows after the final side-curtain correction and supersedes hood images
from the broader matrix. The parent reviewed the actual runtime stills, including
both eyes, rear collar and the painted nape.

Relevant verification passes: 166 character tests, 112 equipment tests, six startup
prefetch boundary tests and the production build. The production build contains
no connected-audition module, candidate asset or virtual DEV URL; public assets
remain unchanged. The small query exclusion in startup appearance selection is
intentional. [Production isolation](../../../baselines/character-mmo/m5/head-2026-10-04/production-isolation.json).

Independent Grok 4.6/high review found useful source/coverage/lifecycle gaps which
were implemented and checked. Its follow-up found no new consequential regressions
in the assigned diff. It did not review the final movie or grant production
acceptance. [Findings and parent disposition](../../../baselines/character-mmo/m5/head-2026-10-04/grok-disposition.md).

## Performance and delivery

Sampling uses one owned Chromium game context, M1 Max, 1280×720/DPR 1, seven
enemies, the same short-stout Lector loadout, three 12-second runs per representative
route, without recording, source generation or other owned renderers. All intervals
are preserved; nearest-rank tails are separate from the rolling HUD and cap hints.
[Summary and conditions](../../../baselines/character-mmo/m5/head-2026-10-04/fps-summary.json)
links the five complete raw reports, including confirmation runs.

| Five-route cohort | Route mean FPS range | Whole-cohort p95 / p99 | Worst interval | >16.67 ms |
| --- | --- | --- | --- | --- |
| Released body control | 214–248 | 5.8 / 7.9 ms | 13.6 ms | 0 / 41,537 |
| Older/bald candidate, first pass | 213–261 | 8.9 / 10.1 ms | 15.1 ms | 0 / 42,609 |
| Young/ponytail candidate | 214–246 | 5.7 / 6.0 ms | 13.4 ms | 0 / 41,302 |

The first older-body pass contains genuine 9–10 ms p95 tails on some routes. They
are retained and not labelled fixed. A back-to-back released/older repeat on meadow
and town gives older p95 **5.8–5.9 ms**: mean frame-time changes are **+0.82% meadow**
and **−3.69% town**; 15,549 candidate intervals have zero over 16.67 ms. That does
not establish a repeatable source regression. All candidate route means exceed 144
and the 120 FPS goal, but a mean is not a claim that every frame meets 6.94 ms.
Launch requests uncapped Chromium; one released-control and three young/ponytail
bridge windows trigger near-240 cap heuristics. They are included and labelled,
not silently discarded or presented as a verified hardware ceiling.

Final live motion uses older/bald at height 0.90/build +0.95 and young/ponytail at
height 1.15/build −0.95. Each includes front/side/back inspection, hood on/off,
eight native preview motions, then ordinary Havok walking, jumping and attacks.
The inspection fill/camera is explicitly diagnostic; the gameplay segment uses
normal controls. Both final captures have zero GPU/page errors and recoveries.
The earlier movie interrupted by Vite hot reload was discarded. Source, JavaScript
and assets were held fixed during the final recording.

Reviewed [live MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m5-connected-identity-2026-10-04.mp4)
is Telegram **850**. Source captures retain 742 older and 713 young/ponytail frames,
actual viewport/canvas/frame dimensions and timestamps. Timestamp-preserving VFR
encoding and lossless concatenation produce **1280×720, square pixels, zero rotation,
41.491415 s**. Telegram returned **1280×720 / 42 s**, within the delivery tolerance.
[Capture/encoding manifest](../../../baselines/character-mmo/m5/head-2026-10-04/delivery-manifest.json),
[sanitized Telegram receipt](../../../baselines/character-mmo/m5/head-2026-10-04/telegram-delivery.json)
and [playback review](../../../baselines/character-mmo/m5/head-2026-10-04/playback-review.json)
record the individual checks.

VE returns `video/mp4`, supports byte ranges (206/1,024 bytes) and plays/seeks at
1280×720 without distortion. Telegram Web A was reviewed inline at 737×414.5625,
in its expanded 1280×720 viewer, and in fullscreen with visible side letterboxing;
the picture retains 16:9. The standalone VE native-fullscreen control did not
activate and its native-app fallback lacked computer-use permissions, so **that
specific check remains unverified**. Telegram Desktop was not available and is not
claimed tested. This does not prevent recording the completed source checkpoint.

The owned slot-7 Chrome (PID 24526, port 10037) and Vite (parent PID 24451, port
5873) are stopped. The owned VE tab is closed; Telegram's bot viewer/chat playback
was ended with zero video elements left. User Edge/Telegram/YouTube and user Vite
5173/4000 remain. [Ownership receipt](../../../baselines/character-mmo/m5/head-2026-10-04/ownership.json).

## Remaining M5 gates

1. A new catalogue and explicit migration must represent named head/hair identities,
   with the current starter as an explicit supported choice. Prime/weathered are
   distinct authored head presets, not a continuous same-person ageing claim.
2. Selected immutable body/hood/component assets must appear before first play and
   survive save/reload, undo, rapid changes, failed loads and disposal. Current
   audition changes are deliberately temporary.
3. The candidate gzip body sizes are 1,219,217 older, 1,212,003 young and 1,511,987
   young/ponytail bytes. Default starter dependencies remain unchanged. Selected
   first-play compact preparation and twenty cold starts at 50 Mbit/s/40 ms have
   not passed a one-second gate for these sources.
4. Review long hair with independently selected shoulders and future cape garments;
   define the fixed tie and bounded colour policy. Skin and hair colours remain
   unavailable. Do not claim arbitrary combinable heads/hair or hair simulation.
5. Run save/first-frame, desktop mobile and WebKit identity acceptance before a
   production release. Physical-phone acceptance belongs to milestone 10.

New head/hair inputs are CC0 MakeHuman assets. Retained torso, rig and animation
retain their earlier documented rights limitation; the combined character is not
newly declared entirely CC0. The currently released game remains M7 source
`4063f49`, Pages `b3fdafd8-c343-4147-ae2e-760a155c8d06`.
