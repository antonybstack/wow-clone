# V11 lighting retrospective — 2026-09-24

The first step was to commit, push and deploy the V10 baseline: commit `8c550ef` on `main`, Cloudflare Pages deployment `372548bd`, at `https://play.sparkify.dev`. The recorded production smoke check confirmed readiness, Havok movement, valid WASM bytes, the V10 shadowed volume and no page errors. Establishing that baseline made the subsequent lighting work attributable and gave the release a known starting point.

V11 then joined surface, character and nearby fog shadowing around the same sun, while preserving V10's distant mountain occlusion. At this retrospective's evidence cutoff, V11 was implemented and verified locally, with reviewed motion delivered to Telegram; its release was the parent task's next step. This document does not assert a new commit, push or deployment. The next visual milestone after that release is ambient occlusion (AO).

This is a learning record assembled from [CURRENT](CURRENT.md), the [fully shadowed street plan](fully-shadowed-street-plan.md), the [architecture notes](sun-shadow-architecture.md), local implementation and saved reports, plus the implementation-session account supplied for this retrospective. No browser checks or captures were repeated to write it. The JavaScript/WGSL editing accident below comes from that session account; the final reports establish the corrected outcome, not a complete timestamped history of every failed attempt. No elapsed-time savings or exact number of wasted iterations has been measured.

## From V10 to a testable V11 target

V10 replaced the rejected artificial ground-origin rays with shadow-tested sunlight integrated through world-space fog. Its cached 2048 × 2048 map included terrain, mountains, opaque trees and buildings. The volume stopped at scene depth and used 48 steps at half resolution. That was a useful foundation, but it left an obvious lighting disagreement: the fog knew about sun occlusion while custom surface lighting and foliage transmission could remain lit. Animated actors were absent from the caster set, and a map fitted to the whole world could not provide detailed character silhouettes.

The V11 target was therefore concrete: in ordinary gameplay, buildings and trees should block the same sunlight for ground, foliage, the animated actor and nearby fog. The actor should cast a moving, skinned silhouette and cross a visible sun/shadow boundary. Ambient fill and lamps should remain readable. Distant ridge occlusion and the above-120-FPS goal had to survive the change.

The Babylon, Blender Lite and dream-loop guidance shaped the approach: inspect the current implementation, research the missing capability narrowly, reuse native skinning and shadow support, implement the playable slice, inspect live errors and motion, correct defects, and measure performance separately from recording. Existing movement, rigs and animation remained the basis of the demonstration.

## Research the installed engine before building the bridge

The implementation authority was installed `@babylonjs/lite` **1.28.0**, confirmed in its package metadata. The planning record cites official Lite feature and architecture documentation and records that the Lite docs MCP was unavailable. The decisive investigation was into installed declarations and source: CSM receiver access, cascade task scheduling, PCF task hooks, skeletal caster wrappers, material compilation and texture ownership. This matters because upstream documentation can describe a newer version, and Classic Babylon APIs do not establish Lite behavior.

The useful public interfaces were `getCsmReceiverTexture`, `onCsmReceiverUpdate`, shadow registration and caster membership APIs. Native cascaded shadow maps (CSM) already supplied camera fitting, stabilization and skeletal rendering. Custom world shaders still needed a receiver bridge. Private PCF task hooks and a CSM task-state reset became narrowly contained compatibility adaptations for this installed version; neither should be treated as a stable cross-version contract.

## The resulting architecture

The owning controller is [sun-shadows.js](../src/ashen-reach/sun-shadows.js). It coordinates two map systems with the same sun direction:

| Path | Purpose and refresh | Consumers |
| --- | --- | --- |
| Native near CSM | Three stabilized 2048 × 2048 depth-array layers, 180 view-space units, refreshed every frame for moving poses | Native PBR materials, custom world and foliage shaders, nearby fog |
| Isolated far PCF | One cached 2048 × 2048 world map, fitted to opaque world casters | Custom surfaces and fog outside near coverage |

The scene sun owns only the native cascades. The far map's directional-light object supplies its transform and stays outside `scene.lights`; its generator is not attached to the scene sun. Both use the established sun direction. The distant map remains static-world-only, and native physically based rendering (PBR) materials have no custom far-map fallback.

