/** Headless actual-region collision and movement scalar adoption. Fixture
 * placement is explicit; route motion itself uses the shared native CCT only.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRegionPhysics } from "../../server/presence/collision.js";
import { height } from "../../src/ashen-reach/geometry.js";
import { sampleTerrainSurface } from "../../src/ashen-reach/terrain-grid.js";
const out = process.argv[2] || ".cache/presence-2026-10-01/collision.json";
const physics = await createRegionPhysics(),
  rows = [];
const surface = (x, z) =>
  x === 0 && z >= 145
    ? sampleTerrainSurface(0, 145, height) +
      0.05 +
      (sampleTerrainSurface(0, 310, height) +
        12 -
        sampleTerrainSurface(0, 145, height) -
        0.05) *
        Math.max(0, Math.min(1, (z - 145) / 125))
    : sampleTerrainSurface(x, z, height);
const cmd = (forward = 0, yaw = 0, jump = false) => ({
  forward,
  strafe: 0,
  yaw,
  jump,
  walk: false,
  action: 0,
});
const run = (player, seconds, command) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    physics.step(1000 / 60);
    player.driveInput(1 / 60, command);
  }
};
try {
  for (const scale of [0.9, 1, 1.15])
    for (const [route, x, z, yaw] of [
      ["meadow", 0, -65, 0],
      ["town", 0, 80, 0],
      ["bridge", 0, 210, 0],
      ["cathedral", 0, 280, 0],
      ["forest", -80, 180, -Math.PI / 2],
    ]) {
      const resource = await physics.actor(x, z, scale),
        p = resource.player;
      try {
        p.setWorldPos(x, surface(x, z) + p.capsuleHeight / 2 + 0.15, z);
        p.setFacing(yaw);
        run(p, 1, cmd(0, yaw));
        const before = p.getMovementState();
        assert(
          before.grounded,
          `${route}/${scale} fixture must settle on authored collision`,
        );
        run(p, 5.4, cmd(1, yaw));
        run(p, 0.25, cmd(0, yaw));
        const after = p.getMovementState();
        assert.equal(after.recoveries, 0);
        assert(after.grounded);
        assert(
          Math.hypot(after.x - before.x, after.z - before.z) > 30,
          `${route} movement blocked`,
        );
        if (route === "cathedral") {
          assert(after.z > 310);
          run(p, 5.4, cmd(-1, yaw));
          run(p, 0.25, cmd(0, yaw));
          assert(p.getMovementState().z < 300);
        }
        const stable = p.getMovementState();
        run(p, 1 / 60, cmd(0, yaw, true));
        run(p, 0.2, cmd(0, yaw));
        const airborne = p.getMovementState();
        assert(airborne.y > stable.y + 0.4);
        p.adoptMovementState(stable);
        assert.deepEqual(p.getMovementState(), stable); // every motion scalar, not position alone
        run(p, 1 / 60, cmd(0, yaw, true));
        assert(p.getMovementState().jumpInFlight);
        rows.push({
          scale,
          route,
          before,
          after,
          adoption: "all scalars restored",
          usingPhysics: p.usingPhysics,
        });
      } finally {
        resource.dispose();
      }
    }
  const resource = await physics.actor(0, 0),
    p = resource.player;
  try {
    // A cathedral nave side wall is actual authored geometry, not a bounds clamp.
    p.setWorldPos(0, surface(0, 320) + p.capsuleHeight / 2 + 0.15, 320);
    run(p, 1, cmd());
    run(p, 3, cmd(1, Math.PI / 2));
    const wall = p.getMovementState();
    assert(wall.x < 10);
    assert.equal(wall.recoveries, 0);
    rows.push({ case: "nave-wall", state: wall });
  } finally {
    resource.dispose();
  }
  await fs.writeFile(
    out,
    JSON.stringify(
      {
        passed: true,
        conditions:
          "Native headless CCT; fixture placements, not live browser acceptance",
        colliders: physics.counts,
        rows,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      passed: true,
      rows: rows.length,
      colliders: physics.counts,
    }),
  );
} finally {
  physics.dispose();
  physics.dispose();
}
