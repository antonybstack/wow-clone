import {createPickingRay, getViewProjectionMatrix} from '@babylonjs/lite';

/** Pick the nearest physical surface, including elevated floors and roofs.
 * Reuse Lite's reverse-Z ray and the player's existing Havok query, not a
 * terrain-height march or a second render-mesh/triangle picking implementation.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/18-picking.md
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/42-physics.md
 */
export function pickTeleportSurface(camera, canvas, player, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width, height = rect.height;
  const x = clientX - rect.left, y = clientY - rect.top;
  if (!width || !height || x < 0 || y < 0 || x > width || y > height) return null;
  const ray = createPickingRay(x, y, getViewProjectionMatrix(camera, width / height), width, height);
  if (!ray) return null;
  const distance = Math.min(ray.length, 900);
  const from = {x:ray.origin[0], y:ray.origin[1], z:ray.origin[2]};
  const to = {x:from.x + ray.direction[0] * distance,
    y:from.y + ray.direction[1] * distance, z:from.z + ray.direction[2] * distance};
  const hit = player.raycast(from, to, {ignorePlayer: true});
  return hit?.hasHit ? hit : null;
}

/** Keep the upright flying capsule outside the contacted surface. Offsetting
 * along its normal also handles walls and undersides without placing us inside.
 * For an upright capsule its support radius along n is r + (halfHeight-r)|n.y|.
 */
export function teleportSurfacePosition(hit, capsuleHeight, capsuleRadius) {
  const p = hit.hitPoint, n = hit.hitNormal, length = Math.hypot(n.x, n.y, n.z);
  if (!length || ![p.x,p.y,p.z,length,capsuleHeight,capsuleRadius].every(Number.isFinite)) return null;
  const normal = {x:n.x/length,y:n.y/length,z:n.z/length};
  const clearance = capsuleRadius + Math.max(0,capsuleHeight/2-capsuleRadius) * Math.abs(normal.y) + .12;
  // Hover above upward-facing ground/floors; avoid lifting through a ceiling or
  // across the edge of a vertical facade. Flight remains active after clicking.
  const hover = normal.y > .5 ? 1.2 : 0;
  return {x:p.x + normal.x*clearance, y:p.y + normal.y*clearance + hover,z:p.z + normal.z*clearance};
}