The controller exists before custom materials are constructed. Its public CSM callback copies the current receiver payload after Lite has calculated cascade transforms. Updating those matrices in the earlier gameplay callback would consume the preceding frame's data. Custom materials bind a comparison depth texture with a `2d-array` view and share `SUN_SHADOW_WGSL`. Cascade selection uses camera-view depth, blends over the final 10% of a cascade and transitions into the far map. Custom surfaces use a normal offset and a nine-sample comparison filter; native PBR uses Lite's own filtering.

Surface visibility attenuates direct solar light, solar rim light and foliage transmission. Ambient sky/ground fill, lamps, spell lights and emission remain independent. Grass and flowers receive shadows; their fine, wind-deformed alpha cards do not cast them in this milestone.

Opaque world batches use a cheap position-only, double-sided caster override. Animated characters retain native PBR caster views and their live skeleton palette. `enableSkeletonShadows(csm)` contributes live bounds for cascade fitting; it does not replace vertex skinning. Forced refresh keeps changing poses represented even when root transforms or bounds remain unchanged.

Dynamic membership scans visible PBR/Standard meshes so race replacements, streamed equipment and socket props can participate. Hidden parked bodies and garments are excluded through mesh visibility. This is not an actor-only allowlist: a future visible PBR effect would also qualify, so that assumption belongs in future review.

Fog consumes the same visibility function with a cheaper single comparison lookup per cascade sample. Its uniforms update at execution time after both shadow tasks, so it sees current matrices. The existing 48-step, half-resolution `rgba16float` integration ends at scene depth; a depth-aware composite applies extinction and scattering before bloom. This is still an interim composition path: undoing and reapplying the material grade cannot recover highlights already clipped upstream. Linear HDR composition remains separate work.

The final frame order is explicit:

```text
movement, animation state and caster membership
  → native CSM shadow task and receiver callback
  → isolated far PCF task and receiver matrix update
  → one scene color/depth draw
  → fog integration → fog composite → bloom/present
```

`createSceneContext(..., {defaultRenderTask: false})` removes the implicit scene draw. Both the post pipeline and `?noPost` add exactly one explicit color draw after the shadow tasks. Shadow registration is unconditional, so direct rendering retains surface shadows. Texture owner references, receiver references and deferred task disposal also have to agree; the controller is scoped to the full scene lifetime, not safe arbitrary hot replacement. The architecture notes document those upgrade-sensitive ownership details.

## Failures, corrections and wasted cycles

**Mixed PCF and CSM native-light bindings failed validation.** Keeping the broad map and cascades together in native scene-light discovery looked like a straightforward extension of V10. Native PBR instead encountered incompatible bind-group expectations in this integration. The correction was to keep only CSM on the actual scene sun and execute the far PCF generator through an isolated frame-graph task. The far texture wrapper also needed the depth sample type and underlying texture required by ShaderMaterial validation and ownership. The lesson is to prove mixed material/light compatibility early, before tuning visual parameters around an invalid pipeline. This is a Lite 1.28 project finding, not a claim about every engine version.

**Removing animated casters left ghost shadows.** Submitting a smaller caster list and forcing shadow refresh did not remove every skeletal draw. Investigation found that skeletal preloading replaced remembered source/wrapper arrays before incremental task removal, so removal could target an original mesh while the task retained its wrapper. Re-rendering that task simply rendered the stale member again.

The correction rebuilds cascade task state when membership changes: retain the old state, clear `csm._shadowTaskState`, submit the new caster list, and let native scheduling construct fresh tasks. Old tasks retire after a microtask and the queue's submitted-work completion fence, with disposal on either fence fulfillment or rejection. The shared generator/maps survive. This reset is for membership changes or explicit forced membership updates, not every animation frame. Repeated refresh experiments were wasted until the investigation moved from map freshness to task membership.

**Receiver flags set after compilation were insufficient.** A dynamic scan could report `receiveShadows = true` without rebuilding an already compiled native material pipeline. Receiver opt-in was moved into construction paths, including NPC bodies and shade garments, before their renderables compiled. Future late opt-ins need an explicit rebuild. Counting flags is useful evidence of configuration, but does not alone prove the pixels use the expected shader variant.

