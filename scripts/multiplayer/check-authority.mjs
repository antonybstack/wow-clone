/** Network-only protocol clients: real WebSockets and native input encoding.
 * No game renderer or fake client-side authoritative positions.
 */
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { Client } from "@colyseus/sdk";
import {
  PRESENCE_PROTOCOL,
  PRESENCE_ROOM,
  presenceAppearance,
} from "../../src/multiplayer/protocol.js";
import { COLLISION_RELEASE } from "../../src/multiplayer/collision-release.js";
const endpoint = process.env.ASHEN_PRESENCE_URL || "http://127.0.0.1:2577",
  out = process.argv[2] || ".cache/presence-2026-10-01/authority.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  health = async () => await (await fetch(endpoint + "/presence")).json();
const sdk = new Client(endpoint),
  rooms = [],
  rows = [],
  timers = [];
const h = await health();
assert.equal(h.actors, 0, "Run separately from browser/network clients");
const options = {
  protocol: PRESENCE_PROTOCOL,
  collisionHash: COLLISION_RELEASE.collisionHash,
  recipe: presenceAppearance(),
};
const join = async (extra = {}) => {
  const room = await sdk.joinById(h.roomId, { ...options, ...extra });
  rooms.push(room);
  if (!room.state?.players?.get(room.sessionId))
    await new Promise((r) => room.onStateChange.once(r));
  return room;
};
const reject = async (label, fn) => {
  await assert.rejects(fn);
  rows.push({ case: label, rejected: true });
};
const receipt = (room, request) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(Error("Appearance receipt timed out"));
    }, 6000);
    const off = room.onMessage("appearance-result", (r) => {
      if (r.requestId === request.requestId) {
        clearTimeout(timer);
        off();
        resolve(r);
      }
    });
    room.send("appearance", request);
  });
try {
  await reject("caller-cannot-claim-id", () => join({ actorId: "victim" }));
  await reject("caller-cannot-claim-position", () => join({ x: 1000 }));
  await reject("wrong-world", () => join({ collisionHash: "bad" }));
  await reject("unsupported-race", () =>
    join({ recipe: { ...options.recipe, race: "orc" } }),
  );
  await reject("duplicate-room-rejected", () =>
    sdk.create(PRESENCE_ROOM, options),
  );
  for (let i = 0; i < 8; i++) await join();
  assert.equal(new Set(rooms.map((r) => r.sessionId)).size, 8);
  await reject("ninth-player-capacity", () => join());
  const first = rooms[0],
    wire = first.input(),
    self = () => first.state.players.get(first.sessionId),
    before = { x: self().x, z: self().z };
  Object.assign(wire.data, {
    forward: 1000,
    strafe: 0,
    yaw: 0,
    jump: false,
    walk: false,
    action: 0,
  });
  for (const r of rooms) {
    const input = r.input();
    Object.assign(input.data, {
      forward: r === first ? 1000 : 0,
      strafe: 0,
      yaw: 0,
      jump: false,
      walk: false,
      action: 0,
    });
    timers.push(setInterval(() => input.send(), 1000 / 30));
  }
  await sleep(3000);
  const after = self().toJSON(),
    travel = Math.hypot(after.x - before.x, after.z - before.z);
  assert(
    travel > 15 && travel < 23,
    "Out-of-range axis must remain bounded to normal speed",
  );
  assert.equal(after.recoveries, 0);
  Object.assign(wire.data, { forward: NaN, strafe: Infinity, yaw: NaN });
  await sleep(400);
  assert(
    Number.isFinite(self().x) &&
      Number.isFinite(self().z) &&
      Number.isFinite(self().facing),
  );
  Object.assign(wire.data, { forward: 0, strafe: 0, yaw: 0 });
  const loadSeconds = Number(process.env.ASHEN_AUTHORITY_LOAD_SECONDS || 0);
  if (loadSeconds) {
    const before = await health();
    await sleep(loadSeconds * 1000);
    const after = await health();
    rows.push({
      case: "eight-client-sustained-load",
      seconds: loadSeconds,
      before,
      after,
    });
  }
  rows.push({
    case: "eight-clients-and-sanitized-input",
    travelM: travel,
    after,
    health: await health(),
  });
  const request = {
    requestId: "bounded-change",
    expectedRevision: 1,
    recipe: presenceAppearance("warden", 1.15, -0.95),
  };
  const applied = await receipt(first, request);
  assert.equal(applied.status, "applied");
  assert.equal(applied.revision, 2);
  assert.deepEqual(await receipt(first, request), applied);
  rows.push({ case: "appearance-deduplicated", revision: 2 });
  assert.equal(
    (await receipt(first, { ...request, recipe: presenceAppearance() })).status,
    "rejected",
  );
  assert.equal(
    (
      await receipt(first, {
        requestId: "stale",
        expectedRevision: 1,
        recipe: presenceAppearance(),
      })
    ).status,
    "rejected",
  );
  assert.equal(
    (
      await receipt(first, {
        requestId: "position",
        expectedRevision: 2,
        recipe: presenceAppearance(),
        x: 100,
      })
    ).status,
    "rejected",
  );
  assert.equal(
    (
      await receipt(first, {
        requestId: "remote-id",
        expectedRevision: 2,
        recipe: presenceAppearance(),
        actorId: rooms[1].sessionId,
      })
    ).status,
    "rejected",
  );
  for (let i = 0; self().revision !== 2 && i < 50; i++) await sleep(20);
  assert.equal(self().revision, 2);
  assert.equal(first.state.players.get(rooms[1].sessionId).revision, 1);
  rows.push({ case: "stale-and-foreign-appearance-rejected" });
  for (const timer of timers) clearInterval(timer);
  timers.length = 0;
  await Promise.all(rooms.map((r) => r.leave()));
  rooms.length = 0;
  await sleep(300);
  assert.equal((await health()).actors, 0);
  await fs.writeFile(
    out,
    JSON.stringify(
      {
        passed: true,
        endpoint,
        conditions:
          "Eight network-only native SDK clients; no rendering capacity claim",
        rows,
        final: await health(),
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, cases: rows.length }));
} finally {
  for (const t of timers) clearInterval(t);
  await Promise.all(rooms.map((r) => r.leave().catch(() => {})));
}
