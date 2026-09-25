# V19 — frame-time spikes

## Result and retrospective

Unbounded observation reached 130 unacknowledged frames and 592.5 ms completion latency. Bounding submissions removed slow API calls across unrelated buffers. Chromium already flushes submit; the evidence supports queue/transport backpressure. See [Chromium queue](https://chromium.googlesource.com/chromium/src/+/refs/tags/153.0.8010.54/third_party/blink/renderer/modules/webgpu/gpu_queue.cc#117) and [ring buffer reclamation](https://chromium.googlesource.com/chromium/src/+/refs/tags/153.0.8010.54/gpu/command_buffer/client/ring_buffer.cc#44). The exact internal wait site was not traced.

Four pending frames, immediate completion wake and no empty RAF polling balanced throughput and latency. Two frames and a timer-based 180 FPS experiment performed poorly and were rejected. Production uses public Lite resizeEngine, renderFrame, waitForGpuIdle and scene disposal. Normal RAF remains below budget; visibility pauses and completion rejection stops/reports. Tests cover stale callbacks, out-of-order completion and reentrancy. Diagnostic experimental flags are retired explicitly.

Final separate non-recording traversal: Mac Studio M1 Max / 32 GB, Chromium 153 WebGPU, uncapped slot 7, 1280×720 viewport/internal, DPR 1, seven enemies, z=80 forward, 12 seconds. **3,031 rendered intervals: 252.53 FPS, mean 3.960 ms, p95 7.70 ms, p99 8.70 ms, worst 15.50 ms, zero over 16.67 ms.** Instrumented baseline: 260.31 FPS, p99 68.8 ms, worst 79.9 ms. Instrumentation differs, so this supports the controlled experiments rather than a universal percentage improvement. The report's uncappedLaunch:false flag reflects an unset reporting variable; slot 7 was launched with --uncapped and interval detection is uncapped. Full-window sampling now records actual renders rather than independent RAF callbacks.

Ordinary capped comparison: baseline and bounded-four both 60.00 FPS / p99 18.70 ms, with no slow API calls. The diagnosed regression reproduces under submission pressure; it does not establish the same stall on every 60 Hz device.

126 unit tests and build pass. Live tests pass movement, visibility pause/resume, terminal disposal, HDR scene disposal, injected iPhone depth fallback with native touch (28.97 units), desktop WebKit movement (17.66 units), and recorded town walking (15.43 units), without reported runtime/GPU errors. Physical iPhone performance remains unmeasured. Following work: V20–V22 in world-composition-plan.md.

User request: commit/push the current state, investigate and solve frame spikes, then analyze world composition/readability and implement a milestone plan autonomously. Initial worktree was clean; `617f421` was already pushed. Completed changes must be committed and pushed before session end.

## Investigation and acceptance

1. Instrument actual render intervals and slow WebGPU API calls on the established town traversal. Distinguish recorded frames from unused animation callbacks. Keep 1280×720, seven enemies, unchanged effects/maps and a separate non-recording run.
2. Test the strongest causal hypothesis, including controlled queue-completion/backpressure experiments. Preserve throughput above 120 FPS where measured; aim for p99 below 16.7 ms on this route. Do not hide frames, discard stalls or call an instrumented run a final benchmark.
3. Implement the smallest supported fix, with explicit lifecycle/error handling and unit/integration tests. Verify scene disposal, resizing, input, native animation, shadows, mobile depth fallback and WebKit.
4. Capture and review live motion, publish the reviewed MP4, commit/push. Then begin the world composition investigation and write its detailed milestones from fresh captures.

## Initial evidence

Instrumented baseline: 3,126 intervals over twelve seconds, 260.31 FPS, p99 68.8 ms, worst 79.9 ms. GPU queue writes block for roughly 60–70 ms across PBR uniform buffers, fog uniforms and instance buffers. 1,193,613 writeBuffer calls submit about 294 MB; 53 pipeline creations have no comparable synchronous stalls. This suggests a submission/transport pressure problem; further experiments must distinguish cause from correlation.

A two-frame pending-work limit removes the slow API calls (maximum measured render CPU time 4.7 ms), but only achieves 82.39 rendered FPS with p99 22.4 ms, so it is not an acceptable final policy.

Sources: installed Lite 1.28 engine/render paths; [WebGPU queue completion contract](https://gpuweb.github.io/gpuweb/#dom-gpuqueue-onsubmittedworkdone), [WebGPU explainer](https://gpuweb.github.io/gpuweb/explainer/). Runtime diagnostics: `scripts/ashen-reach/diagnose-frame-spikes.mjs`; ignored captures under `ve-capture/ashen-reach/v19`.