**JavaScript/WGSL template surgery inserted `return` into shader text.** The supplied implementation account records an accidental JavaScript return landing inside a WGSL template during editing. It was caught and corrected in the live renderer. JavaScript parsing or a successful bundle cannot validate shader source embedded in a string. Read the edited template boundaries, inspect the generated shader and compile it live immediately after this class of change. Fog's textual rewriting of shared WGSL is another reason to keep these edits narrow and inspect their output.

**Readiness alone could admit a bad recording.** `ASHEN.ready` establishes application startup, not clean GPU execution. Capture validation had to include page errors and console shader, pipeline, command and bind-group validation messages throughout the take. The recorder now collects those errors and fails a recording containing them. Checking this before encoding and reviewing a long clip avoids spending review cycles on invalid output.

**An implicit draw duplicated the explicit scene draw.** The frame graph needed an audit, not another lighting adjustment. Disabling the default render task and defining the scene draw explicitly gave each route one color draw after both maps were ready. Direct `?noPost` rendering received its own ordered pipeline and was checked separately. Removing duplicate work contributes a plausible explanation for improved throughput, but the recorded benchmark does not isolate its causal contribution from other changes.

**The first place to demonstrate the transition was constrained by the actual sun.** Hollowmere is largely in mountain shadow at the approved sun position. A street-only recording could therefore obscure the new boundary behavior. The final route starts on the sunny southern approach, walks through a natural tree/building shadow boundary, then cuts to Hollowmere street traversal. Keeping the sun fixed preserved the approved atmosphere and distant occlusion. The cut is part of the documented evidence, not a continuous walk between both locations.

These failures consumed integration, capture or review cycles, but the surviving records do not support a precise duration or retry count. The repeatable improvement is to settle binding compatibility, membership removal, compilation flags and frame order before polishing or recording the presentation.

## What was verified, and what each result means

