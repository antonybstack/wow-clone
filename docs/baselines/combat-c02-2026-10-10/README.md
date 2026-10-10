# C02 live scheduler integration

Source: `4769e18` plus the C02 implementation committed with this receipt. Root native Playwright checks on owned slot8 Chrome45113/Vite45088/CDP10137/5973,1280×720/DPR1,WebGPU/Havok. Seven checks pass, no page/console/GPU errors.

- Developer render1280 control and scenario start use actual UI. Starting rehearsal intentionally closes menu.
- Repress Fire: one cast/hit, dummy1880, mana80.
- Lava reserves40 while mana100; changing selected target retains original dummy for240 damage, then mana60.
- First Escape cancels/refunds and keepsGCD without opening menu; second opens menu.
- Fire queued during final~200ms of Lava executes before Lava recovery ends: dummy1640, mana40.
- Menu clears cast/queue, resume does not replay.
- Queue setting400ms survives actualreload.

Earlier helper attempts are retained: one expected Back/Resume after scenario already closed the menu; one read queue before the next simulation update. Corrected helper waits for actual acceptance. These were fixture failures; no product code changed between attempts.

21 scheduler/trace/presentation-boundary tests pass; build passes. The unconnected VFX prototype adds19 separate tests. No new FPS claim. Full native100-action chain, pointer-lock-specific Escape, blur/death soak and live motion delivery of integrated gameplay remain C03/C12 acceptance work. Native checks do not establish visual acceptance. C01 before-change motion was delivered in Telegram913 with matching1280×720/62.937s; VE bytes/MIME/range/play/seek pass.

Grok setup pass hit18 turns before running checks. Root reused its owned harness and ran the prepared check. All native-check contexts are closed; harness currently retained for the root C03 pass and must be stopped at handoff.
