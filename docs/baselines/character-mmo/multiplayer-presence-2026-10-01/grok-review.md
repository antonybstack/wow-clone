# Milestone 4 adversarial review (uncommitted)

Reviewed 2026-10-01 against `docs/plans/character-mmo/next-ten.md` milestone 4, current `src/multiplayer/*`, `server/presence/*`, `src/player.js` movement driver, `scripts/multiplayer/*`, and **installed** `@colyseus/core@0.18.18`, `@colyseus/sdk@0.18.4`, `@babylonjs/lite@1.31.1`. No browsers, servers, git, or product edits. Parent already passed two real clients (move / appearance / action / reconnect / departure) and headless five-route/endpoint collision.

Pinned APIs that the implementation does use correctly: `defineInput` + `setFixedTimestep(..., 30, {subSteps:2})` back-fills `tickRate`/`subSteps` (`Room.ts` 1021–1035); client `Predict.sim` + `wire.send()` is the 0.18 observe/replay loop; one `inputs.get(id).next()` per 30 Hz tick applied on both 60 Hz substeps matches `StepContext` (`rollback.ts` 121–131). Havok Lite 1.31.1 CCT is shapecast/query (`character-controller.ts` header); `world.step` does not integrate it, so client prediction calling only `driveInput` is the right engine pairing. Headless cook (`mesh._gpu=null` + identity TRS + `_cpuPositions`) matches `isMesh` in `havok.js` 690–691. Session IDs are server-assigned; reconnect is native `onDrop`/`allowReconnection(30)`/`onReconnect`/`onLeave`. `adoptMovementState` copies the full scalar/boolean set including `heightScale` and `castBlend`.

## Definite defects

### 1 — Severity: bug — seats with no consumed input are not simulated
- File: `server/presence/room.js:64-75`
- Certainty: definite (code + `@colyseus/core` 0.18.18 `InputBuffer.next`)
- Description: `step` skips `driveInput` / `copyMovement` when `!avatar.connected` or `this.inputs.get(id).next()` is empty. Installed `next()` returns `undefined` on an empty buffer unless `defineInput({idle})` or `next({idle})` is set (`InputBuffer.ts` 340–350, `types.ts` 29–43). Gravity, coyote, jump buffer, slope follow, and schema pose then freeze. Dropped seats stay hovering for the whole reconnect window. A background-tab hitch also empties the buffer: server `setFixedTimestep` still ticks, overflow at `bufferMaxSize:64` **acks dropped inputs without simulating them** (`InputBuffer.ts` 279–285), then the client reconciles to the frozen pose.
- Suggestion: Simulate every actor every tick. `const command = this.inputs.get(id).next({idle: true})` (or `idle: ctx => ctx.latest ?? true` to hold analog). Keep integrating dropped seats with idle/zero input until `onLeave`. Do not advance ack on idle (SDK already does that).
- Check: join and send nothing on a slope; Space then `connection.close()` before landing; Chrome-throttle one client for ~3 s. Authority `y`/`vy` must keep changing. Re-run the existing two-client reconnect after a mid-air drop.
- Status: open

### 2 — Severity: bug — every remote is rebuilt and `crowd.set` every render frame
- File: `src/multiplayer/client.js:128-140`
- Certainty: definite
- Description: The `onBeforeRender` loop `createRegionActor`s (full `validateAppearance`) and `crowd.set`s every remote every frame. `renderer.js:263` validates again. Same-revision hits the cheap branch but still `writeTransform` → `update()` (`renderer.js:200-221`), which `goToFrame`s **all** exact actors and `setVatTime`s every VAT pool. The crowd already enrolls `update()` once per frame, so N remotes cost O(N) extra full updates. Non-zero build is forced exact (`renderer.js:269`); Warden 0.95 is therefore exact-pose work three times per frame per inspector. This is the M3 per-frame churn the eight-player ceiling cannot keep.
- Suggestion: Keep a last-seen pose/clip/revision per id. Call `crowd.set` only on revision/clip/tier change; write translation/yaw through a transform-only helper (or `setActorTransform`) that does not call `update()`. Let the existing crowd enroll own VAT/exact sampling. Cache the validated recipe until `avatar.recipe` changes.
- Check: two clients, one Warden 0.95, other idle inspect. Count `crowd.set` / `validateAppearance` / `goToFrame` per second in the inspector (expect ~0 extra `set`s while standing). Confirm clip phase still matches after Walk ↔ Idle and Spell_Simple_Enter.
- Status: open