The [street plan's results](fully-shadowed-street-plan.md#results) record passing build, spell-visibility/targeting tests and `git diff --check`, plus live direct rendering and full scene disposal without runtime/GPU errors. The saved near-shadow report is [v11-final-native-receivers/report.json](../ve-capture/ashen-reach/sun-shadows/v11-final-native-receivers/report.json).

| Recorded observation | Supported conclusion and limit |
| --- | --- |
| Actor caster removal changed **41 ground samples** | Dynamic actors affected the custom sun-visibility probe and removal cleared their contribution; this is a sample count, not 41 actors or complete pixel coverage. |
| **38 visible native receivers** enabled | The sampled native mesh set opted into shadow reception; this differs from the controller's custom-material receiver count and is not a native PBR pixel oracle. |
| Actual W input moved the actor **15.51 units** | The gameplay route exercised real movement; street occlusion toggle and portrait resize also passed with zero recorded errors. |
| Far regression matched **45/45 GPU/triangle-ray probes** | The retained far map agreed with an independent geometric oracle at those points; it does not validate near cascades or deformed actors. |
| Ridge removal relit **13 points**; restoration blocked **14** | The far map retained sensitivity to ridge caster membership. The report also records 4.90 units of movement, stable far cache during camera movement, portrait resize and zero errors. |

The far evidence is [v11-far-regression/report.json](../ve-capture/ashen-reach/volumetric/v11-far-regression/report.json). The probe's CPU reference captures its caster array at construction; deliberate GPU caster substitutions must account for that when interpreting comparisons. Neither oracle substitutes for reviewing animation, cascade transitions or material appearance in motion.

The separate [performance report](../ve-capture/ashen-reach/sun-shadows/v11-final-native-receivers/performance.json) retained **600 samples** on a Mac Studio in uncapped Chromium/WebGPU, at **1280 × 720 internal resolution and viewport**, DPR 1, with **seven enemies**, actual W movement and **no recording**. Chromium used `--disable-gpu-vsync --disable-frame-rate-limit`; the report has `vsyncCapped: false`.

| Metric | Recorded result |
| --- | --- |
| Mean throughput | **397.75 FPS** |
| Mean frame interval | **2.51 ms** |
| p95 / p99 | **4.70 / 7.70 ms** |
| Worst interval | **20.30 ms** |
| Intervals above 8.33 / 16.67 ms | **5 / 2** |
| Reported draw calls | **233** |

These are animation-frame intervals. GPU timing was disabled, with no GPU samples. The run supports average throughput above the 120-FPS goal under those conditions; it does not establish that every frame meets 8.33 ms, visible display pacing, mobile performance, higher-resolution performance or large-crowd behavior. Comparing it with V10's recorded 268.8 FPS is descriptive, not a controlled attribution of gains to one V11 change. The isolated benchmark slot was shut down afterward.

## Motion evidence and release boundary

The reviewed live [V11 MP4](../ve-capture/ashen-reach/sun-shadows/video-v11-final-2026-09-24/v11-street.mp4) was delivered through `tg file` as **Telegram message 743**. The encoded clip is **15.82 seconds**, **1280 × 720 at 60 FPS**, while the game rendered internally at **960 × 540** and fog integrated at **480 × 270**. Its [recording report](../ve-capture/ashen-reach/sun-shadows/video-v11-final-2026-09-24/recording.json) records 950 source frames over about 15.83 seconds, approximately 60.01 FPS, and an empty error list. Capture cadence and output dimensions must not be substituted for the uncapped benchmark or its internal resolution.

The implementation record says sunlit-path, moving-shadow, shade-transition and street-traversal frames were reviewed before delivery. This documentation pass records that review; it does not claim a fresh visual inspection. Telegram delivery establishes delivery of local motion evidence, not deployment. The ledger entry was made while HEAD was still `8c550ef`; the parent release must associate the existing clip with the finished V11 commit using `bash scripts/tg record <clip.mp4>` after committing. A public VE upload or a new production deployment is not established by the evidence cited here.

## Concrete checklist for the next lighting pass

1. Read CURRENT and the active milestone; identify the baseline commit/deployment and preserve unrelated checkout work. State one visible outcome and an ordinary gameplay route that can expose it.
2. Confirm the installed Lite version and inspect the exact source contracts being used. On an upgrade, recheck the isolated PCF bridge, skeletal membership reset, texture ownership and deferred disposal together.
3. Before visual tuning, prove one custom receiver, one native skinned receiver and the far-map consumer compile and render together. Set receiver flags before compilation; retain skinning in actor casters.
4. Exercise caster addition, removal, hidden meshes and equipment membership. Distinguish stale task draws from stale map contents. Confirm that restoration works as well as removal.
5. Audit the graph: current animation and transforms, near shadows, far shadows, one scene draw, then post effects. Check the direct route, initialization, resize and disposal as relevant.
6. After editing shader templates, inspect the resulting WGSL and live compilation errors immediately. Attach page/console error capture before navigation and retain it through recording; require more than readiness.
7. Use targeted probes for causality and saved live motion for appearance. Preserve the approved sun and label diagnostic toggles, camera staging and cuts. Review the actual boundary crossing before sending the clip.
8. Benchmark separately with recording off, a verified uncapped browser, explicit internal resolution/DPR, actor count and retained sample count. Report percentiles, worst frame and threshold overruns alongside average FPS.
9. Run relevant build/behavior checks, deliver reviewed motion through the authorized channel, and retain report paths. After release, record the finished commit against the clip and verify the deployed version separately before claiming production completion.

## Pending work

AO is the parent's next milestone after V11 release. Direct sunlight silhouettes do not provide ambient contact darkening under feet, in creases or where objects meet. Linear HDR composition also remains pending; the current fog composite cannot restore previously clipped light. Geometric lantern cones, fine alpha/wind foliage casting and temporal reconstruction remain separate graphics work.

Portrait resizing demonstrated layout/render-path behavior on the tested desktop browser. It did not establish mobile hardware performance, memory limits, thermal behavior or device recovery. The far map excludes animated actors, native PBR only receives near cascades, and the current visibility scan assumes mesh flags represent hidden state. Those are explicit boundaries for future testing and design, not completed features or measured guarantees.
