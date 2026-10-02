import { browserOwnership } from "../lib/browser-ownership.mjs";
/** Shared-authority region traverse: no fixture/recovery teleport after joining.
 * One real WebGPU client plus a non-rendering native SDK peer observing state.
 */
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { Client } from "@colyseus/sdk";
import { chromium } from "playwright";
import {
  PRESENCE_PROTOCOL,
  PRESENCE_CATALOG,
  presenceAppearance,
} from "../../src/multiplayer/protocol.js";
import { COLLISION_RELEASE } from "../../src/multiplayer/collision-release.js";
const port = Number(process.env.ASHEN_CDP_PORT),
  url = process.env.ASHEN_TEST_URL,
  out = process.argv[2];
assert(port && url && out);
const endpoint = process.env.ASHEN_PRESENCE_URL || "http://127.0.0.1:2577",
  h = await (await fetch(endpoint + "/presence")).json();
assert.equal(h.actors, 0);
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(
  browser
    .contexts()
    .flatMap((c) => c.pages())
    .every((p) => p.url() === "about:blank"),
);
const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  }),
  page = await context.newPage(),
  rows = [],
  errors = [],
  report = {
    url,
    endpoint,
    conditions:
      "Normal keyboard inputs from assigned spawn; no fixture or recovery teleport; one real client and one protocol peer",
    rows,
    errors,
  };
let peer;
page.on("pageerror", (e) => errors.push(e.stack));
page.on("console", (m) => {
  if (m.type() === "error")
    errors.push(
      m
        .text()
        .replace(
          /reconnectionToken=[^&\s'"]+/g,
          "reconnectionToken=[redacted]",
        ),
    );
});
await fs.writeFile(
  out + ".ownership.json",
  JSON.stringify(
    await browserOwnership(browser, {
      cdpPort: port,
      url,
      purpose: "Region traversal with protocol peer",
      renderingClients: 1,
    }),
  ),
);
const state = () => page.evaluate(() => ASHEN.presence.snapshot());
try {
  await page.goto(url);
  await page.waitForFunction(() => globalThis.ASHEN?.regionReady, null, {
    timeout: 90000,
  });
  await page.evaluate(async (endpoint) => {
    const { joinPresence } = await import("/src/multiplayer/client.js");
    await joinPresence(ASHEN, endpoint);
    ASHEN.dev.god = true;
    ASHEN.setView("play");
    const { presenceAppearance } = await import("/src/multiplayer/protocol.js");
    await ASHEN.presence.changeAppearance(
      presenceAppearance("warden", 1.15, 0.95),
    );
  }, endpoint);
  await page.waitForFunction(() => ASHEN.player.heightScale === 1.15);
  peer = await new Client(endpoint).joinById(h.roomId, {
    protocol: PRESENCE_PROTOCOL,
    catalogVersion: PRESENCE_CATALOG,
    collisionHash: COLLISION_RELEASE.collisionHash,
    recipe: presenceAppearance(),
  });
  await new Promise((r) => peer.onStateChange.once(r));
  const id = await page.evaluate(() => ASHEN.presence.room.sessionId);
  rows.push({ case: "assigned-spawn", state: await state() });
  await page.keyboard.down("KeyE");
  await page.waitForTimeout(320);
  await page.keyboard.up("KeyE");
  await page.waitForTimeout(250);
  await page.keyboard.down("KeyW");
  for (const [name, ms] of [
    ["churchyard-to-town", 12000],
    ["town-to-bridge", 12000],
    ["bridge-approach", 12000],
    ["cathedral-entry", 12000],
  ]) {
    await page.waitForTimeout(ms);
    const snapshot = await state();
    assert.equal(snapshot.players[id].recoveries, 0);
    rows.push({ case: name, state: snapshot });
  }
  await page.keyboard.up("KeyW");
  await page.waitForTimeout(500);
  const inside = await state();
  assert(inside.players[id].z > 310 && inside.players[id].z < 345);
  assert(Math.abs(inside.players[id].x) < 2);
  assert(Math.abs(peer.state.players.get(id).z - inside.players[id].z) < 0.5);
  assert.equal(peer.state.players.get(id).revision, 2);
  await page.screenshot({ path: out.replace(".json", "-inside.png") });
  await page.keyboard.down("KeyS");
  await page.waitForFunction(
    () => {
      const a = ASHEN.presence;
      return a.room.state.players.get(a.room.sessionId).z < 295;
    },
    null,
    { timeout: 15000 },
  );
  await page.keyboard.up("KeyS");
  await page.waitForTimeout(300);
  const returned = await state();
  assert(returned.players[id].z < 300);
  assert.equal(returned.players[id].recoveries, 0);
  rows.push({ case: "cathedral-return", state: returned });
  assert.deepEqual(returned.errors, []);
  assert.deepEqual(await page.evaluate(() => ASHEN.gpu.errors), []);
  assert.deepEqual(errors, []);
  report.passed = true;
} catch (e) {
  report.failure = e.stack;
  report.failureState = await state().catch(() => null);
  process.exitCode = 1;
  console.error(e);
} finally {
  await page.keyboard.up("KeyW").catch(() => {});
  await page.keyboard.up("KeyS").catch(() => {});
  await peer?.leave();
  await page
    .evaluate(() => globalThis.ASHEN?.presence?.leave())
    .catch(() => {});
  await fs.writeFile(out, JSON.stringify(report, null, 2));
  await context.close();
  await browser.close();
  await fs.writeFile(
    out + ".ownership.json",
    JSON.stringify({
      owner: "root",
      cdpPort: port,
      renderingClients: 0,
      protocolPeers: 0,
      active: false,
    }),
  );
}
