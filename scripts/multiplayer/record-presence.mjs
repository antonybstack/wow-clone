import { browserOwnership } from "../lib/browser-ownership.mjs";
/** Two actual clients; spectator records real replicated motion, no FPS claim. */
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import {
  appendFrame,
  captureSurface,
  writeCaptureManifest,
} from "../lib/capture-manifest.mjs";
const port = Number(process.env.ASHEN_CDP_PORT),
  url = process.env.ASHEN_TEST_URL,
  dir =
    process.env.ASHEN_CAPTURE_DIR ||
    "ve-capture/character-mmo/presence-2026-10-01";
assert(port && url);
await fs.mkdir(path.join(dir, "frames"), { recursive: true });
const endpoint = process.env.ASHEN_PRESENCE_URL || "http://127.0.0.1:2577";
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(
  browser
    .contexts()
    .flatMap((c) => c.pages())
    .every((p) => p.url() === "about:blank"),
);
const contexts = [],
  pages = [],
  errors = [],
  timeline = [],
  writes = [];
let cdp,
  manifest,
  recording = false;
const mark = async (label) =>
  timeline.push({
    label,
    timestamp: Date.now() / 1000,
    state: await pages[1].evaluate(() => ASHEN.presence.snapshot()),
  });
await fs.writeFile(
  dir + "/ownership.json",
  JSON.stringify(
    await browserOwnership(browser, {
      cdpPort: port,
      url,
      purpose: "Two-client replicated motion capture",
      renderingClients: 2,
    }),
  ),
);
try {
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
      }),
      page = await context.newPage();
    contexts.push(context);
    pages.push(page);
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
    await page.goto(url);
    await page.waitForFunction(() => globalThis.ASHEN?.regionReady, null, {
      timeout: 90000,
    });
    if (process.env.ASHEN_CAPTURE_UI) {
      await page.locator("#presence-entry summary").click();
      await page.getByRole("button", { name: "Join", exact: true }).click();
      await page.waitForFunction(() => ASHEN.presence?.connected);
      await page.locator("#presence-entry summary").click();
    } else
      await page.evaluate(async (endpoint) => {
        const { joinPresence } = await import("/src/multiplayer/client.js");
        await joinPresence(ASHEN, endpoint);
      }, endpoint);
    await page.evaluate(() => {
      ASHEN.dev.god = true;
      ASHEN.setView("play");
    });
  }
  const [source, observer] = pages;
  await observer.waitForFunction(
    () => ASHEN.presence.crowd.snapshot().count === 1,
  );
  for (const page of pages)
    await page.evaluate(() => ASHEN.metrics.setInternalResolution(1280, 720));
  await observer.evaluate(() => {
    ASHEN.rig.yaw = 0;
    ASHEN.rig.pitch = -0.12;
    ASHEN.rig.distance = ASHEN.rig.distanceTarget = 4.8;
  });
  await source.keyboard.down("KeyW");
  await source.waitForTimeout(750);
  await source.keyboard.up("KeyW");
  await source.waitForTimeout(400);
  manifest = {
    schemaVersion: 1,
    sourceUrl: url,
    ...(await captureSurface(observer)),
    frames: [],
    timeline,
    errors,
    conditions:
      "Two rendering clients; camera-adjusted spectator, ordinary movement/action inputs; no FPS claim",
  };
  cdp = await contexts[1].newCDPSession(observer);
  cdp.on("Page.screencastFrame", (e) => {
    void cdp
      .send("Page.screencastFrameAck", { sessionId: e.sessionId })
      .catch(() => {});
    if (!recording) return;
    try {
      const name = `frame-${String(manifest.frames.length).padStart(6, "0")}.jpg`,
        bytes = Buffer.from(e.data, "base64");
      appendFrame(manifest, { name, timestamp: e.metadata.timestamp, bytes });
      writes.push(fs.writeFile(path.join(dir, "frames", name), bytes));
    } catch (e) {
      errors.push(e.stack);
      recording = false;
    }
  });
  recording = true;
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 88,
    maxWidth: 1280,
    maxHeight: 720,
    everyNthFrame: 2,
  });
  await mark("Two real clients; remote neutral Wayfarer");
  await observer.waitForTimeout(1500);
  await source.evaluate(async () => {
    const { presenceAppearance } = await import("/src/multiplayer/protocol.js");
    await ASHEN.presence.changeAppearance(
      presenceAppearance("wayfarer", 1.15, -0.95),
    );
  });
  await mark("Tall/slender Wayfarer; one accepted server revision");
  await observer.waitForTimeout(1800);
  await observer.evaluate(() => {
    // Diagnostic spectator follow reuses the real spring arm and Havok sweep.
    // Only the camera target changes; actors remain server-driven and rendered.
    const update = ASHEN.rig.update.bind(ASHEN.rig);
    ASHEN.rig.distance = ASHEN.rig.distanceTarget = 3.2;
    ASHEN.rig.yaw = Math.PI + 0.3;
    ASHEN.rig.update = (dt, feet) => {
      const actor = ASHEN.presence.crowd.snapshot().actors[0],
        remote = actor && ASHEN.presence.crowd.get(actor.id);
      if (remote)
        update(dt, {
          ...remote.transform,
          y: remote.transform.y + (1.748 * remote.recipe.shape.height) / 2,
        });
      else update(dt, feet);
    };
  });
  await mark("Close diagnostic spectator view of the real remote actor");
  await observer.waitForTimeout(1000);
  await source.keyboard.down("KeyA");
  await source.waitForTimeout(1000);
  await source.keyboard.up("KeyA");
  await source.keyboard.down("KeyW");
  await source.waitForTimeout(900);
  await source.keyboard.up("KeyW");
  await mark("Source-compatible walk and turn, authoritative Havok position");
  await observer.waitForTimeout(800);
  await source.evaluate(async () => {
    const { presenceAppearance } = await import("/src/multiplayer/protocol.js");
    await ASHEN.presence.changeAppearance(
      presenceAppearance("warden", 0.9, 0.95),
    );
  });
  await mark("Short/stout Warden; outfit and shape synchronize");
  await observer.waitForTimeout(2200);
  await source.keyboard.press("Digit1");
  await mark("Replicated source cast gesture; combat remains solo");
  await observer.waitForTimeout(1500);
  await source.keyboard.press("KeyT");
  await observer.waitForTimeout(1400);
  await source.keyboard.press("Space");
  await source.waitForTimeout(100);
  await source.evaluate(() => ASHEN.presence.room.connection.close());
  await mark("Mid-air drop; authority continues gravity");
  await source.waitForFunction(() => ASHEN.presence.connected, null, {
    timeout: 30000,
  });
  await observer.waitForTimeout(1300);
  await mark("Native reconnect retains actor ID and appearance");
  await source.evaluate(() => ASHEN.presence.leave());
  await observer.waitForFunction(
    () => ASHEN.presence.crowd.snapshot().count === 0,
  );
  await mark("Departure disposes the remote; no ghost");
  await observer.waitForTimeout(1200);
  for (const p of pages) {
    assert.deepEqual(await p.evaluate(() => ASHEN.gpu.errors), []);
    assert.deepEqual(await p.evaluate(() => ASHEN.presence.errors), []);
  }
  assert.deepEqual(errors, []);
  recording = false;
  await cdp.send("Page.stopScreencast");
  await Promise.all(writes);
  await writeCaptureManifest(dir, manifest, await captureSurface(observer));
  console.log(
    JSON.stringify({
      dir,
      frames: manifest.frames.length,
      seconds: manifest.elapsedSeconds,
    }),
  );
} finally {
  recording = false;
  for (const p of pages) {
    await p.keyboard.up("KeyW").catch(() => {});
    await p.keyboard.up("KeyA").catch(() => {});
    await p.evaluate(() => globalThis.ASHEN?.presence?.leave()).catch(() => {});
  }
  await cdp?.send("Page.stopScreencast").catch(() => {});
  await Promise.allSettled(writes);
  for (const c of contexts) await c.close();
  await browser.close();
  await fs.writeFile(
    dir + "/ownership.json",
    JSON.stringify({
      owner: "root",
      cdpPort: port,
      renderingClients: 0,
      active: false,
    }),
  );
}
