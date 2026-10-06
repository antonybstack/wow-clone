# M6 continuous mixed clearance — 2026-10-06

The existing recorder now supports a declared Human clearance profile and plays
all nine native Armory source previews through complete cycles at three angles.
Four shape corners pass the runtime checks: Prime ponytail tall/slender and
short/stout, Weathered tall/stout and short/slender. Root reviewed sampled live
frames and advancing video; no new gross seam or dropped-piece defect reproduced.
No game runtime or asset changed.

[Receipt](../../../baselines/character-mmo/m6-clearance-2026-10-06/receipt.json)
retains per-profile source hashes, dimensions/timestamps, initial jump limitations,
corrected movement results and the delivery edit list. Raw evidence is under
`ve-capture/character-mmo/m6-clearance-2026-10-06/`; task notes and source review
are under `.cache/character-mmo/m6-clearance-2026-10-06/`.

## What was checked

**324 full-cycle preview views:** four profiles × three mixed outfits × nine
motions × front/side/back. The outfits are hood/Lector coat/robe/Bastion,
Pilgrim/plate tassets with exposed wrists and feet, and Lector/Wayfarer boots/vambraces
with exposed legs and a greatstaff. Motions are idle, walk, run, jump takeoff,
landing, Fire Blast, Lava Ball, Pyre Burst and raw two-handed carry. The last is
explicitly an unmasked source audition, not a gameplay gait.

Each preview uses the actor's existing native animation manager, actual streamed
gear, saved identity/shape controls and diagnostic inspection light. The recorder
reads clip duration rather than approximating it from frame count. Root inspected
twelve 27-panel sheets sampled at 55% of each clip, selected full frames, advancing
native video of all four profiles and the delivery excerpts. This is not a claim
that every rendered frame was independently judged.

**12 normal Havok sprint/jump chapters** prove movement, a registered jump and
landing for every tested outfit/profile pair, with zero recovery teleports and
zero recorded runtime/GPU errors. One initial meadow placement per recording
precedes capture; invulnerability is enabled, flying is false.

The original recorder's zero-duration `keyboard.press('Space')` sometimes fell
between game frames. The first full recordings registered fewer than three jumps
per profile despite all movement checks passing. They remain valid preview and
movement evidence, but do not prove all requested jumps. The recorder now holds
Space for 150 ms, asserts a jump-counter increment and landing, and releases Space
in cleanup. Only the twelve gameplay chapters were repeated. Both original and
corrected evidence are retained; this was a harness defect, not a game fix.

## Scope and next action

This closes the targeted continuous-motion follow-up to the
[864-view mixed checkpoint](m6-mixed-fit-2026-10-06.md). It does not certify all
9,072 catalogue combinations, every blend/transition or Orc/Undead shape changes.
The broad M6 visual exit remains open; existing boot sole silhouette/aliasing
follow-ups are unchanged. Production stays on `08f9bbe`; no rebuild, deployment
or performance cohort is warranted for recorder-only changes.

The next useful implementation check is M10 creator usability at **568×320 and
844×390 landscape**, preserving the approved preview and existing native camera.
Grok 4.6/high completed a bounded source-only review in five turns: the current
harness checks stage dimensions but not all control hit areas without automatic
scrolling. Its proposed portrait DOM-order and label-clipping issues remain
hypotheses to verify, not accepted product defects. Physical iPhone acceptance
remains distinct. Review session: `01a111d4-1db2-7f53-8ca6-97a623b87668`.

## Reproduce

Audit ownership and use the existing isolated harness. Close its initial game
page before the recorder creates its one owned context. Repeat for the four
profile IDs listed in the receipt; run profiles sequentially.

```sh
ASHEN_TEST_URL='http://127.0.0.1:5873/?play&clean&pixelRatio=1' \
ASHEN_CDP_PORT=10037 ASHEN_CAPTURE_DIR=/tmp/m6-clearance-tall \
ASHEN_CLEARANCE_PROFILE=ponytail-tall-slender \
node scripts/character-assets/record-shared-fit-release.mjs
python3 scripts/encode-capture.py /tmp/m6-clearance-tall /tmp/m6-clearance-tall.mp4 1700
```

`ASHEN_CLEARANCE_TRAVEL_ONLY=1` skips preview chapters for a targeted movement
recheck. It retains the actual outfit transactions and jump/landing assertions.
Do not pass `ASHEN_MIXED_MOTION=1` together with a clearance profile.


## Delivery and cleanup

Telegram **867**, verified returned 1280×720. The **73.314-second**
[VE video/mp4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m6-clearance-2026-10-06.mp4)
contains normal-speed excerpts, with cuts recorded in the receipt. Its full public
GET matches the local SHA-256; range requests return 206/video/mp4. Native local
playback, remote VE seeking/playback via a local wrapper, and Telegram Web A inline
and actual VIDEO fullscreen were reviewed with correct proportions. Physical
phone and Telegram Desktop remain unverified. The first upload failed transport;
chat inspection confirmed no delivery before the successful retry.

All owned recorder contexts, Chrome 50470/CDP 10037, Vite 50440/5873 and the
media review tab are closed. Telegram playback is paused. No owned listeners
remain; user Edge/Orca sessions are preserved. Goal status is active.
