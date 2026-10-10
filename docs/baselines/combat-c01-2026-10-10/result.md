# C01 live baseline verification

Status: **FUNCTIONAL PASS / COMPLETE CAPTURE 62.94 s / RAF BASELINE RECORDED**
Worker: grok-c01 (Grok 4.6 high)
Source runtime: `d7dce455b36cbd6d809d12a0533b0947364ebe81`
Date: 2026-10-10
Commit nothing. No Telegram/upload. Root reviews first.

## Verdict

Developer rehearsals work. A **62.936669 s** silent 1280×720 clip includes **two successful Lava Ball hits** on the training dummy (240 damage each). The earlier **43.285811 s** clip is retained and is too short, with Lava repress-cancelled. Isolated RAF throughput on slot 8 with God on (labelled workload) is about **191–196 RAF fps** over nine 12 s runs; p99 sits at **17.7–17.8 ms**. C01 acceptance is for root.

## Ownership and cleanup

Second slot-8 session (benchmark + complete capture):

| Field | Value |
| --- | --- |
| owner | grok-c01 |
| slot | 8 headless uncapped idle |
| Vite | 5973 pid 22295 listener 22335 |
| CDP | 10137 |
| browser PID | 22340 HeadlessChrome 155.0.8059.39 |
| GPU PID | 22346 |
| URL | `http://127.0.0.1:5973/ashen-reach.html?dev&play` (benchmark used `/?dev&play`) |
| viewport | 1280×720 DPR 1; `ASHEN.metrics.setInternalResolution(1280,720)` |

`down.mjs --slot 8` after encode: Chrome 22340, GPU 22346, Vite 22295/22335, ports 5973/10137, and `/tmp/ashen-harness/slot-8.json` **gone**. User Vite 29712/5173 and 10205/4000 preserved. Edge 2931 had no game page (root CUA).

## Boot (`?dev&play`)

In-page marks from `begin` (complete-capture boot): playable **301.5 ms**, hostiles **840.7 ms**, navigation **3573.1 ms**, ready/loadMs **4547.7 ms**. Meanings unchanged: playable = dressed Havok first play; hostiles = town enemies registered; navigation = route render+collision; ready = hostiles+foliage+textures.

Functional-pass boot (earlier): playable 363.1, hostiles 972.3, navigation 3872.3, ready 4893.2. GPU `depthBundle=native`, no GPU/page/console errors on these boots.

## Functional scenarios (960×540 canvas, 1280×720 viewport)

Labelled **960×540 internal** (HUD printed `960×540`). UI start/restore/trace export all worked.

| Scenario | Result |
| --- | --- |
| dummy | God/Fly off, physics on, HP/mana full. Walk +Z. |
| pack | Three diagnostic shades. |
| cathedral | Nave LOS clear; chapel/gallery blocked `Vaelmark collision collision transform`. |
| mortal | Ordinary AI, God/Fly off. Short window did not drop HP or kill. Death allowed, not observed. |

XP 0, exploration `unstarted`, objective remaining 4 during rehearsal. Paused restore returned position, god, mana, `life.time`. **Havok recoveries incremented on diagnostic teleports and are not restored** (not in snapshot keys). Diagnostic, not a zero-recovery traversal proof.

First functional Fire: input dummy, hit `grave-shade-1` 120. Dummy HP stayed 2000. That Fire is **not** dummy damage.

## Capture

Resolution pin: `ASHEN.metrics.setInternalResolution(1280,720)` (no Developer resolution control). `renderCanvas` 1280×720 asserted. Silent: `audio.muted=true`. Capture adds load; HUD FPS in frames is **not** the RAF baseline.

**Short clip retained** `combat-baseline.mp4`: 1024 frames, source elapsed 43.286 s, encoded **43.285811 s**, 1280×720, SAR 1:1, rotation 0, h264, 9.4 MB. Dummy was targeted; first Fire repress-cancelled; later Fire hit dummy 120 (2000→1880). Lava in that clip did not land (`lava.casts=0` at after-lava). Root rejected this length/Lava gap.

**Complete clip** `combat-baseline-complete.mp4`: 1513 frames, source 62.937 s, encoded **62.936669 s**, 1280×720, SAR 1:1, rotation 0, h264, 14 MB, ~1818 kbit/s, `nb_frames=1513`. Probe via bundled ffprobe (`/Applications/BabylonJS Editor.app/Contents/bin/ffprobe`).

Complete-clip actor/trace (actual):

- Dummy pinned by Tab (`ashen-training-dummy`) before first Fire.
- Same-key Fire repress → `repress-cancel` then a later Fire **hit dummy 120**.
- Pyre hit dummy 90 (dummy 1880→1790).
- Pack: Tab through three shades; Fire/Pyre/Lava; mana 10 at mana-check (exhaustion).
- Mortal: God/Fly off, 12 s contact. Root playback shows HP 20/100 around 40.8 s; the worker’s “HP stayed 100” summary sampled the wrong state. Death was not observed in this complete clip.
- **Successful Lava passage** after restore, dummy retargeted: two Lava **release+hit dummy 240** each (dummy 1760 then 1520); passage end dummy **1400**, mana **0**. Frame ~1200 shows Lava charged in hands, dummy 1760/2000, Lava CD 2.9, overlay `1280×720`.
- Trace 92 events, dropped 0: scenario-reset 8, input 28, start 12, repress-cancel 2, cancel 3, release 9, hit 16, reject 14.

