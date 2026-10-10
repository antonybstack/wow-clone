# C03 — moving instants and contact

Runtime: e257894 plus C03 source changes. Human default source rig; Babylon Lite 1.31.1, Havok active.

Fire Blast now releases on acceptance while running or airborne. Pyre is instant and grounded. Lava requires stationary ground and cancels on movement. Melee pins its target/generation, fails closed without collision, and uses a gameplay contact deadline. Enemy damage follows an authored punch windup.

**Verification:** 54 focused CPU tests and build pass; 12 native input checks pass (see compressed helper and result). Repress costs once, target switching preserves accepted Lava, Escape works while pointer locked, queue preempts cosmetic recovery, menu clears pending actions, moving Fire retains ~7 m/s, airborne Fire retains jump, air Pyre refuses, and movement cancels Lava without spending reserved mana.

**Live motion:** root reviewed native Edge playback at normal and half speed. [16.68-second live check montage](https://ve.sparkify.dev/wow-clone/ashen-reach/combat/2026-10-10/c03-native-combat.mp4), 1280×720, square pixels, normalized rotation. Silent diagnostic resets between checks; capture overlay is not a performance measurement. Exact public bytes, video/mp4, HTTP206 and native play/seek pass. Telegram **914** returned matching1280×720 dimensions and17s rounded duration. Application inline/fullscreen remains unverified.

## Isolated submitted-frame measurement

M1 Max, uncapped Chromium155 WebGPU, 1280×720/DPR1, seven enemies, three 12-second runs per fixture. Root slot8 Chrome45113/CDP10137/Vite5973, one game page; no capture/encode/build/video playback during samples. God mode enabled for bounded repeated casts. The pack is a finite fight: targets can die before later inputs. It is not a sustained all-target spell storm.

| Fixture | Run | FPS | p99 ms | Max ms | >16.67 ms |
|---|---:|---:|---:|---:|---:|
| dummy | 1 | 165.5 | 7.4 | 27.9 | 14 |
| dummy | 2 | 165.5 | 7.5 | 23.5 | 16 |
| dummy | 3 | 165.3 | 9.1 | 23.9 | 18 |
| pack | 1 | 188.7 | 6.5 | 22.8 | 2 |
| pack | 2 | 188.5 | 6.5 | 22.7 | 2 |
| pack | 3 | 188.5 | 6.5 | 22.1 | 2 |

No runtime/GPU errors; no interval >33.33 ms. All six meet the current FPS/p99 threshold. Raw intervals retained. Uses existing renderLoop.beginMeasurement/endMeasurement, counting submitted game frames. C01 independent RAF callback counts included skipped submissions, so its191–196 FPS is not a directly comparable rendered-frame baseline. Do not claim a matched performance improvement.

## Remaining acceptance

C03 functional slice is implemented; complete source/equipment-variant review, mortal chapel replay, native100-action chain and death/blur/long soak remain in C04/C12 acceptance. Enemy windup/contact CPU tests pass but exact visual contact alignment still needs native enemy review. C04 HUD/rebinding is subsequent work. VFX prototype remains unconnected. Production is unchanged. First native attempt had automation jump timing and pointer-unlock guard failures; retained separately, corrected in final helper.

## Review disposition

Grok4.6/high reviewed source (8 turns plus a report-only resume; no live review).
Accepted: clear instant gesture on input takeover/rehearsal reset; clear enemy
windup when applying diagnostic state; clear pinned melee contact on reset;
allow requested melee to preempt cosmetic instant recovery. Five enemy-contact
CPU tests pass after correction, including diagnostic restore and player death.
The original clip predates these cleanup/preemption corrections; its cast/movement
behavior is unchanged. Broader native contact review remains stated above.
Rejected suggestion to require a successful animation start before dealing melee
damage: that would restore animation as gameplay authority and break valid
missing-clip fallbacks. Gameplay checks grounded/range/facing/LOS and owns its
single pinned contact; the clip is optional presentation.

The new diagnostic restore unit fixture initially lacked its native root scaling stub; corrected and rerun: **5/5 enemy-contact tests pass** (review-fix-tests.txt). This was a test construction error, not a runtime exception.
