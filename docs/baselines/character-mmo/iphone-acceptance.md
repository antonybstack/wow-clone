# Physical iPhone acceptance receipt

Status: **partial user-run physical checks; device-loss failure; mobile work deferred**.
The 2026-10-08 user report identifies **iPhone 14 Pro Max, iOS 26.7.1, Safari,
Low Power Mode off**. Startup, walking, rotation and background/resume work;
hood → dye → ponytail → unequip loses the graphics device. Preserve these known
specifications rather than repeatedly asking for the device model.
[Report, original screenshots and deferred findings](../../backlog/mobile-2026-10-08.md).
The Mac's absent connected device does not negate the user's physical-device
evidence. Desktop emulation and historical ~60 FPS remain separate evidence;
the complete acceptance matrix below is still unverified.

Use this receipt for the exact release under test. Record failures and every
attempt; do not replace a failed visit with a favorable retry.

| Condition | Actual value |
|---|---|
| Date / operator | 2026-10-08 / user; partial manual checks |
| Physical model / iOS / Safari | iPhone 14 Pro Max / iOS 26.7.1 / Safari |
| Production or immutable preview URL / source / deployment | play.sparkify.dev shown in screenshots; exact on-device build not instrumented |
| Network / measured latency and throughput | Pending |
| CSS viewport / canvas / DPR / portrait or landscape | Portrait screenshots; HUD canvas 322×581; CSS viewport/DPR unmeasured; rotation works per user |
| Power, battery, Low Power Mode, thermal state | Low Power Mode off; screenshots show 100% battery; power source/thermal state unmeasured |
| HTTP cache policy / saved appearance | Pending |
| Other active game pages | Pending; one intended renderer |

1. **First play:** unsaved default, then the current catalogue-derived maximum
   saved outfit. Also test the saved ponytail with complete hood coverage: the
   covered-hair candidate's maximum is now uncovered, so the maximum alone does
   not exercise source restoration. Pin the maximum fixture and catalogue hashes
   from the release's declared startup method; do not use an older maximum by
   name. Verify correct dressed identity, grounded Havok and immediate
   touch movement/jump/look. Collect navigation-relative
   `performance.getEntriesByName('ashen-startup-playable').at(-1)?.startTime`,
   the loading overlay's failure/details, and request errors when Web Inspector
   is available. `ASHEN.playableMs` starts after the boot module and excludes
   earlier navigation/download time; label it separately. A fresh tab alone
   does not prove disabled HTTP cache. Keep saved appearance intact while testing.
2. **Creator:** landscape, portrait and rotation while open. Scroll through
   controls, retain Close, orbit/pan and use the actual height/build endpoints
   and head/hair choices. No clipped controls, missing model or stuck touch input.
3. **Equipment:** switch all three supported races and the new Fieldcoat, then
   mixed hood/shoulder/boot/glove combinations. Save, reload and confirm exact
   identity, shape, equipment and dye restoration. Repeat ten swaps; record
   pending/failure UI and any missing native mesh or renderer reset.
   On a fresh covered-ponytail start, remove the hood while refinement is pending;
   the hood must remain until the saved native ponytail is ready. Check restored
   hair, facial/body/garment shape and source motion, then rehood and switch
   Human → Orc → Human. A failed transfer must retain the previous appearance
   and permit an explicit retry; no missing-hair frame or silent recipe change.
4. **Sustained movement:** 15 minutes through town, bridge/cathedral return and
   forest using normal controls. Havok remains active, with no recovery teleport.
   Measure separately from video/screen recording. Use existing performance
   controls/`ASHEN.metrics` for FPS, frame-time tails and actual canvas size;
   record early and final samples, display pacing and temperature/power changes.
5. **Memory and recovery:** capture the available physical-device memory
   instrumentation before/after swaps and sustained play. State the tool and
   scope; absent browser memory APIs are not zero memory usage. Background/resume,
   reopen the creator and move again. Record runtime/GPU errors and page reloads.

Store raw device measurements, motion and screenshots beside a dated copy of
this receipt. Include checks as pass/fail/unmeasured, plus the actual retained
numbers and limitations. No physical acceptance claim until that evidence exists.

The qualified 2026-10-07 preview retains portable fixtures for the
[uncovered maximum](startup-public-covered-2026-10-07/seed-maximum-uncovered.json)
and [previous covered maximum](startup-public-covered-2026-10-07/seed-prior-maximum-covered.json).
Their exact hashes and source/catalogue/URL are in its
[startup receipt](startup-public-covered-2026-10-07/receipt.json).
These unchanged fixtures now have a qualified production attribution: source
`7d00c56c06f02899e2319ffdddea97728013c0b1`, Pages
`5723a4ab-5dfd-4902-959b-7496948ea51f`, [play.sparkify.dev](https://play.sparkify.dev).
The [production receipt](production-delivery-2026-10-07/receipt.json) retains the
exact source/catalogue/fixture hashes. Desktop production qualification does not
constitute physical-device acceptance.
