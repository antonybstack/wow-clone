import { browserOwnership } from "../lib/browser-ownership.mjs";
/** Actual WebSocket shaping through checksum-pinned Shopify Toxiproxy 2.12.0.
 * Latency/jitter applies to both TCP directions. Socket outage checks reliable
 * transport recovery; dropping TCP byte chunks is not a packet-loss simulation.
 * https://github.com/Shopify/toxiproxy#toxics
 */
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const port = Number(process.env.ASHEN_CDP_PORT),
  url = process.env.ASHEN_TEST_URL,
  out = process.argv[2];
assert(port && url && out);
const endpoint = "http://127.0.0.1:2578",
  proxy = "http://127.0.0.1:8474",
  rows = [],
  errors = [],
  expectedConnectionErrors = [],
  report = {
    url,
    endpoint,
    toxiproxy: "2.12.0",
    conditions:
      "One actual rendering client; functional network matrix, not formal solo FPS",
    rows,
    errors,
    expectedConnectionErrors,
  };
const sanitized = (text) =>
  text.replace(/reconnectionToken=[^&\s'"]+/g, "reconnectionToken=[redacted]");
async function call(path, method = "GET", body) {
  const r = await fetch(proxy + path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert(r.ok, `Toxiproxy ${path} ${r.status}`);
  return r.status === 204 ? null : r.json();
}
async function clear() {
  for (const t of await call("/proxies/presence/toxics"))
    await call("/proxies/presence/toxics/" + t.name, "DELETE");
}
async function latency(ms, jitter = 0) {
  await clear();
  for (const stream of ["upstream", "downstream"])
    await call("/proxies/presence/toxics", "POST", {
      name: stream,
      type: "latency",
      stream,
      attributes: { latency: ms / 2, jitter },
    });
}
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
  page = await context.newPage();
await fs.writeFile(
  out + ".ownership.json",
  JSON.stringify(
    await browserOwnership(browser, {
      cdpPort: port,
      url,
      purpose: "Presence TCP latency/jitter/reconnect matrix",
      renderingClients: 1,
    }),
  ),
);
page.on("pageerror", (e) => errors.push(sanitized(e.stack)));
page.on("console", (m) => {
  if (m.type() === "error") {
    const text = sanitized(m.text());
    if (
      text.includes("WebSocket connection") &&
      text.includes("ERR_CONNECTION_REFUSED")
    )
      expectedConnectionErrors.push(text);
    else errors.push(text);
  }
});
const join = () =>
  page.evaluate(async (endpoint) => {
    const { joinPresence } = await import("/src/multiplayer/client.js");
    await joinPresence(ASHEN, endpoint);
    ASHEN.dev.god = true;
    ASHEN.setView("play");
  }, endpoint);
const state = () =>
  page.evaluate(() => {
    const a = ASHEN.presence,
      self = a.room.state.players.get(a.room.sessionId);
    return {
      id: self.id,
      movement: self.toJSON(),
      recipe: ASHEN.getAppearance(),
      capsuleHeight: ASHEN.player.heightScale,
      drift: a.prediction.drift,
      correction: a.prediction.lastCorrectionMag,
      rtt: a.room.clock.smoothedRtt(),
      jitter: a.room.clock.jitter(),
      errors: a.errors,
      gpuErrors: ASHEN.gpu.errors,
    };
  });
try {
  await page.goto(url);
  await page.waitForFunction(() => globalThis.ASHEN?.regionReady, null, {
    timeout: 90000,
  });
  for (const [ms, jitter] of process.env.ASHEN_PRESENCE_LATE_ONLY
    ? []
    : [
        [40, 0],
        [100, 0],
        [200, 0],
        [100, 25],
      ]) {
    await latency(ms, jitter);
    await join();
    await page.waitForTimeout(750);
    const before = await state();
    await page.evaluate(() => {
      globalThis.presenceSamples = [];
      globalThis.presenceTimer = setInterval(() => {
        const a = ASHEN.presence;
        presenceSamples.push({
          t: performance.now(),
          correction: a.prediction.lastCorrectionMag,
          drift: { ...a.prediction.drift },
          rtt: a.room.clock.smoothedRtt(),
          jitter: a.room.clock.jitter(),
          y: a.room.state.players.get(a.room.sessionId).y,
        });
      }, 50);
    });
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(3500);
    await page.keyboard.press("Space");
    await page.waitForTimeout(1000);
    await page.evaluate(async () => {
      const { presenceAppearance } = await import(
        "/src/multiplayer/protocol.js"
      );
      await ASHEN.presence.changeAppearance(
        presenceAppearance("warden", 0.9, 0.95),
      );
    });
    await page.waitForTimeout(1500);
    await page.keyboard.up("KeyW");
    await page.waitForTimeout(750);
    const after = await state();
    assert(after.movement.z - before.movement.z > 30);
    assert.equal(after.movement.recoveries, 0);
    assert.equal(after.capsuleHeight, 0.9);
    assert.deepEqual(
      after.recipe.shape,
      JSON.parse(after.movement.recipe).shape,
    );
    assert.deepEqual(after.gpuErrors, []);
    assert.deepEqual(after.errors, []);
    const samples = await page.evaluate(() => {
      clearInterval(presenceTimer);
      return presenceSamples;
    });
    rows.push({
      case: "latency-and-shape-while-moving",
      roundTripMs: ms,
      jitterPerDirectionMs: jitter,
      before,
      after,
      samples,
    });
    // Mid-air socket loss: native server idle integrates gravity; same identity returns.
    await page.keyboard.press("Space");
    await page.waitForTimeout(100);
    const airborne = await state();
    await call("/proxies/presence", "POST", { enabled: false });
    await page.waitForTimeout(1700);
    const authority = await (
      await fetch("http://127.0.0.1:2577/presence")
    ).json();
    assert.equal(authority.actors, 1);
    await call("/proxies/presence", "POST", { enabled: true });
    await page.waitForFunction(() => ASHEN.presence.connected, null, {
      timeout: 30000,
    });
    await page.waitForTimeout(500);
    const reconnected = await state();
    assert.equal(reconnected.id, before.id);
    assert(reconnected.movement.grounded);
    assert.equal(reconnected.movement.recoveries, 0);
    assert.equal(reconnected.recipe.shape.height, 0.9);
    rows.push({
      case: "mid-air-outage-reconnect",
      roundTripMs: ms,
      airborne,
      reconnected,
    });
    await page.evaluate(() => ASHEN.presence.leave());
    await page.waitForTimeout(100);
  }
  await clear();
  await join();
  // Bounded semantic-message fault injection delays just this real command,
  // avoiding TCP-byte corruption and an unbounded head-of-line input backlog.
  // Latency/jitter above is shaped at the actual TCP boundary; this case tests
  // the separate late-transaction uncertainty, not an extra latency profile.
  await page.evaluate(() => {
    const room = ASHEN.presence.room,
      send = room.send.bind(room);
    room.send = (type, ...args) =>
      type === "appearance"
        ? setTimeout(() => send(type, ...args), 6500)
        : send(type, ...args);
  });
  const timeout = await page.evaluate(async () => {
    const { presenceAppearance } = await import("/src/multiplayer/protocol.js");
    try {
      await ASHEN.presence.changeAppearance(
        presenceAppearance("wayfarer", 1.15, -0.95),
      );
      return false;
    } catch (e) {
      return e.message.includes("timed out");
    }
  });
  assert(timeout);
  await clear();
  await page.waitForFunction(
    () =>
      ASHEN.getAppearance().shape.height === 1.15 &&
      ASHEN.presence.room.state.players.get(ASHEN.presence.room.sessionId)
        .revision === 2,
    null,
    { timeout: 20000 },
  );
  const late = await state();
  assert.deepEqual(late.recipe, JSON.parse(late.movement.recipe));
  assert.equal(late.capsuleHeight, 1.15);
  assert.equal(late.movement.recoveries, 0);
  rows.push({ case: "late-appearance-authority-converges", state: late });
  assert.deepEqual(errors, []);
  report.passed = true;
} catch (e) {
  report.failure = sanitized(e.stack);
  report.failureState = await state().catch((e) => ({
    error: sanitized(e.message),
  }));
  process.exitCode = 1;
  console.error(sanitized(e.stack));
} finally {
  await page.keyboard.up("KeyW").catch(() => {});
  await page
    .evaluate(() => {
      clearInterval(globalThis.presenceTimer);
      return globalThis.ASHEN?.presence?.leave();
    })
    .catch(() => {});
  await clear().catch(() => {});
  await call("/proxies/presence", "POST", { enabled: true }).catch(() => {});
  await fs.writeFile(out, JSON.stringify(report, null, 2));
  await context.close();
  await browser.close();
  await fs.writeFile(
    out + ".ownership.json",
    JSON.stringify({
      owner: "root",
      cdpPort: port,
      renderingClients: 0,
      active: false,
    }),
  );
}
