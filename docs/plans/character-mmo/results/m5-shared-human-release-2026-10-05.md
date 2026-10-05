# M5 shared Human coverage and creator release

Updated 2026-10-05. **Candidate deployed; M5 acceptance remains open.**
Native gates pass. Production functional checks pass, but public default startup
p95 is 1,018.7 ms against the 1,000 ms target.

## Resulting behavior

The catalogue v6 Human creator retains the original adventurer, Prime bald,
Prime ponytail and Weathered bald. Named identity, height/build, equipment and
dyes survive save/reload and are applied before first playable movement. The
approved head direction is preserved; these are authored presets rather than
a continuous age or facial-feature slider.

The original Human now shares the reviewed back coverage policy with the named
identities. It transfers 32 original back triangles into `HumanTorsoCore`.
The native boot control identified the pale toe/instep surfaces as the source
body. `HumanFootCore` transfers 448 original foot triangles into the existing
semantic `foot` segment: fitted boots hide them; bare feet restore them.
This does not repaint feet or inflate the boot sole. Original triangle union,
vertices, morphs, skin, 65-joint bind and full 57 / compact 22 source curves
remain verified. Clothing hashes are unchanged.

Coverage, shaped/startup/identity bodies and the affected remote/region actors
were generated and published through their existing owners. The remote
publisher now refuses stale source-manifest provenance before writing output.
Old valid immutable remote URLs are retained. The region descriptor and its
immutable cache header rotate together; mutable manifest indices revalidate.

## Grounding correction

The production downward correction used analytic terrain height underneath
bridges, slabs and galleries. It sank the player through elevated collision.
The native production control stalled below the bridge near z166.425 and failed
the first west-tower ascent.

The first repair used a short foot ray. It passed the bridge and four contact
fixtures, but sank inside a thin tower landing on descent. A native diagnostic
proved that Havok reports the landing underside with an upward normal when a
ray starts inside the closed collision mesh.

The final repair reuses Lite's native `shapeCast` with one owned 1 cm sphere,
preallocated query positions and `ignoreBody` for the player controller.
It casts from the actual capsule midpoint down to 28 cm below the feet, reads
the contact point on the collided body, and lowers only a grounded, non-jumping
capsule above a finite walkable surface. Initial overlap, a hit above the feet,
or one outside the correction range leaves penetration resolution to Havok.
The 8 mm tolerance and 1.2 m/s limit remain. Physics disposal releases the query
sphere exactly once, including headless actors. Source comments reference the
[pinned Lite physics documentation](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/42-physics.md).

A native WASM regression reproduces the underside ray and checks the midpoint
sweep at 1mm, 100mm and the observed 273mm penetration, valid clearance, initial
overlap and ignored-body behavior. Character tests 221/221, equipment 113/113
and focused ground/physics lifetime tests 14/14 pass.

## Evidence and release gates

[Bounded baseline and measurement receipt](../../../baselines/character-mmo/m5/shared-fit-2026-10-05/release-measurements.json)
contains the exact conditions and measurements. Reviewed native PNGs and the
picked-foot/back topology fixtures live beside it. Full raw run reports,
failed controls and timestamped source frames remain in
`.cache/character-mmo/m5-moving-fit-2026-10-05` and
`ve-capture/character-mmo/m5`; they are not substituted for live motion.

The pre-final grounding and completion-driven timing receipts are preserved as
historical controls. They are not attributed to this release. Fixture placement
occurs only before routes; successful movement uses ordinary controls, Havok
and zero recovery teleports. Final traversal starts before the bridge, checks
feet against its actual deck and returns across the complete bridge. Tower,
chapel, gallery and parapet checks assert both outbound and return levels.

The final RAF-paced native Pages build passes all five cathedral routes, four
contact fixtures, 18 height routes, eight saved identity cases, eight mobile,
eight injected depth-fallback and four desktop WebKit checks. Standing contact
has zero jitter; walking/landing clearance is approximately 5–15 mm. Character
221/221, equipment 113/113, ground/physics lifetime 14/14, scheduler 14/14 and
build-seal 4/4 pass. Failed and cancelled boot swaps retain their prior passing
same-asset transaction evidence.

The scheduler previously rendered directly from GPU completion once its
four-slot budget filled: standard Chrome submitted 731 frames during 180 native
animation-frame callbacks. Completion now requests one RAF; it cannot render
directly. Tests explicitly reject acknowledgement-driven renders. Standard
Chrome now counts 180 callbacks / 180 renders and correctly detects its 60 Hz
control: 720 frames over 12 seconds, below the 722-frame boundary ceiling.
An uncapped native diagnostic counts 628 callbacks / 569 admitted renders;
backpressure can skip callbacks. Source comments reference
[requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).

