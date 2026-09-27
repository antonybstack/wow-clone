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
