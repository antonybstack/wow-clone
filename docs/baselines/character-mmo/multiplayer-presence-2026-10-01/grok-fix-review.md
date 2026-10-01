# Milestone 4 fix review

Read-only re-check of the four 2026-10-01 findings against current `server/presence/room.js`, `src/multiplayer/client.js`, `src/player.js`, `src/character/region-crowd/renderer.js`, plus installed `@colyseus/core@0.18.18` `InputBuffer.next` / idle policy. No browsers, servers, git, or product edits. Parent artifacts cited: network-matrix-v3, traversal-v3, authority-v3, collision-v2, 30 region tests. Public Workers Paid hosting is an account gate, not a software defect; this is not an all-acceptance claim.

## Prior findings

1. **Resolved.** `defineInput({ idle: ctx => ({forward:0,strafe:0,yaw: avatar facing, …}) })` (`room.js:30-35`). `step` no longer skips disconnected seats (`room.js:69-73`). Installed `next()` uses the room idle on an empty buffer and does not advance ack (`InputBuffer.ts` 340–350, 232). Gravity/support continue; missed packets release analog. Matches native idle.

2. **Resolved.** Remote loop keys `revision:clip:motionStarted:tier` and only then `crowd.set` (`client.js:170-176`). Standing motion uses `crowd.setTransform` → `setActorTransform` + `writeTransform(entry, false)` (`renderer.js:200-205, 259-267`), which writes matrices/root pose and does **not** call `update()` / `goToFrame` / VAT param rebuild. Crowd enroll still evaluates once per frame. Region tests cover pending-transform promotion and once-per-frame evaluation.

3. **Resolved.** Client `setHeightScale` / `setMoveScale` return immediately under `manualDrive && !headless` (`player.js:585-610`). Optimistic `applyLocal` may still reshape the drawn body; the CCT only changes in `adoptMovementState` (`player.js:656-659`) after the server `copyMovement`s the new `heightScale` (`room.js:112-114`).

4. **Resolved.** Late `appearance-result` with no waiter calls `convergeAppearance` (`client.js:132-136`). Each frame, if `!applying` and decoded `revision > acceptedRevision`, the same serialized chain applies the authoritative recipe (`client.js:145-148`). Timeout rollback can flash the previous outfit; the chain then converges. Receipts stay idempotent (`room.js:107-108`).

## New definite bugs

None that block parent FPS checks.

Residual (not defects for this pass): local prediction/render pump still returns while `!connected` (`client.js:143`), so a long drop can snap to the server-idled pose on reconnect — network-matrix-v3 already covers outage. Optimistic local height/build still scales the mesh before the capsule adopts; feet can disagree for one RTT. Clip durations still come from the Wayfarer atlas (`room.js:29`).

## Verdict

The four prior authority/lifecycle holes are closed in current source. No new consequential definite bug found in this pass. Public production UI remaining disabled without a verified endpoint is an account/hosting gate.
