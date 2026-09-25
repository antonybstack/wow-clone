/** Shared placement policy. Distance is from the existing curved path center. */
export function pathVegetation(distance, z, footprint = 0) {
  if (z < -95 || z > 145) return 1;
  const halfWidth = 1.05 + .25 * smooth((z - 40) / 36);
  return smooth((Math.abs(distance) - footprint - halfWidth) / 1.25);
}
function smooth(t) { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); }