Scenario teleports/setup/restore are diagnostic.

## Isolated RAF baseline (capture-free)

Hardware: **Apple M1 Max**, Darwin **25.6.0**, HeadlessChrome **155.0.8059.39**, viewport 1280×720 DPR 1, canvas pinned 1280×720, uncapped `--disable-gpu-vsync --disable-frame-rate-limit`. Seven enemies. **God on** for a sustainable spell schedule (explicitly labelled; not a mortal-combat claim). Native Digit1/2/3 during each 12 s window. No screenshot, screencast, or GPU timing readback. Exclusive slot-8 game page. User 5173/4000 servers only.

These numbers are **raw `requestAnimationFrame` interval throughput**, not a physical display refresh claim. `metrics.summary().vsyncCapped=false` (mean ~6.8 ms not locked to a known display interval).

| Scene | Rep | fps | p50 ms | p95 ms | p99 ms | max ms | n | >16.67 | >33.33 | >50 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| dummy | 1 | 193.80 | 3.500 | 17.500 | 17.700 | 17.800 | 2327 | 327 | 0 | 0 |
| dummy | 2 | 196.49 | 3.400 | 17.500 | 17.700 | 17.800 | 2360 | 335 | 0 | 0 |
| dummy | 3 | 194.39 | 3.500 | 17.500 | 17.700 | 17.800 | 2334 | 333 | 0 | 0 |
| pack | 1 | 191.70 | 3.100 | 17.600 | 17.800 | 17.900 | 2301 | 351 | 0 | 0 |
| pack | 2 | 191.56 | 3.100 | 17.500 | 17.800 | 17.900 | 2302 | 353 | 0 | 0 |
| pack | 3 | 192.38 | 3.100 | 17.600 | 17.800 | 17.900 | 2309 | 353 | 0 | 0 |
| mortal | 1 | 190.75 | 3.600 | 17.500 | 17.700 | 17.800 | 2291 | 328 | 0 | 0 |
| mortal | 2 | 192.67 | 3.500 | 17.500 | 17.700 | 17.800 | 2315 | 327 | 0 | 0 |
| mortal | 3 | 190.67 | 3.600 | 17.500 | 17.700 | 17.900 | 2291 | 325 | 0 | 0 |

`ASHEN.metrics.summary()` on dummy#1 after the window reported fps 147.5 / p95 20.9 ms on the engine sample buffer; that buffer is not the exclusive RAF array above.

Console/pageerror during benchmark: none recorded. GPU errors: none in the sampled `end.gpuErrors`.

## Open issues

- First complete-path Lava in the 43 s clip was repress-cancelled; only the 62.94 s clip has landed Lava.
- Same-key repress during the 0.55 s Fire window cancels the cast (`repress-cancel`).
- Fire release ~2–6 ms after animation deadline (0.55 s).
- Input/start target mismatch on the first functional Fire (dummy vs shade). Capture Tab-pin avoided that for dummy hits.
- Havok recoveries rise on diagnostic teleports and are not restored.
- Mortal death not observed in the contact windows (God off in rehearsal; God on in FPS workload).
- Capture HUD fps overlay must not be used as the baseline.
- Audio muted / clip silent.

## Files

Cache and `docs/baselines/combat-c01-2026-10-10/`:

- `result.md`, `boot.json`, `report.json`, `ownership.json`
- `stills/*.png` (960×540 canvas functional)
- `combat-baseline.mp4` + `capture/` manifest, action-log, trace (43.29 s, retained)
- `combat-baseline-complete.mp4` + `capture-complete/` manifest, action-log, trace (62.94 s)
- `benchmark.json` (full raw intervals), `benchmark-compact.json`, `benchmark.log`
- `c01-verify.mjs.gz`, helpers remain in `.cache/combat-c01-2026-10-10/`

## Root acceptance and limits

Reviewed actual 62.94 s MP4 playback in Edge, including ordinary movement, attacks, health loss and final dummy1400/mana0. This is the before-overhaul diagnostic baseline, not a visual polish acceptance. The earlier43s clip remains in local cache; its death evidence and missing landed Lava are separate from the final clip.

[Reviewed live baseline](https://ve.sparkify.dev/wow-clone/ashen-reach/combat/2026-10-10/c01-baseline.mp4). Local and public SHA-256: `0cd0924c99c1783d20a52022939633db64076d39e6021cef7aaeccde8edc29d3`. MP4s live on VE/local cache rather than in Git.

**Performance qualification remains open.** Repeated17.7–17.8ms tails fail the proposed10ms p99 gate. Dummy#1 engine buffer reported147.5FPS/21.3ms p99, different from the separately scheduled RAF probe193.8FPS/17.7ms. These require a matched render-owner sample before claiming improvement/regression. The pack fixture rejected eight of nine inputs with “Target is blocked” and cast one Pyre; label it blocked-target/area workload, not a sustained spell storm. Keep these raw results, then validate a corrected workload during integrated acceptance. Do not rerun unchanged baseline cohorts.

Ownership: C01 slot8 Chrome22340/Vite22295/CDP10137/5973 was closed by its worker. Root Edge review tab1147996305 and local preview7075 closed. Root explicitly closed user Edge5173 game tab under user authorization; unrelated user tabs/servers remain. C02 separately owns the next slot8 lifetime.
