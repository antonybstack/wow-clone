# G08 — Explain the remaining region wait in the live UI

The user's latest question identifies an opaque wait: Developer tools say collision
is pending while the loader downloads, decodes and installs the whole region.
The core candidate is delivered experimentally; adopting it still needs isolated
paired timing/FPS. Independently make the existing wait understandable and prove
that its UI follows actual readiness. This is not a load-time optimization claim.

1. Reuse `world.startRegion`'s existing options/owner in starter-world.js. Add an
   optional synchronous progress callback for the prepared path, passed through
   loadRegion/loadPreparedRegion and final box installation. Emit index-fetch,
   physical-surface stream, final supports, optional full trees (candidate only),
   foliage and completion phases. Packet counters describe ranges processed on
   this attempt, including idempotent retry ranges, not new GPU allocations.
   Only display known encoded packet size as a static size; native HTTP decoding
   does not expose compressed network bytes per chunk. Do not call it percent
   downloaded or give invented seconds remaining.
2. Keep the current native ReadableStream, install/Havok ownership, readiness,
   1 ms yielding and retry/abort behavior. Throttle progress notifications to at
   most two per second inside the existing asynchronous loop, always emitting
   phase boundaries and the final count. No timers, render-loop callbacks, whole
   packet allocation, new decoder, hashing library or authoring worker. Legacy
   worker mode may keep its existing indeterminate status rather than fake totals.
3. Extend background-loading.js with phase text and a native progress element.
   Reuse the existing root, retry button, routesReady/done/dispose lifecycle.
   Announce phase changes; keep frequently changing counts out of live speech.
   Progress must not overwrite Retry/Reload after failure or revive removed UI.
   Navigation completion still announces safe routes independently of full detail.
   Wire main.js only after first play and guard scene disposal/device loss. Expose
   the same snapshot through the existing Developer tools getter/status so the
   user can reproduce it; update visible menu text through existing refresh paths.
4. Test counted progress/phase boundaries/throttling and retry/disposal where
   meaningful. Use fresh native contexts to hold/fail core/detail/foliage, verify
   jumps remain closed on core failure and open on detail failure, retry remains
   clickable, normal starting movement works and disposed callbacks add no DOM.
   A synthetic slow transport can demonstrate progress without a timing claim.
   Preserve the candidate's five failure cases and twenty UI floors/surface picks
   as relevant checks. Root reviews actual live MP4, commit/push/sealed desktop
   preview/served-public native checks/VE/Telegram and closes owned instances.

Required near assets/world geometry remain unchanged. Preserve unknown user
Shadowglass tab and pending isolation clarification; no accepted FPS/load-time
claim until isolated. Production startup hold/mobile backlog remain separate.
