import { pathX, buildingPads } from "./geometry.js";
import { nearestRegionRoute, regionSiteDistance } from "./region-layout.js";
import { pathVegetation } from "./world-composition.js";
const smooth = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
/** Same authoring density, reconstructed from the baked footprint descriptors. */
export function createFoliageDensity(extraFootprints) {
  const meadow = (x, z) =>
    Math.max(1 - 0.58 * smooth((Math.hypot(x, z) - 28) / 36), 0.4) *
    (0.8 +
      0.2 *
        (0.5 +
          0.5 *
            Math.sin(x * 0.093 + z * 0.077) *
            Math.cos(x * 0.061 - z * 0.118))) *
    pathVegetation(Math.abs(x - pathX(z)), z);
  const ease = (x, lo, hi) => smooth((x - lo) / (hi - lo));
  const clearance = (x, z) => {
    let c = 1;
    for (const p of buildingPads)
      c = Math.min(
        c,
        ease(
          Math.hypot(
            Math.max(Math.abs(x - p.x) - p.w / 2, 0),
            Math.max(Math.abs(z - p.z) - p.d / 2, 0),
          ),
          0.35,
          3.6,
        ),
      );
    for (const f of extraFootprints)
      c = Math.min(c, ease(Math.hypot(x - f.x, z - f.z), f.r * 0.4, f.r + 2.6));
    c = Math.min(
      c,
      ease(Math.hypot(x - buildingPads[8].x, z - buildingPads[8].z), 2.4, 7.2),
      pathVegetation(x - pathX(z), z),
    );
    return z > 71 && z < 79 ? 0 : c;
  };
  return (x, z) => {
    if (
      (nearestRegionRoute(x, z)?.distance ?? Infinity) < 3.5 ||
      regionSiteDistance(x, z) < 2
    )
      return 0;
    if (z <= 48) return meadow(x, z);
    if (z < 76) {
      const t = smooth((z - 48) / 28);
      return meadow(x, z) * (1 - t) + clearance(x, z) * t;
    }
    if (z <= 145 && Math.abs(x) < 44) return clearance(x, z);
    const r = Math.hypot(x, z - 20);
    return r > 190 ? 0 : 0.38 * (1 - smooth((r - 52) / 138));
  };
}
