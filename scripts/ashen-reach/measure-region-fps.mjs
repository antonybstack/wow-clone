/** Run alone on an uncapped harness. No capture/profiling during frame sampling.
 * ASHEN_BENCH_RACE and ASHEN_BENCH_OUTFIT select the *actual* streamed actor and
 * gear. ASHEN_BENCH_ORC_ASSETS_DIR can substitute a prior Orc manifest/glove pair
 * for a controlled old/new asset comparison without mutating the public pack.
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import os from "node:os";
import assert from "node:assert/strict";
import {browserOwnership} from '../lib/browser-ownership.mjs';
import { CDP_URL } from "../lib/cdp.mjs";
import { summarizeDurations, detectVsyncCap } from "../../src/ashen-reach/metrics.js";
import { summarizeFrameIntervals } from "../character-assets/summarize-frame-intervals.mjs";
import {migrateAppearance} from '../../src/character/appearance/contract.js';
const file = process.argv[2];
assert(file, "Specify report.json");
const url = new URL(
  process.env.ASHEN_TEST_URL || "http://127.0.0.1:7074/?play&clean",
);
for (const [k, v] of [
  ["pixelRatio", "1"],
  ["gpuTiming", ""],
])
  url.searchParams.set(k, v);
const runs = Number(process.env.ASHEN_FPS_RUNS || 3),
  seconds = 12;
const race = process.env.ASHEN_BENCH_RACE || 'human';
assert(['human', 'orc', 'undead'].includes(race), `Unsupported benchmark race: ${race}`);
const outfit = process.env.ASHEN_BENCH_OUTFIT || '';
const orcAssetsOverride = process.env.ASHEN_BENCH_ORC_ASSETS_DIR || '';
assert(!orcAssetsOverride || race === 'orc', 'Orc asset override requires ASHEN_BENCH_RACE=orc');
const routes = [
  ['meadow', 0, -65, 0], ['town', 0, 80, 0], ['bridge', 0, 210, 0],
  ['cathedral', 0, 280, 0], ['forest', -80, 180, -Math.PI / 2],
];
const selected = new Set((process.env.ASHEN_FPS_ROUTES || routes.map(r => r[0]).join(','))
  .split(',').filter(Boolean));
assert([...selected].every(name => routes.some(r => r[0] === name)), 'Unknown benchmark route');
const recordCapped = process.env.ASHEN_RECORD_CAPPED === '1';
const savedAppearance=process.env.ASHEN_BENCH_APPEARANCE
  ? JSON.parse(await fs.readFile(process.env.ASHEN_BENCH_APPEARANCE,'utf8')) : null;
const expectedAppearance=savedAppearance?migrateAppearance(savedAppearance):null;
assert(!savedAppearance||(!outfit&&race==='human'&&!process.env.ASHEN_BENCH_SHOULDERS&&!process.env.ASHEN_BENCH_BUILD&&!process.env.ASHEN_BENCH_HEIGHT),
  'A saved appearance must be measured without conflicting equipment/shape overrides');
const browser = await chromium.connectOverCDP(CDP_URL);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned page is active; isolate before benchmarking');
const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  }),
  page = await context.newPage();
// Exercise the real saved-character startup, rather than calling a preset the
// "largest outfit" when its individual items differ from the accepted fixture.
if(savedAppearance)await context.addInitScript(recipe=>localStorage.setItem('ashen.appearance.v2',JSON.stringify(recipe)),savedAppearance);
const report = {
  conditions: {
    cpu: os.cpus()[0].model,
    url: url.href,
    viewport: [1280, 720],
    seconds,
    runs,
    uncappedRequired: true,
    recording: false,
    race,
    outfit: outfit || null,
    orcAssetsOverride: orcAssetsOverride || null,
    routes: [...selected],
    recordCapped,
    savedAppearance:expectedAppearance,
  },
  rows: [],
  errors: [],
};
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") report.errors.push(m.text());
});
if (orcAssetsOverride) {
  // Substitute the prior pack at request time for a paired asset benchmark.
  // The manifest and GLB move together so hash validation still exercises the
  // ordinary streamed-equipment path. No request is patched after loading.
  const manifest = await fs.readFile(`${orcAssetsOverride}/manifest.json`);
  const glove = await fs.readFile(`${orcAssetsOverride}/graveweaverGloves.glb`);
  await page.route('**/ashen-reach/equipment-orc/manifest.json', r => r.fulfill({status: 200, contentType: 'application/json', body: manifest}));
  await page.route('**/ashen-reach/equipment-orc/graveweaverGloves.glb', r => r.fulfill({status: 200, contentType: 'model/gltf-binary', body: glove}));
}
const ownership=await browserOwnership(browser,{cdpPort:process.env.ASHEN_CDP_PORT||9337,url:url.href,purpose:'Isolated actual-region FPS measurement without recording',renderingClients:1});
await fs.writeFile(file+'.ownership.json',JSON.stringify(ownership,null,2));
try {
  await page.goto(url.href);
  await page.waitForFunction(() => globalThis.ASHEN?.ready, null, {
    timeout: 90000,
  });
  if(savedAppearance){
    assert.deepEqual(await page.evaluate(()=>ASHEN.getAppearance()),expectedAppearance);
    // Settle full clothing detail through the existing equipment transaction.
    // Selected bodies already retain exact playable motion; do not download
    // the unused full source library to manufacture a settled benchmark.
    // Startup latency is measured separately with compact clothing intact.
    const result=await page.evaluate(()=>ASHEN.equipment.setLoadout(ASHEN.getAppearance().equipment));
    assert.equal(result.status,'applied');
    await page.waitForTimeout(3000);
  }
  // The URL's `race` parameter does not select the playable actor. Use the same
  // race-switch path as gameplay and assert the settled state before sampling;
  // otherwise an Undead-labelled run silently measures Human.
  if (race !== 'human') await page.evaluate(r => ASHEN.equipment.switchRace(r), race);
  assert.equal(await page.evaluate(() => ASHEN.equipment.race), race);
  if (outfit) {
    const applied = await page.evaluate(id => {
      const preset = ASHEN.equipment.presets[id];
      if (!preset) throw Error(`Unknown benchmark outfit ${id}`);
      return ASHEN.equipment.setLoadout(preset.loadout);
    }, outfit);
    assert.equal(applied.status, 'applied', `Outfit ${outfit} failed to equip`);
    assert.equal(await page.evaluate(() => ASHEN.equipment.getStatus().pending), false);
  }
  if(process.env.ASHEN_BENCH_SHOULDERS){
    const result=await page.evaluate(id=>ASHEN.equipment.equip('shoulders',id),process.env.ASHEN_BENCH_SHOULDERS);
    assert.equal(result.status,'applied');
    report.conditions.shoulders=process.env.ASHEN_BENCH_SHOULDERS;
  }
  if(process.env.ASHEN_BENCH_BUILD||process.env.ASHEN_BENCH_HEIGHT){
    await page.evaluate(async shape=>{await ASHEN.creator.set('build',shape.build);await ASHEN.creator.set('height',shape.height);},{build:Number(process.env.ASHEN_BENCH_BUILD||0),height:Number(process.env.ASHEN_BENCH_HEIGHT||1)});
    report.conditions.appearance=await page.evaluate(()=>ASHEN.getAppearance());
    await page.waitForTimeout(3000);
  }
  await page.evaluate(() => {
    ASHEN.dev.god = true;
    ASHEN.setView("play");
  });
  for (const [route, x, z, yaw] of routes.filter(r => selected.has(r[0])))
    for (let run = 1; run <= runs; run++) {
      await page.evaluate(
        ({ x, z, yaw }) => {
          const a = ASHEN,
            k = a.world.cathedral,
            y =
              x === 0 && z >= k.route.start[2]
                ? k.route.heightAt(z)
                : a.world.groundHeight(x, z);
          a.player.setFlying(false);
          a.player.setWorldPos(x, y + 1.7, z);
          a.player.setFacing(yaw);
          a.rig.yaw = yaw;
          a.rig.pitch = -0.16;
          a.rig.distance = a.rig.distanceTarget = 4;
        },
        { x, z, yaw },
      );
      await page.waitForTimeout(1200);
      await page.keyboard.down("KeyW");
      await page.waitForTimeout(800);
      const before = await page.evaluate(() => {
        ASHEN.metrics.reset();
        ASHEN.renderLoop.beginMeasurement();
        return {
          x: ASHEN.player.body.position.x,
          z: ASHEN.player.body.position.z,
          recoveries: ASHEN.player.getDebugState().recoveries,
        };
      });
      await page.waitForTimeout(seconds * 1000);
      const row = await page.evaluate(() => ({
        frames: ASHEN.renderLoop.endMeasurement(),
        summary: ASHEN.metrics.summary(),
        x: ASHEN.player.body.position.x,
        z: ASHEN.player.body.position.z,
        recoveries: ASHEN.player.getDebugState().recoveries,
        enemies: ASHEN.combat.enemies.length,
        physics: ASHEN.player.getDebugState().usingPhysics,
      }));
      await page.keyboard.up("KeyW");
      Object.assign(row, {
        route,
        run,
        before,
        fullWindow: summarizeDurations(row.frames),
        // The HUD retains only 600 samples. A near-240 Hz tail can flag its
        // rolling window even when the complete 12-second sample is uncapped.
        // Keep both diagnostics; judge this benchmark's complete measurement.
        fullWindowCap: detectVsyncCap(row.frames),
        tails: summarizeFrameIntervals(row.frames),
      });
      if (process.env.ASHEN_FPS_RAW !== "1") delete row.frames;
      report.rows.push(row);
      await fs.writeFile(file, JSON.stringify(report, null, 2));
      assert(row.physics);
      assert.equal(row.enemies, 7);
      assert.equal(row.recoveries, before.recoveries);
      assert.deepEqual(row.summary.resolution, [1280, 720]);
      // A possible compositor ceiling is retained as invalid throughput evidence
      // when explicitly requested, so a suspect route cannot hide later routes.
      if (!recordCapped) assert(!row.fullWindowCap.vsyncCapped);
      assert(Math.hypot(row.x - before.x, row.z - before.z) > 10);
      console.log(
        JSON.stringify({
          route,
          run,
          ...row.fullWindow,
          gpuMeanMs: row.summary.gpuMeanMs,
          capped: row.fullWindowCap.vsyncCapped,
          rollingCapHint: row.summary.vsyncCapped,
        }),
      );
    }
  assert.deepEqual(report.errors, []);
} finally {
  await page.keyboard.up("KeyW").catch(() => {});
  await fs.writeFile(file, JSON.stringify(report, null, 2));
  await context.close();
  await browser.close();
  await fs.writeFile(file+'.ownership.json',JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
}
