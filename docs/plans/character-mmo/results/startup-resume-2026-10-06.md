# Startup diagnostics and priority checkpoint — 2026-10-06

Production remains `6004840` / Pages `e39117b8`. The five-priority goal is active;
this checkpoint does not complete it. See the [execution plan](../five-priorities-2026-10-06.md)
and [receipt](../../../baselines/character-mmo/startup-resume-2026-10-06/receipt.json).

## Verified diagnostic change

Startup errors now retain the resource URL, operation and native `Error.cause`.
Body decoding after HTTP 200 is distinguishable from request failure. Required
world geometry, surfaces, sky and manifest preparation use the same helper;
shared requests and explicit retry behavior remain unchanged. No automatic retry
or speculative transport fix was added.

All 29 focused tests and the flag-1 production build pass. The built game passes
four negative controls: character request abort, invalid gzip after HTTP 200,
near geometry abort and required surface texture abort. Each reaches the actual
failed loading overlay, names the resource, retains its native cause and stays
unplayable. Default and maximum saved appearances reach full-region readiness,
grounded Havok movement and advancing GPU frames without recorded errors. Three
entry aliases pass. Root reviewed the failed-loading and normal maximum-outfit
captures. These are functional checks, not timing or new visual acceptance.

Grok's independent source review finds no consequential request/cache/cause
defect. One minor diagnostic gap remains: the separate starter geometry size
check reports truncation without its URL wrapper. Record it for the next loader
change; it is outside the exercised fetch/decode failures and is not their fix.

## Bounded host comparison

The first production probe falsely rejected its older content-addressed body URL
because it used the current checkout's identity catalogue. Preserve that invalid
check; it is not a reproduced game failure. The probe now accepts and records the
hash of an explicitly pinned release catalogue.

Six new alternating visits use the correct catalogues, fresh browser processes,
disabled HTTP cache, 50 Mbit/s down/10 up/40 ms latency and native 1280×720/DPR 1.
Maximum-outfit playable times are:

| Host | Three diagnostic visits, ms |
|---|---|
| Production | 1,005.6 / 990.4 / 988.8 |
| Rejected candidate | 997.1 / 917.4 / 927.1 |

All are grounded, dressed and responsive without recorded errors. These visits
do not replace the failed release cohorts or establish a causal improvement.
The original intermittent fetch failure remains unreproduced and unresolved.
Keep the release hold; use the new context on the next actual failure.

## Offline experiments

No generated experiment asset is published. Native glTF Transform reorder
enlarges the bodies; selected maximum-outfit clothing savings are only 51,224
bytes. Native zero-tolerance animation resampling saves under 1,856 bytes per
body while changing source sample arrays. Both integrations are rejected.

Native Meshoptimizer exponential filtering of compact POSITION streams offers
82,440 bytes for the maximum outfit at 16 bits, about 13.2 ms of theoretical
transfer time at 50 Mbit/s. The maximum measured component error is 0.0306 mm;
the conservative shape bound is below 0.077 mm **in object space**. Other
attributes, rig, curves, textures and oriented triangles remain exact in the
written-file proof. This is not a posed-world/fit proof or measured startup gain.
18 bits saves 59,943 bytes with a smaller object-space bound. Keep these results
as an unpublished option; they do not justify another release cohort by themselves.

References: [Meshoptimizer encoder/filter](https://github.com/zeux/meshoptimizer/blob/v0.22/js/README.md#encoder),
[native reorder](https://gltf-transform.dev/modules/functions/functions/reorder),
[native resample](https://gltf-transform.dev/modules/functions/functions/resample),
[Error.cause](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause).

## Next work

Seek a material, measured startup improvement before repeating public gates.
Advance the independent Fieldcoat skinned-factory slice while startup remains
held. Release only accepted, sealed bytes after entry, startup, movement, mobile,
WebKit and isolated performance gates. Current physical iPhone acceptance is
unverified: the connected-device inventory contains only the Mac and simulators.
