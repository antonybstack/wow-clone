# C05 — Sustainable combat and Ashen Brand

Implementation verified locally; release measurements and delivery are in progress. Production remains unchanged.

The first four slots are Fire Blast (free, 60 damage, 30 m), Lava Ball (12 mana,
140 damage, 30 m), Pyre Burst (20 mana, 90 damage, 8 s cooldown), and Ashen Brand
(8 mana, 12 s, six 15-damage ticks every 2 s). Combat mana regenerates at 6/s;
outside combat it remains 4/s. Lava retains its 3 s personal cooldown until C06
introduces independent projectiles. Damage/kill ownership is shared across player
melee, spells, burns and incoming shade contacts. Actor generations invalidate
old damage across reset, recovery and respawn.

Press 4 or click Ashen Brand to read the short lesson and choose Learn. Learning
persists through reload; combat auras do not. Brand's target label shows duration
and “Refresh now” in the final 3.6 s. Refresh preserves cadence and extends expiry
by 12 + min(remaining, 3.6) seconds. Tick damage snapshots on application/refresh;
there is no fractional final tick, crit or proc from periodic damage. Dead,
despawned, evading or reset targets and dead casters stop outstanding burns.
Developer rehearsal scenarios allow Brand without changing the saved lesson.
Menu → Keybindings includes slot 4.

## Evidence under review

Local receipts: `.cache/combat-c05-2026-10-10/`. **73 focused CPU tests pass** (67 core/bindings/spell tests plus six auto-attack tests). Tests include exact cadence,
refresh, simultaneous lethal hits, generation reuse, elapsed-time hitches and
floating-point expiry boundaries. Native checks use real keys and UI learning,
Havok and the existing Developer → Combat scenarios. Capture overhead is excluded
from performance measurements. Final counts, reviewed motion and benchmark results
will be recorded after completion.

Root owns slot 8: Chrome PID 77674, Vite parent 77625 / listener 77649,
CDP 10137 / Vite 5973. User Chrome/Edge inventories had no game pages before boot.
Other user Vite servers 5173 and 4000 are untouched. Grok 4.6/high owns source-only
review, no browser. This record will be updated with cleanup at closeout.


Native functional checks pass: UI lesson/unlock, six exact 15-damage ticks,
refresh window/cadence/carry, and actual reload persistence. A 90.104 s stationary
dummy rhythm uses 56 native inputs with God/Fly off, Havok active, no deaths or
mana refusals. Minimum sampled mana is 88.1056; this C05 rotation is intentionally
generous before C06 removes Lava's personal cooldown. It is not acceptance of
final kit balance. Dummy recovery pauses are excluded from resource starvation;
there are no resets or resource refills during the 90 s window. A separate
explicit zero-mana fixture confirms native Fire Blast remains usable; it is not
presented as ordinary gameplay. Post-fix native Brand still lands all six ticks,
and a mortal shade contact reduces HP 100 → 84 after the visible windup.
No runtime errors were observed.

Two expiry defects were caught before acceptance: comparing with epsilon allowed
an aura to expire before a future queued tick; repeated floating-point additions
could instead put the final tick one ulp beyond expiry. Deadline ordering now uses
exact `now`, normalizing only a final tick numerically equal to expiry. Tests cover
30/60/144 Hz, a 120 ms hitch and 1,000 fractional application times. Rehearsal restore
also preserves the newest player generation, preventing damage immunity after a
previous lethal generation. Direct and periodic floating numbers merge separately.

Grok 4.6/high executed the prepared encode and build commands, both exit 0; build
3.83 s, existing chunk-size/mixed-import notices only. Root reviewed actual local
playback and seek: the 24.202764 s live clip shows lesson, Brand gesture, numbered
burn ticks, expiry and the late-refresh label. 1280×720, H.264, square pixels,
rotation 0, 6,851,840 bytes. Brand's distinct actor effect and icon remain C10
presentation work; this milestone provides the native gesture and readable HUD.
Capture predates the final numerical-expiry correction, which changes no visuals;
post-fix runtime checks are retained separately. Audio is muted in the clip.

For attribution of the small dummy p99 miss, root created the disposable detached
C04 checkout `/tmp/ashen-c05-baseline` at `9ba6ecf`, with linked existing assets and
node_modules. Slot 9 (Vite6073/CDP10237) is its exclusive control; slot8 has no game
page while that control renders. No source edits or feature work belong there.
Its exact PIDs and cleanup are retained in the control ownership receipt.

