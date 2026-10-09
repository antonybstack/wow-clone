/** Native menu/control and spawn-link checks. Optional live motion capture.
 * ASHEN_CDP_PORT=10037 ASHEN_TEST_URL=... ASHEN_CAPTURE_DIR=... node this-file
 */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {CDP_URL} from '../lib/cdp.mjs';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {captureSurface, appendFrame, writeCaptureManifest} from '../lib/capture-manifest.mjs';
const url = process.env.ASHEN_TEST_URL || 'http://127.0.0.1:5173/?play&clean&dev';
const dir = process.env.ASHEN_CAPTURE_DIR || '.cache/dev-destinations';
const record = process.env.ASHEN_RECORD === '1';
await fs.mkdir(`${dir}/frames`, {recursive:true});
const browser = await chromium.connectOverCDP(CDP_URL);
assert(browser.contexts().flatMap(c => c.pages()).every(p => p.url() === 'about:blank'), 'Blank owned harness pages before checking');
const ownership = await browserOwnership(browser, {cdpPort:new URL(CDP_URL).port, url, purpose:'Developer menu native check/capture; no FPS claim', renderingClients:1});
await fs.writeFile(`${dir}/ownership.json`, JSON.stringify(ownership, null, 2));
const context = await browser.newContext({viewport:{width:1280,height:720}, deviceScaleFactor:1});
const page = await context.newPage(), errors = [], report = {url, errors, destinations:[]};
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
const state = () => page.evaluate(() => {
  const p = ASHEN.player, debug = p.getDebugState();
  return {x:p.body.position.x,y:p.body.position.y,z:p.body.position.z,
    height:p.capsuleHeight,god:ASHEN.dev.god,flying:p.isFlying(),usingPhysics:debug.usingPhysics,recoveries:debug.recoveries};
});
const ready = () => page.waitForFunction(() => window.ASHEN?.ready, null, {timeout:120000});
async function tools() {
  await page.keyboard.press('Escape');
  await page.getByRole('button', {name:'Developer tools', exact:true}).click();
}
async function jump(id) {
  await page.getByLabel('Destination', {exact:true}).selectOption(id);
  const link = await page.getByLabel('Spawn link', {exact:true}).inputValue();
  assert.equal(new URL(link).searchParams.get('at'), id);
  assert(new URL(link).searchParams.has('dev'));
  await page.getByRole('button', {name:'Jump to destination', exact:true}).click();
  await page.waitForTimeout(650);
  const s = await state();
  assert(s.usingPhysics && !s.flying);
  assert(Number.isFinite(s.y));
  assert(!await page.locator('#game-menu').isVisible());
  return {id, link, state:s};
}
let cdp, manifest, captureError;
const writes = [];
try {
  const initial = new URL(url); initial.searchParams.delete('at'); initial.searchParams.set('dev','');
  await page.goto(initial.href, {waitUntil:'commit'}); await ready();
  await tools();
  const ids = await page.getByLabel('Destination', {exact:true}).locator('option').evaluateAll(options => options.map(o => o.value));
  assert(ids.includes('cathedral-nave') && ids.includes('cathedral-undercroft'));
  const before = await state();
  for (const id of ids) {
    const row = await jump(id);
    assert.equal(row.state.recoveries, before.recoveries);
    // All selected destinations must remain on their authored floor after Havok settles.
    const expected = await page.evaluate(id => {
      const k = ASHEN.world.cathedral, e = k.exploration;
      if (id === 'cathedral-undercroft') return e.undercroft.floorY;
      if (id === 'cathedral-gallery' || id === 'cathedral-parapet') return e.gallery[0][1];
      if (id.startsWith('cathedral-') && id.endsWith('-bell')) return e.towers.find(t => `cathedral-${t.id}` === id).landing[1];
      if (id === 'cathedral-bridge') return k.route.waypoints[0][1];
      if (id.startsWith('cathedral-')) return k.floorY;
      if (id === 'start') return ASHEN.world.groundHeight(ASHEN.world.spawn.x, ASHEN.world.spawn.z);
      const walk = ASHEN.world.regionStructures?.destinations.find(l => `${l.id}-wall-walk` === id)?.wallWalk;
      if (walk) return walk.floorY;
      return ASHEN.world.landmarks.find(l => l.id === id).entrance[1];
    }, id);
    assert(Math.abs(row.state.y - row.state.height / 2 - expected) < .3, `Missed floor at ${id}: ${row.state.y}`);
    report.destinations.push(row); await tools();
  }
  await jump('cathedral-nave'); await tools();
  const floor = await state();
  await page.getByRole('button', {name:'Fly mode: off', exact:true}).click(); assert((await state()).flying);
  await page.getByRole('button', {name:'Fly mode: on', exact:true}).click(); assert(!(await state()).flying);
  await page.getByRole('button', {name:'God mode: on', exact:true}).click(); assert(!(await state()).god);
  await page.getByRole('button', {name:'God mode: off', exact:true}).click(); assert((await state()).god);
  await page.getByLabel('Spawn link', {exact:true}).focus(); await page.keyboard.press('g'); assert((await state()).god);
  await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'god');
  await page.keyboard.press('Escape'); await page.waitForTimeout(650);
  assert(Math.abs((await state()).y - floor.y) < .3, 'Fly-off lost elevated nave floor');
  await page.keyboard.down('w'); await page.waitForTimeout(500); await page.keyboard.up('w');
  assert((await state()).z > floor.z + 1, 'Walking did not resume after menu');
  report.naveWalking = await state();
  const link = report.destinations.find(d => d.id === 'cathedral-undercroft').link;
  await page.goto(link, {waitUntil:'commit'}); await ready();
  const crypt = await state(); assert.equal(crypt.recoveries,0); assert(crypt.z > 323 && crypt.z < 339 && crypt.y < floor.y - 5);
  report.spawnLink = crypt;
  const nonDev = new URL(link); nonDev.searchParams.delete('dev');
  await page.goto(nonDev.href, {waitUntil:'commit'}); await ready();
  assert(Math.abs((await state()).z) < 10, 'at= activated without dev');
  await page.keyboard.press('Escape'); assert(!await page.getByRole('button', {name:'Developer tools', exact:true}).isVisible());
  await page.getByRole('button', {name:'Developer mode', exact:true}).click();
  await page.getByRole('button', {name:'Developer tools', exact:true}).click(); assert((await state()).god);
  await jump('cathedral-nave');
  if (record) {
    manifest = {version:1,...await captureSurface(page), frames:[]};
    cdp = await context.newCDPSession(page);
    cdp.on('Page.screencastFrame', e => {
      cdp.send('Page.screencastFrameAck', {sessionId:e.sessionId}).catch(()=>{});
      if (captureError) return;
      try {
        const bytes = Buffer.from(e.data, 'base64'), name = `frame-${String(manifest.frames.length).padStart(5,'0')}.jpg`;
        appendFrame(manifest, {name,timestamp:e.metadata.timestamp,bytes});
        writes.push(fs.writeFile(`${dir}/frames/${name}`,bytes).catch(e=>captureError=e));
      } catch (e) {captureError=e;}
    });
    await cdp.send('Page.startScreencast', {format:'jpeg',quality:87,maxWidth:1280,maxHeight:720,everyNthFrame:1});
    await page.waitForTimeout(1600); await tools();
    await page.waitForTimeout(2200); await jump('cathedral-nave');
    await page.waitForTimeout(1400); await page.keyboard.down('w'); await page.waitForTimeout(700); await page.keyboard.up('w');
    await tools(); await page.getByLabel('Destination', {exact:true}).selectOption('cathedral-undercroft');
    await page.waitForTimeout(2200); await jump('cathedral-undercroft');
    await page.waitForTimeout(1800); await page.keyboard.down('w'); await page.waitForTimeout(450); await page.keyboard.up('w');
    await page.waitForTimeout(1400); await tools();
    await page.getByRole('button', {name:'Fly mode: off', exact:true}).click(); await page.waitForTimeout(800);
    await page.getByRole('button', {name:'Fly mode: on', exact:true}).click(); await page.waitForTimeout(800);
    await page.keyboard.press('Escape'); await page.waitForTimeout(1000);
    await cdp.send('Page.stopScreencast'); cdp.removeAllListeners('Page.screencastFrame'); await Promise.all(writes);
    if (captureError) throw captureError;
    await writeCaptureManifest(dir,manifest,await captureSurface(page));
  }
  report.gpuErrors = await page.evaluate(() => ASHEN.gpu.errors);
  assert.deepEqual(errors,[]); assert.deepEqual(report.gpuErrors,[]); report.passed = true;
} catch(error) {
  report.failure=error.stack; await page.screenshot({path:`${dir}/failure.png`}).catch(()=>{}); throw error;
} finally {
  await page.keyboard.up('w').catch(()=>{});
  await cdp?.send('Page.stopScreencast').catch(()=>{}); await Promise.all(writes);
  await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));
  await context.close(); await browser.close();
  await fs.writeFile(`${dir}/ownership.json`,JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
}
console.log(`PASS: ${report.destinations.length} UI destinations, spawn-link gate, Fly/God, focus and walking; no runtime/GPU errors`);
