/** Shared cards must have identical geometry/UVs across the streaming switch. */
export function grassCardLayout(index, height, width) {
  return {
    angle: [0, Math.PI / 2, Math.PI / 4][index],
    height: height * (0.78 + index * 0.05),
    width: width * (0.84 + index * 0.07),
    // The owned foliage shader decodes 0/1 as root/tip wind, 2/3 as an
    // additional detail card's root/tip. No extra instance buffer is required.
    rootWeight: index === 2 ? 2 : 0,
    tipWeight: index === 2 ? 3 : 1,
  };
}
