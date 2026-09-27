# Progressive startup evidence

See [implementation and release retrospective](../../one-second-startup-implementation-2026-09-27.md) for interpretation and limitations.

- `local-cold-20.json`: final Pages candidate, fresh Chrome processes/profiles, 50 Mbit/s / 40 ms, real grounded/dressed/GPU-completed playable boundary and subsequent input response.
- `local-native.json`, `local-slow.json`: three earlier geometry-equivalent candidate runs per profile; these are local preview measurements, not production.
- `candidate-fps.json`: 15 uncapped 12-second runs, five representative routes, seven enemies, M1 Max, 1280×720; before final parallel nearby-combat/lifetime changes, same completed render geometry.
- `candidate-region.json`, `candidate-cathedral.json`, `candidate-woodland.json`: normal-control return routes, woodland detail/shadow/disposal checks.
- `final-*.log`: final candidate live failure/retry, cancellation, early input/combat/race switching and compatibility checks. Expected injected failures are asserted separately from runtime/GPU errors.
- `world-container-*.json`: offline standard glTF Meshopt comparison; filtered variant is lossy. The unquantized variant preserves all attribute values and triangle winding, while the triangle codec cyclically rotates indices. Node decode timings do not predict Lite browser upload performance.
- `shadow-layout-probe.json`: controlled diagnostic of shadow vertex stride; not a release acceptance run.

Individual cold-run requests retain only selected measurement metadata. Browser/HTTP caches start empty; operating-system, DNS, CDN and GPU-driver caches are uncontrolled. Desktop mobile emulation is separate from physical iPhone acceptance.


Final production evidence (source `76e3c41`, Pages `72fd1e3d-7d8d-4108-8f0f-d8eb9a42cbfe`):

- `production-summary.json`: conditions, nearest-rank cold percentiles, full-window FPS aggregates.
- `production-cold-20.json`, `production-native-20.json`, `production-slow.json`: final fresh-process production navigations, respectively 50/40, unthrottled, and 10/80 profiles.
- `production-final-fps.json`: final exact-bundle 15-run uncapped matrix, separately from recording.
- `deployment.json`, `production-assets.json`: release identifier and 218 checked resources.
- `production-{mobile,webkit,play-matrix,cathedral,stairs}.log`: production functional verification.
- `production-motion-*`, `production-ve-playback.json`, `production-telegram.json`: live capture provenance and verified delivery (Telegram 786).

Earlier local and first/second/third/fourth production files preserve intermediate attempts, including misses and the unexplained 9.636-second first-GPU stall. They must not be substituted for the final series. Cold p95 uses the one-based `ceil(p × n)` observation; final fast-network success is 19/20, not all runs. No physical iPhone startup/memory claim is made.
