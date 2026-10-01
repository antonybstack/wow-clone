/** Run alone on an uncapped harness. No capture/encoding/workers during frame sampling.
 * ASHEN_BENCH_RACE and ASHEN_BENCH_OUTFIT select the *actual* streamed actor and
 * gear. ASHEN_BENCH_ORC_ASSETS_DIR can substitute a prior Orc manifest/glove pair
 * for a controlled old/new asset comparison without mutating the public pack.
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import os from "node:os";
import assert from "node:assert/strict";
import { CDP_URL } from '../lib/cdp.mjs';
import { summarizeDurations, detectVsyncCap } from '../../src/ashen-reach/metrics.js';
import { summarizeFrameIntervals } from './summarize-frame-intervals.mjs';
assert(process.env.ASHEN_CDP_PORT&&process.env.ASHEN_TEST_URL,'Select the audited owned harness');
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
const browser = await chromium.connectOverCDP(CDP_URL),
  context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  }),
  page = await context.newPage();
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
  },
  rows: [],
  errors: [],
};
assert(browser.contexts().flatMap(c=>c.pages()).filter(p=>p!==page).every(p=>p.url()==='about:blank'),'Other owned pages must be closed before benchmarking');
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
try {
  await page.goto(url.href);
  await page.waitForFunction(() => globalThis.ASHEN?.ready, null, {
    timeout: 90000,
  });
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
  if(process.env.ASHEN_BENCH_BUILD||process.env.ASHEN_BENCH_HEIGHT){
    await page.evaluate(async shape=>{await ASHEN.creator.set('build',shape.build);await ASHEN.creator.set('height',shape.height);},{build:Number(process.env.ASHEN_BENCH_BUILD||0),height:Number(process.env.ASHEN_BENCH_HEIGHT||1)});
    report.conditions.appearance=await page.evaluate(()=>ASHEN.getAppearance());
    await page.waitForTimeout(3000);
  }
  await page.evaluate(() => {
    ASHEN.dev.god = true;
    ASHEN.setView("play");
  });
  await page.waitForFunction(()=>ASHEN.hostilesReady,null,{timeout:90000});
  const count=Number(process.env.ASHEN_BENCH_CROWD_COUNT||1);
  report.conditions.crowd={count,source:'region-crowd',centerZ:106,capacityClaim:false};
  report.mount=await page.evaluate(async count=>{
    ASHEN.renderLoop.beginMeasurement();const t=performance.now();
    const {createRegionCrowd}=await import('/src/character/region-crowd/renderer.js');
    const {createRegionActor}=await import('/src/character/region-crowd/actor-state.js');
    const {decodePreparedCrowdAppearance}=await import('/src/character/crowd-probe/batches.js');
    globalThis.REGION_CROWD=await createRegionCrowd(ASHEN);
    const manifest=REGION_CROWD.resources().prepared.manifest;
    for(let i=0;i<count;i++){
      const outfit=i%2?'warden':'wayfarer',x=(i%Math.ceil(Math.sqrt(count))-(Math.ceil(Math.sqrt(count))-1)/2)*1.8,z=106+Math.floor(i/Math.ceil(Math.sqrt(count)))*1.8;
      const actor=createRegionActor({id:`bench-${i}`,recipe:decodePreparedCrowdAppearance(manifest.variants[outfit].recipe),transform:{x,y:ASHEN.world.groundHeight(x,z),z,yaw:i*.1},motion:{clip:'Walk_Loop',loop:true,startedAt:0,offsetSeconds:i*.137}});
      await REGION_CROWD.set(actor);
    }
    return {ms:performance.now()-t};
  },count);
  await page.waitForTimeout(3000);
  report.mount.frames=await page.evaluate(()=>ASHEN.renderLoop.endMeasurement());
  report.mount.tails=summarizeFrameIntervals(report.mount.frames);
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
}
