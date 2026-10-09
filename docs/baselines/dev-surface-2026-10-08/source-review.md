# Dev surface pick — independent review

**Verdict:** no confirmed blocking defects in the frozen source.

Click teleport now uses Lite `createPickingRay` plus the player's Havok query, first physical hit, `ignorePlayer: true`, region-ready gate, and no heightfield fallback. CSS picking, deck-over-terrain first hit, sky miss, and upright-capsule plane offset match the stated task.

## Confirmed correct

- `pickTeleportSurface` picks in CSS pixels against `getBoundingClientRect`, same aspect as the view-projection, cap 900. Backing/DPR size is not mixed in.
- Default `player.raycast(from, to)` is still `physicsRaycast`. Only this picker passes `{ignorePlayer: true}`.
- Ignore path is a lazy 1 mm sphere `shapeCast` with `ignoreBody: controller.getBody()`, shape taken through existing `own.shape`. No mask change, no startup allocation.
- `teleportSurfacePosition` support along unit `n` is `r + max(0, h/2 − r)|n.y| + 0.12` for an upright capsule. Walls and undersides get hover 0; floors (`n.y > 0.5`) keep the flying +1.2 world-Y hover.
- Tick consumes the click, refuses before `isRegionReady()`, and does not march `height()`.

## Not a plane-offset bug

Clearance only keeps the capsule outside the **contacted plane**. It is not a full capsule placement query against the rest of the world. Concave corners, a second face at a junction, or a ceiling above a hovered floor can still overlap. That is a remaining limitation of this placement, not a failure of the wall/underside normal math.

## Minor

- `teleportSurfacePosition` null (zero/non-finite normal) consumes the click and returns with no HUD, unlike a miss.

## Native followups (not proven broken here)

- `ignoreBody` is captured on the first ignore call (`||=`). Fine while the controller body is stable for the session.
- The 1 mm sweep is the Lite 1.31.1 stand-in for a ray with `ignoreBody`; contact can sit ~1 mm early.
- Mock `player.raycast` in `scripts/test-dev-surface-pick.mjs` still wraps `physicsRaycast` and does not exercise this shapeCast path; the actual-input check does.
