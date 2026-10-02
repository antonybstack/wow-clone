/** One renderer plus seven native SDK peers. No recording, worker or other game.
 * This eight-seat proof reports its own cost; it is not the M8 hub acceptance.
 */
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import os from "node:os";
import { Client } from "@colyseus/sdk";
import { chromium } from "playwright";
import {
  PRESENCE_PROTOCOL,
  PRESENCE_CATALOG,
  presenceAppearance,
} from "../../src/multiplayer/protocol.js";
import { COLLISION_RELEASE } from "../../src/multiplayer/collision-release.js";
import { summarizeFrameIntervals } from "../character-assets/summarize-frame-intervals.mjs";
import { detectVsyncCap } from "../../src/ashen-reach/metrics.js";
import { browserOwnership } from "../lib/browser-ownership.mjs";
const port = Number(process.env.ASHEN_CDP_PORT),
  url = process.env.ASHEN_TEST_URL,
  out = process.argv[2];
assert(port && url && out);
const endpoint = process.env.ASHEN_PRESENCE_URL || "http://127.0.0.1:2577",
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(
  browser
    .contexts()
    .flatMap((c) => c.pages())
    .every((p) => p.url() === "about:blank"),
);
const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  }),
  page = await context.newPage(),
  rooms = [],
  timers = [],
  rows = [],
  errors = [];
const report = {
  conditions: {
    cpu: os.cpus()[0].model,
    url,
    endpoint,
    recording: false,
    renderingClients: 1,
    protocolPeers: 7,
    viewport: [1280, 720],
    runs: 3,
    seconds: 12,
    camera: "Diagnostic existing spring-arm group view",
    physicalPhone: false,
  },
  rows,
  errors,
};
await fs.writeFile(
  out + ".ownership.json",
  JSON.stringify(
    await browserOwnership(browser, {
      cdpPort: port,
      url,
      purpose: "Eight-seat device cost; one renderer/seven protocol peers",
      renderingClients: 1,
    }),
  ),
);
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
try {
  await page.goto(url);
  await page.waitForFunction(
    () => globalThis.ASHEN?.regionReady && ASHEN.hostilesReady,
    null,
    { timeout: 90000 },
  );
  await page.evaluate(async (endpoint) => {
    const { joinPresence } = await import("/src/multiplayer/client.js");
    await joinPresence(ASHEN, endpoint);
    ASHEN.dev.god = true;
    ASHEN.setView("play");
    ASHEN.metrics.setInternalResolution(1280, 720);
    const update = ASHEN.rig.update.bind(ASHEN.rig);
    ASHEN.rig.distance = ASHEN.rig.distanceTarget = 8;
    ASHEN.rig.yaw = Math.PI;
    ASHEN.rig.pitch = -0.2;
    ASHEN.rig.update = (dt) => update(dt, { x: 0, y: 1, z: -7 });
  }, endpoint);
  const health = async () => await (await fetch(endpoint + "/presence")).json(),
    h = await health();
  assert.equal(h.actors, 1);
  for (let i = 0; i < 7; i++)
    rooms.push(
      await new Client(endpoint).joinById(h.roomId, {
        protocol: PRESENCE_PROTOCOL,
    catalogVersion: PRESENCE_CATALOG,
        collisionHash: COLLISION_RELEASE.collisionHash,
        recipe: presenceAppearance(i % 2 ? "warden" : "wayfarer"),
      }),
    );
  for (const room of rooms) {
    const wire = room.input(),
      epoch = performance.now();
    Object.assign(wire.data, {
      forward: 0,
      strafe: 0,
      yaw: 0,
      walk: true,
      jump: false,
      action: 0,
    });
    timers.push(
      setInterval(() => {
        const t = (performance.now() - epoch) / 1000;
        wire.data.forward = Math.floor(t / 2) % 2 ? 0.15 : -0.15;
        wire.data.action = Math.floor(t) % 5 === 0 ? 1 : 0;
        wire.send();
      }, 1000 / 30),
    );
  }
  await page.waitForFunction(() => ASHEN.presence.crowd.snapshot().count === 7);
  await page.waitForTimeout(3000);
  for (const tier of ["vat", "exact"]) {
    if (tier === "exact") {
      for (let i = 0; i < 7; i++) {
        const r = rooms[i];
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
              off();
              reject(Error("Peer appearance timeout"));
            }, 6000),
            off = r.onMessage("appearance-result", (v) => {
              if (v.requestId === "exact") {
                clearTimeout(timer);
                off();
                v.status === "applied" ? resolve() : reject(Error(v.error));
              }
            });
          r.send("appearance", {
            requestId: "exact",
            expectedRevision: 1,
            recipe: presenceAppearance(
              i % 2 ? "warden" : "wayfarer",
              i % 2 ? 0.9 : 1.15,
              i % 2 ? 0.95 : -0.95,
            ),
          });
        });
      }
      await page.waitForFunction(
        () => ASHEN.presence.crowd.streaming().activeExact === 7,
      );
      await page.waitForTimeout(3000);
    }
    for (let run = 1; run <= 3; run++) {
      const before = await health();
      await page.evaluate(() => ASHEN.renderLoop.beginMeasurement());
      await page.waitForTimeout(12000);
      const sample = await page.evaluate(() => ({
        frames: ASHEN.renderLoop.endMeasurement(),
        metrics: ASHEN.metrics.summary(),
        actors: ASHEN.presence.crowd.snapshot(),
        streaming: ASHEN.presence.crowd.streaming(),
        enemies: ASHEN.combat.enemies.length,
        gpu: ASHEN.gpu.errors,
        presenceErrors: ASHEN.presence.errors,
      }));
      assert.deepEqual(sample.metrics.resolution, [1280, 720]);
      assert.equal(sample.enemies, 7);
      assert.equal(sample.actors.count, 7);
      assert(sample.actors.actors.every((a) => a.tier === tier));
      assert.deepEqual(sample.gpu, []);
      assert.deepEqual(sample.presenceErrors, []);
      const cap = detectVsyncCap(sample.frames),
        tails = summarizeFrameIntervals(sample.frames);
      delete sample.frames;
      assert(!cap.vsyncCapped);
      rows.push({
        tier,
        run,
        cap,
        tails,
        ...sample,
        before,
        after: await health(),
      });
      await fs.writeFile(out, JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ tier, run, tails }));
    }
    // Review aid is outside every measurement window.
    await page.screenshot({ path: out.replace(".json", `-${tier}.png`) });
  }
  assert.deepEqual(errors, []);
  report.passed = true;
} catch (e) {
  report.failure = e.stack;
  process.exitCode = 1;
  console.error(e);
} finally {
  for (const t of timers) clearInterval(t);
  await Promise.allSettled(rooms.map((r) => r.leave()));
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
