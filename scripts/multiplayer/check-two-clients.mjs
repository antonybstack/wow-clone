import { browserOwnership } from "../lib/browser-ownership.mjs";
/** Two actual WebGPU clients, explicitly owned functional workload; not FPS.
 * SDK state/reconnect is checked alongside real native input and remote actors.
 */
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const port = process.env.ASHEN_CDP_PORT,
  url = process.env.ASHEN_TEST_URL,
  out = process.argv[2];
assert(port && url && out);
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
  report = {
    url,
    endpoint,
    conditions: "Two rendering clients; functional only, no solo FPS claim",
    rows: [],
    errors: [],
  };
await fs.writeFile(
  out + ".ownership.json",
  JSON.stringify(
    await browserOwnership(browser, {
      cdpPort: port,
      url,
      purpose: "Two real presence clients",
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
    page.on("pageerror", (e) =>
      report.errors.push({ client: i, error: e.stack }),
    );
    page.on("console", (m) => {
      if (m.type() === "error")
        report.errors.push({
          client: i,
          error: m
            .text()
            .replace(
              /reconnectionToken=[^&\s'"]+/g,
              "reconnectionToken=[redacted]",
            ),
        });
    });
    await page.goto(url);
    await page.waitForFunction(
      () => globalThis.ASHEN?.ready && globalThis.ASHEN.hostilesReady,
      null,
      { timeout: 90000 },
    );
    await page.evaluate(async (endpoint) => {
      const { joinPresence } = await import("/src/multiplayer/client.js");
      await joinPresence(ASHEN, endpoint);
      ASHEN.dev.god = true;
      ASHEN.setView("play");
    }, endpoint);
  }
  await Promise.all(
    pages.map((p) =>
      p.waitForFunction(
        () => ASHEN.presence?.crowd?.snapshot().count === 1,
        null,
        { timeout: 30000 },
      ),
    ),
  );
  const ids = await Promise.all(
    pages.map((p) => p.evaluate(() => ASHEN.presence.room.sessionId)),
  );
  assert.notEqual(ids[0], ids[1]);
  report.ids = ids;
  const before = await pages[0].evaluate(() => ASHEN.presence.snapshot());
  await pages[0].keyboard.down("KeyW");
  await pages[0].waitForTimeout(1800);
  await pages[0].keyboard.up("KeyW");
  await pages[0].waitForTimeout(500);
  const after = await pages[0].evaluate(() => ASHEN.presence.snapshot()),
    seen = await pages[1].evaluate(() => ASHEN.presence.snapshot());
  assert(after.players[ids[0]].z - before.players[ids[0]].z > 5);
  assert.equal(seen.actors.actors[0].id, ids[0]);
  assert.equal(seen.players[ids[0]].recoveries, 0);
  report.rows.push({ case: "real-input-shared-movement", before, after, seen });
  const changed = await pages[0].evaluate(async () => {
    const { presenceAppearance } = await import("/src/multiplayer/protocol.js");
    return ASHEN.presence.changeAppearance(
      presenceAppearance("warden", 0.9, 0.95),
    );
  });
  assert.equal(changed.status, "applied");
  await pages[1].waitForFunction(
    ({ id, revision }) =>
      ASHEN.presence.crowd.get(id)?.appearanceRevision === revision,
    { id: ids[0], revision: changed.revision },
    { timeout: 15000 },
  );
  const appearance = await pages[1].evaluate(() => ASHEN.presence.snapshot());
  assert.equal(appearance.actors.actors[0].shape.height, 0.9);
  assert.equal(appearance.actors.actors[0].shape.build, 0.95);
  report.rows.push({ case: "remote-exact-appearance", changed, appearance });
  await pages[0].keyboard.press("Digit1");
  await pages[1].waitForFunction(
    (id) =>
      ASHEN.presence.room.state.players.get(id).clip === "Spell_Simple_Enter",
    ids[0],
  );
  report.rows.push({
    case: "source-action",
    state: await pages[1].evaluate(() => ASHEN.presence.snapshot()),
  });
  await pages[1].screenshot({ path: out.replace(".json", "-remote.png") });
  await pages[0].evaluate(() => ASHEN.presence.room.connection.close());
  await pages[0].waitForFunction(
    () => ASHEN.presence.status === "reconnecting",
  );
  await pages[0].waitForFunction(() => ASHEN.presence.connected, null, {
    timeout: 30000,
  });
  assert.equal(
    await pages[0].evaluate(() => ASHEN.presence.room.sessionId),
    ids[0],
  );
  assert.equal(
    await pages[1].evaluate(() => ASHEN.presence.room.state.players.size),
    2,
  );
  report.rows.push({
    case: "automatic-reconnect-same-identity",
    state: await pages[0].evaluate(() => ASHEN.presence.snapshot()),
  });
  await pages[0].evaluate(() => ASHEN.presence.leave());
  await pages[1].waitForFunction(
    () => ASHEN.presence.crowd.snapshot().count === 0,
  );
  report.rows.push({
    case: "departure-no-ghost",
    state: await pages[1].evaluate(() => ASHEN.presence.snapshot()),
  });
  for (const p of pages) {
    assert.deepEqual(await p.evaluate(() => ASHEN.gpu.errors), []);
    assert.deepEqual(await p.evaluate(() => ASHEN.presence.errors), []);
    await p.evaluate(() => ASHEN.presence.leave());
  }
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (e) {
  report.failure = e.stack;
  report.failureStates = await Promise.all(
    pages.map((p) =>
      p
        .evaluate(() => ({
          text: document.body.innerText.slice(-1500),
          marks: globalThis.ASHEN?.startup?.marks,
          playable: globalThis.ASHEN?.playableReady,
          ready: globalThis.ASHEN?.ready,
          backgroundError: globalThis.ASHEN?.backgroundError,
        }))
        .catch((e) => ({ error: e.message })),
    ),
  );
  process.exitCode = 1;
  console.error(e);
} finally {
  for (const p of pages) {
    await p.keyboard.up("KeyW").catch(() => {});
    await p.evaluate(() => ASHEN?.presence?.leave()).catch(() => {});
  }
  await fs.writeFile(out, JSON.stringify(report, null, 2));
  for (const c of contexts) await c.close();
  await browser.close();
  await fs.writeFile(
    out + ".ownership.json",
    JSON.stringify({
      owner: "root",
      cdpPort: Number(port),
      url,
      renderingClients: 0,
      active: false,
    }),
  );
}