### 3 — Severity: bug — local capsule height is applied before the server simulates it
- File: `src/multiplayer/client.js:50-61`, `server/presence/room.js:105-107`
- Certainty: definite
- Description: `changeAppearance` sets `applying=true` then `game.creator.set('height', …)` → `player.setHeightScale` **before** `room.send('appearance')`. Prediction `driveInput`s the new CCT against authority still on the old `heightScale` until `changeAppearance` on the server runs (a separate reliable message, not an input). Then the server `setHeightScale`s and `copyMovement`s; the next sim adopt snaps. Outfit visuals can stay optimistic; the movement capsule cannot, or `warnOnDivergence: .5` and feet/support diverge for the RTT.
- Suggestion: Apply equipment/shape meshes optimistically if wanted; call `player.setHeightScale` only after `status==='applied'` (or adopt the echoed `heightScale`). Keep Armory blocked (`main.js:376`, `entry.js:29-31`) so this remains the only online path.
- Check: shared Warden, Apply height 0.9 while walking a cathedral step. Watch local `player.heightScale` vs `room.state.players.get(sessionId).heightScale` and `me.drift` until the receipt. They must match before the next predicted step.
- Status: open

### 4 — Severity: bug — a late `appearance-result` is dropped after the 6 s timeout
- File: `src/multiplayer/client.js:55-62`, `src/multiplayer/client.js:108`, `server/presence/room.js:108-112`
- Certainty: definite
- Description: The client promise rejects at 6 s, `pending.delete`s, and `apply(previous)` rolls back. The server may still apply and send `{status:'applied'}`. `onMessage('appearance-result')` ignores unknown ids, so local last-accepted/outfit/capsule revert while remotes keep the new revision. Receipts on the server stay idempotent (`room.js:100-101`); the client is the hole. LAN two-client will not hit this; any stall/reconnect during Apply will.
- Suggestion: If a result arrives with no waiter, still apply `applied` (or at least set `lastAccepted` + `expectedRevision` from the payload) and ignore duplicate `rejected` for a timed-out id. On timeout, query `avatar.revision`/`recipe` and converge rather than blindly rolling back. Optionally return the stored receipt on reconnect.
- Check: delay `appearance` handling past 6 s (or drop the result frame). Local recipe/revision/height must match `room.state` and the peer crowd actor.
- Status: open

## Hypotheses (not blocking)

- Hitch overflow (64 acked-unsimulated inputs) plus finding 1 can erase a burst of movement. Not seen in the two-client pass. Fix 1 + measuring `inputs.get(id).size` under throttle is enough.
- Server clip durations come only from `prepared.variants.wayfarer.clips` (`room.js:27-28`). Harmless if Warden shares that atlas; wrong action hold if it does not. Check one Spell_Simple_Enter on both fits against `clips[clip].duration`.

## Justified limitations (do not treat as M4 bugs)

- Eight Human Wayfarer/Warden fits, static exported collision, no combat/account persistence, `/presence` on loopback, public host blocked on WorkersPaid/containers.
- CCT contact caches are not rewound; `player.js` already documents measuring corrections rather than bit-identical Havok.
- `presentMovement` poses translation only; facing stays on the last predicted `driveInput`.
- Offline solo path remains; Armory is disabled while shared.

## Suggested fix order

1 and 3 are movement-authority. 2 is the frame-cost hole at eight exact remotes. 4 is appearance authority after loss. Re-run the existing two-client script after 1/3/4; add the throttle/in-air-drop/height-while-walking checks above. Do not claim FPS from a two-renderer machine.
