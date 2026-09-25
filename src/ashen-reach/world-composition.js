/** Shared placement policy. Distance is from the existing curved path center. */
export function pathVegetation(distance, z, footprint = 0) {
  if (z < -95 || z > 145) return 1;
  const halfWidth = 1.05 + .25 * smooth((z - 40) / 36);
  return smooth((Math.abs(distance) - footprint - halfWidth) / 1.25);
}
function smooth(t) { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); }

export const MOTE_STYLE=Object.freeze({count:4200,fadeStart:18,fadeEnd:60,growth:.35,intensity:.7});
export function moteVisibility(distance) {
  return smooth((distance-.6)/2.4)*(1-smooth((distance-MOTE_STYLE.fadeStart)/(MOTE_STYLE.fadeEnd-MOTE_STYLE.fadeStart)));
}
export const MOTE_VISIBILITY_WGSL=`fn moteVisibility(d:f32)->f32 {
 return smoothstep(0.6,3.0,d)*(1.0-smoothstep(${MOTE_STYLE.fadeStart.toFixed(1)},${MOTE_STYLE.fadeEnd.toFixed(1)},d));
}`;