Final local startup uses 20 fresh processes per profile, HTTP cache disabled,
50 Mbit/s download / 10 Mbit/s upload / 40 ms latency, native 1280×720 / DPR 1:

| Profile | p95 | Maximum | Misses over 1 second |
| --- | ---: | ---: | ---: |
| Default | 840.5 ms | 849.2 ms | 0 |
| Original largest dyed | 951.7 ms | 961.5 ms | 0 |
| Prime bald | 827.6 ms | 828.1 ms | 0 |
| Prime ponytail, hooded | 986.3 ms | 993.2 ms | 0 |
| Weathered bald | 934.8 ms | 940.0 ms | 0 |
| Prime ponytail, open | 952.5 ms | 954.5 ms | 0 |

All 45 native route runs exceed 144 FPS: **210.4–248.6 FPS**, maximum p99
**6.1 ms**, worst interval **11.6 ms**, with no frame above 16.667ms. Conditions:
M1 Max, one tracked uncapped Chromium WebGPU renderer, 1280×720, seven enemies,
no recording/profiling, three 12-second runs per meadow/town/bridge/cathedral/
forest route for original-largest and hooded/open ponytail appearances.
These are throughput measurements, not monitor refresh or MMO crowd acceptance.

Eleven **unchanged detector hints** remain in the data. The strict first
collector completed all 15 original rows but exited 1 on forest3's possible-240
hint at 235.85 FPS. It was not rerun. Independent launch controls, native callback
counts and a calibrated 60 Hz control exclude the prior scheduler defect. Each
hinted cohort also has its own row exceeding the inferred hard ceiling by at
least 1%. All hints and the collector failure remain recorded with their
falsifying row; thresholds and render quality were not relaxed. The remaining
two cohorts were each collected once with hints retained. See
[the pacing procedure](../../../debug-view.md#measure-above-the-headless-chrome-60-fps-cap).

OS, GPU-driver and CDN caches are uncontrolled. The older first-use GPU outliers
remain limitations, not discarded samples. Public startup, Telegram delivery and production acceptance are still pending.

## Final native motion

Reviewed source frames and direct VE live playback cover original back/boot
coverage, tall/slender Prime ponytail and short/stout Weathered, bare-foot
restoration, and bridge approach/nave entry/exit. Normal Havok travel and native
Armory pose previews are labelled separately. Full bridge return is verified
after recording. Both viewport **and canvas** are 1280×720 / DPR 1; MP4s preserve
capture timestamps, square pixels and zero rotation. The first automatically
scaled capture is retained as a 960×540-canvas diagnostic, not native evidence.

- [Creator / shared fit, 31.55 seconds](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m5-creators-native-raf-2026-10-05-cee42f2c6210.mp4)
- [Bridge / nave, 42.75 seconds](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m5-bridge-native-raf-2026-10-05-065f728ccb6c.mp4)

Published bytes match each local SHA-256; both responses are `video/mp4` and
support verified range requests (206). Direct VE playback retains proportions
at 1280×720 and a 2514×1275 full-window container using `object-fit: contain`.
Telegram delivery/inline/expanded playback is pending. Native OS fullscreen
and Telegram Desktop remain unavailable. Clip performance is not a benchmark.

## Deployment and limits

Source **99acaba9e03661d5ab3208669c67d4efbf90668c** is committed and pushed.
Pages **6272e037-01ea-4e8c-963e-5a2313564891** publishes the exact locally gated
520-file dist (519 served files), without rebuilding. The seal digest is
`33207c2c23ee7d8758a773d5b9784028ba5751f13a7f96d6cf26d71680867934`;
product-input fingerprint is
`9aa3a4e2da09fafe525c212787fd87df0251200eb17401fd1c6ce37c25673274`.
All public served-byte/cache checks and the versioned Havok binary match.
The subsequent functional production checks pass; public startup remains open.
Previous production for rollback is
`b3fdafd8-c343-4147-ae2e-760a155c8d06` / source `4063f49`.
The sealed upload must publish the exact gated bytes without rebuilding.

Physical iPhone startup/thermal/memory acceptance remains separate from desktop
emulation and WebKit. Telegram Desktop is unavailable. Native-sized MP4s are
delivered as Telegram 859/860; matching returned dimensions and Web A inline,
expanded and fullscreen playback were reviewed, alongside direct VE playback.
The authored boot sole silhouette remains a follow-up art choice: the controls
proved exposed body faces, not a sole penetration defect. Sampling speckles
remain a documented aliasing limitation. No blanket standoff, new anti-aliasing
system or unverified sole edit is included. The structural equipment factory
is the next conditional milestone after this release is accepted.

## Public startup blocker after 99acaba deployment

All 519 public artifacts/cache policies, complete bridge return, west bell-tower
ascent/return, saved identities, mobile, injected depth fallback and Weathered
WebKit pass. The first public default cache-disabled cohort retains all 20 rows:
p95 1,018.7 ms, median 956.8 ms, maximum 1,620.9 ms; misses are run 1 (1,620.9),
run 14 (1,000.9) and run 16 (1,018.7). No validation/runtime failures.
Header-only source d44ecb7 / Pages 7c31855d-8af9-40e2-8b64-4ed9fe1df818
also retains all failed public rows: original-largest p95 1,099.3 ms / maximum
1,107.8 ms / 19 misses, hooded ponytail p95 1,149.7 ms / maximum 2,392 ms /
20 misses. No source quality or playable boundary was changed.

The first row's GPU completion costs 775 ms; later startup overhead is before
world loading finishes. Pages currently sends a decoder-only 103. Its automatic
Link extraction skips our crossorigin/fetchpriority tags. Explicit build-derived
response headers are under investigation. Chromium's disabled-cache condition
does not use Early Hints, so an HTTP 103 alone is not proof of improved acceptance.
See [Pages Early Hints](https://developers.cloudflare.com/pages/configuration/early-hints/)
and [Chrome Early Hints](https://developer.chrome.com/docs/web-platform/early-hints).

## Follow-up: existing clip compaction and native saved discovery

Default and shaped-original first-play bodies now use the same 22-clip compactor
as named identities. The default encoded body is 471,314 bytes (was 873,849),
and shaped original is 588,749 (was 991,365). The full 57-clip source and every
pre-existing shape/identity binary remain byte-identical. Independent geometry,
rig, morph, coverage and exact playable-curve checks pass; no new animation
loader, fitting system or lower-detail body is introduced.

The generated HTML preloads the two small optional saved-appearance module
graphs and fixed identity index when any existing save key is present. It shares
pure gate constants with runtime, never decodes saves or accepts asset URLs from
storage, and retains existing migration/provenance checks and promise reuse.
See [native modulepreload](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/modulepreload).
Original saves may discover that small unused index; the live check prohibits
selected identity binaries and incorrect head rendering instead. Empty/denied
storage skips discovery; corrupt records retain the ordinary safe fallback.

All 120 isolated local starts pass (six prescribed 20-run cohorts): p95 837.5,
917.6, 859.2, 984.7, 973.9 and 952.1 ms for default, original-largest, Prime bald,
hooded ponytail, Weathered and open ponytail respectively; maximum 996.3 ms.
The first hood cohort was contaminated by Telegram autoplay and is retained
under `startup-compact-preload`, invalid for performance acceptance. No source
changed before the isolated cohort. Modules/index load once; eight existing
world texture preload/fetch pairs remain and are not caused by this change.

Final character 221/221, equipment 113/113, focused clip/coverage 55/55 and
preload/header/fetch/identity 23/23 pass. All 521 native served artifacts match.
Five cathedral routes, four support fixtures, 18 height routes, eight saved
transactions, mobile/depth/WebKit and live corrupt-save/denied-storage fallbacks
pass with Havok and no recoveries. The adversarial read-only review found no
current compaction defect; it identified a future compact-proof-row guard gap
in the standalone coverage verifier. Record that follow-up without claiming it
has been implemented. Affected original-largest FPS passes all 15 runs at 210.4–248.1 FPS, maximum
p99 6.2 ms and worst 9.6 ms, without cap hints. Thirty named-character rows are
reused with exact asset/dependency equivalence. Public cold confirmation still
owns release acceptance; the hood body remains the measured transfer bottleneck.
The follow-up seal is `f86cd4d2b3a5e350bea9da306afbdb912adce3c9f3c3e402a0634dde8dc75c7a`;
522 dist files / 521 served / 288,560,563 bytes. The helper-only correction after
the initial seal changes no served byte. See `startupFollowup` in the measurement
receipt for the exact build, gate paths, digests and retained failure dispositions.
