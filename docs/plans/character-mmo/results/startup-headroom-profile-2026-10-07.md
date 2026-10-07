# First-play headroom diagnosis — 2026-10-07

One instrumented maximum-outfit start against frozen **ac47654** lazy/prime
bytes. No product, asset, flag default or production deployment changed. Added
caller stacks only to the existing opt-in probe, outside the game bundle.
[Receipt](../../../baselines/character-mmo/startup-headroom-profile-2026-10-07/receipt.json).

## Result and limits

M1 Max, native Chromium WebGPU, 1280×720/DPR1, fresh process/profile, disabled HTTP
cache, decimal 50 Mbit/s down/10 up/40 ms. Shader-cache disable flag unset;
OS/driver caches uncontrolled. GPU instrumentation and Chrome tracing enabled:
**not an acceptance start or FPS measurement**.

Selected maximum appearance, all 22 compatible clips, grounded Havok, completed
dressed GPU frame and real keyboard movement pass. Playable **779.4 ms**, observed
input response upper bound **24.4 ms**, no recorded runtime/GPU errors. Root
inspected the native screenshot: selected hood, torso, skirt and shoulders present.
This unchanged visual needs no additional media delivery.

Preparatory submission 406.8 ms, queue callback 466.6 ms: elapsed **59.8 ms**.
Body installation begins 664.0 ms, dressed registration 711.9 ms. Preparation
finishes **245.3 ms before registration**. The retained public maximum miss's
210.9 ms registration wait does not reproduce. Do not repeat unchanged visits
until a tail appears or substitute this result for public cohorts.

Before play, 80 synchronous render-pipeline API calls are recorded. Caller stacks
distinguish native ShaderMaterial, PBR and post-process paths; labels identify
terrain, stone, bark, cloud, motes, shadow casters and post tasks. Chrome's GPU
service records actual labelled shader/pipeline creation during preparation.
Moss and burial earth pipeline creation takes 3.449 ms, with a nested 2.772 ms
Metal function event. These are CPU-side service events, not isolated GPU execution;
do not add nested events. The trace includes browser/compositor work, so unlabelled
events alone cannot be assigned to a game material.

## Next decision

Focus on work that delays **first play**. The retained default miss has 377.3 ms
document response start; the maximum miss waits for preparation. Those need
different attribution. Native shader work is demonstrated here, but moving it
would not automatically improve play: preparation is already overlapped. A future
async trial needs an actual delayed phase, native registration, selected appearance,
completed-frame/input checks and material gain before a new public cohort.

Reuse [Lite's pinned async pipeline API and scope](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/53-async-shader-pipeline-compilation.md).
It does not make all PBR/post pipelines asynchronous. Keep previous static CSM,
precision and transport trials closed without material evidence. Upstream
[real-pass timing/non-additive task envelope](https://github.com/BabylonJS/Babylon-Lite/pull/763)
and [unique query allocation](https://github.com/BabylonJS/Babylon-Lite/pull/764)
are a separate diagnostic follow-up. Installed Lite stays 1.31.1; no claim these
fixes reduce startup. Prior FPS uses native intervals, not summed GPU task times.

## Ownership and verification

Grok 4.6/high's eight-turn wrapper exits 1 at its cap before result prose. The
actual native probe exits **0**. Root validates report, trace, screenshot, stacks,
readiness and cleanup. Browser 65794, native probe 65793, preview 65772/7074 are
closed. Edge retains 12 nongame tabs; Orca has no embedded tabs. Reference playback
is restored (counts 0/1/1/0), temporary `__headroomProfileOct7` guards removed.
Final audit finds no owned game renderer, Grok worker or listeners 7074/10037/7081.

Raw files: `.cache/character-mmo/startup-headroom-profile-2026-10-07/`.
Tracked receipt preserves hashes, conditions, marks and exits. Probe syntax and
native output assertions pass. The five release priorities remain open as stated
in [CURRENT](../../../CURRENT.md); this diagnosis does not qualify production.
