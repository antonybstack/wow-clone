/** One touch-capable real client and one non-rendering observer; no FPS claim. */
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
import { browserOwnership } from "../lib/browser-ownership.mjs";
const port = Number(process.env.ASHEN_CDP_PORT),
  url = process.env.ASHEN_TEST_URL,
  out = process.argv[2];
assert(port && url && out);
const endpoint = "http://127.0.0.1:2577",
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(
  browser
    .contexts()
    .flatMap((c) => c.pages())
    .every((p) => p.url() === "about:blank"),
);
const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    deviceScaleFactor: 1,
  }),
  page = await context.newPage(),
  errors = [],
  rows = [],
  report = {
    url,
    conditions:
      "Desktop Chromium WebGPU with native touch injection; one real client/one protocol peer; not physical iPhone acceptance",
    rows,
    errors,
  };
let peer;
page.on("pageerror", (e) => errors.push(e.message));
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
      purpose: "Real entry/touch actions/cancellation",
      renderingClients: 1,
    }),
  ),
);
const tap = async (selector) => {
  const b = await page.locator(selector).boundingBox();
  assert(b);
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
};
try {
  await page.goto(url);
  await page.waitForFunction(() => globalThis.ASHEN?.regionReady, null, {
    timeout: 90000,
  });
  await tap("#presence-entry summary");
  await tap("#presence-entry > button:first-of-type");
  await page.waitForFunction(() => ASHEN.presence?.connected);
  await page.evaluate(() => {
    ASHEN.dev.god = true;
    ASHEN.setView("play");
  });
  const id = await page.evaluate(() => ASHEN.presence.room.sessionId),
    h = await (await fetch(endpoint + "/presence")).json();
  peer = await new Client(endpoint).joinById(h.roomId, {
    protocol: PRESENCE_PROTOCOL,
    catalogVersion: PRESENCE_CATALOG,
    collisionHash: COLLISION_RELEASE.collisionHash,
    recipe: presenceAppearance(),
  });
  if (!peer.state?.players?.get(id))
    await new Promise((r) => peer.onStateChange.once(r));
  await tap("#presence-entry summary");
  await tap('[data-spell="1"]');
  for (
    let i = 0;
    i < 50 && peer.state.players.get(id).clip !== "Spell_Simple_Enter";
    i++
  )
    await page.waitForTimeout(20);
  assert.equal(peer.state.players.get(id).clip, "Spell_Simple_Enter");
  rows.push({ case: "native-touch-spell-replicates" });
  await page.waitForTimeout(1000);
  await tap(".touch-attack");
  for (
    let i = 0;
    i < 50 && peer.state.players.get(id).clip !== "Sword_Attack";
    i++
  )
    await page.waitForTimeout(20);
  assert.equal(peer.state.players.get(id).clip, "Sword_Attack");
  rows.push({ case: "native-touch-attack-replicates" });
  await tap("#presence-entry summary");
  await page.getByLabel("Shared outfit").selectOption("warden");
  await page
    .locator("#presence-entry")
    .getByRole("spinbutton", { name: "Height", exact: true })
    .fill("0.9");
  await page
    .locator("#presence-entry")
    .getByRole("spinbutton", { name: "Build", exact: true })
    .fill("0.95");
  await page
    .getByRole("button", { name: "Apply character", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      ASHEN.presence.room.state.players.get(ASHEN.presence.room.sessionId)
        .revision === 2,
  );
  await page.waitForTimeout(200);
  assert.deepEqual(
    await page.evaluate(() => ASHEN.getAppearance()),
    JSON.parse(peer.state.players.get(id).recipe),
  );
  assert.equal(await page.evaluate(() => ASHEN.player.heightScale), 0.9);
  rows.push({ case: "entry-appearance-authority-agrees" });
  await page
    .locator("#presence-entry")
    .getByRole("spinbutton", { name: "Height", exact: true })
    .fill("1.2");
  await page
    .getByRole("button", { name: "Apply character", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector("#presence-entry [role=status]")
      .textContent.includes("reviewed domain"),
  );
  assert.equal(peer.state.players.get(id).revision, 2);
  rows.push({ case: "invalid-height-preserves-accepted-appearance" });
  await page
    .locator("#presence-entry")
    .getByRole("spinbutton", { name: "Height", exact: true })
    .fill("1.15");
  await page.evaluate(() => {
    const original = ASHEN.equipment.setLoadout;
    ASHEN.equipment.setLoadout = async (...args) => {
      await new Promise((r) => setTimeout(r, 400));
      return original(...args);
    };
  });
  await page
    .getByRole("button", { name: "Apply character", exact: true })
    .click();
  await page.waitForFunction(() => ASHEN.presence.appearanceApplying);
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  await page.waitForFunction(() => ASHEN.presence.closed);
  await page.waitForTimeout(700);
  assert.equal(peer.state.players.size, 1);
  assert(
    await page.getByRole("button", { name: "Join", exact: true }).isEnabled(),
  );
  assert.deepEqual(await page.evaluate(() => ASHEN.gpu.errors), []);
  rows.push({
    case: "leave-during-local-preparation-cancels-late-online-work",
    status: await page.locator("#presence-entry [role=status]").innerText(),
  });
  assert.deepEqual(errors, []);
  report.passed = true;
} catch (e) {
  report.failure = e.stack;
  process.exitCode = 1;
  console.error(e);
} finally {
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