Independent source review: Grok 4.6/high, eight turns then a report-only continuation
([report](grok-review.md)). Accepted its P1 recovery race: consuming a dummy
recovery deadline and then clearing the dead player's event queue left the dummy
permanently dead. The deadline now remains pending while dead and is consumed
only by the actual recovery callback after respawn. A dedicated integration
fixture verifies real enemy death followed by the native Release spirit button;
its injected lethal dummy hit/HP seed are explicitly labelled. The review did not
run live checks or certify presentation/performance.

The dummy recovery regression fixture passes: lethal dummy generation 2 remains
at HP 0 while the player is dead; clicking Release spirit restores player HP 100,
dummy HP 2000 and dummy generation 3. It observed no runtime errors.

The same-day C04 control produced 165.17–165.37 FPS / 7.5–8.0 ms p99 at the dummy.
Both versions execute exactly two Lava, five Fire and one Pyre releases per window,
so the C05 tail increase is not explained by extra casts. Its initial six-run
sample had dummy p99 7.5/10.9/9.4 ms; skipping empty auto-attack timeline work did
not establish a fix (9.7/10.0/11.9 ms). All raw runs remain available. The next
bounded correction updates each global-cooldown track's transform directly,
avoiding an inherited custom-property change on its entire button subtree, and
skips unchanged cooldown/title writes. This follows the browser's existing DOM
animation path, with [Chrome's animation guidance](https://web.dev/articles/animations-guide)
linked in source. Final measurements below determine acceptance; no discarded
sample is relabelled as a pass. The control's first attempt aborted before sampling
because God mode did not toggle; a focused native check verified the key, and a
150 ms settle before KeyG corrected setup. No performance data came from that abort.

## Performance result — release qualification remains open

M1 Max, uncapped Chromium 155 WebGPU, 1280×720/DPR1, seven enemies, three
12-second windows per scenario. Same bounded native input schedule as C04; God
on for sustainable workload, diagnostic placement, finite pack. Submitted-frame
intervals, no separate RAF counter, capture, encode, builds or video playback
during samples. Gameplay acceptance above uses God off.

| Route/run | FPS | p50/p95/p99 ms | Worst ms | >16.67 / >33.33 / >50 ms |
| --- | ---: | --- | ---: | --- |
| dummy 1 | 165.20 | 5.8 / 6.8 / 7.8 | 23.3 | 17 / 0 / 0 |
| dummy 2 | 165.08 | 5.8 / 6.8 / 11.6 | 23.6 | 19 / 0 / 0 |
| dummy 3 | 165.16 | 5.8 / 6.8 / 9.0 | 23.8 | 18 / 0 / 0 |
| pack 1 | 187.26 | 5.2 / 6.3 / 6.5 | 22.7 | 6 / 0 / 0 |
| pack 2 | 187.10 | 5.3 / 6.3 / 6.6 | 23.3 | 5 / 0 / 0 |
| pack 3 | 187.18 | 5.3 / 6.3 / 6.5 | 23.3 | 6 / 0 / 0 |

Every run exceeds 144 FPS. Final dummy median p99 is 9.0 ms, versus same-day C04
7.8 ms (+1.2 ms); one final run is 11.6 ms. Thus the strict <=10 ms per-run and
<=1 ms matched-tail targets are **not fully met**. HUD changes reduced redundant
work but did not establish a complete tail fix. This is an explicit C12 release
blocker requiring attributed profiling after kit integration. No production
promotion or claim of full performance acceptance. Median throughput changes are
under 1% versus C04; final pack p99 remains 6.5–6.6 ms. All attempted cohorts and
the original failed control setup are retained, not cherry-picked. The temporary
C04 worktree and slot 9 Chrome7221/Vite7144 (listener7178) are removed/stopped.


Final native capture passes all four lesson/tick/refresh/reload checks, including
inspection of the directly updated cooldown-track transform. The first final
capture attempt applied its second Brand to a shade, so its refresh assertion
correctly failed. The helper now lets each native Tab input reach an update and
asserts the dummy selection before refreshing. That failed receipt is retained;
it is not counted as a successful refresh test. The earlier 90 s run remains
separate from recording. Final build passes in 4.07 s.

Compressed receipts and executable helpers are adjacent to this document. The
additional six auto-attack CPU tests pass; total 73. Performance release blockers
are explicit above. Brand actor VFX, the distinct icon, final kit balance, C12
100-input/20-minute/native-source/chapel checks and production are still pending.
