/** Mobile-sized real WebGPU rendering, native Chromium touch, and interrupted input.
 * WebKit uses keyboard travel: Playwright's WebKit touchscreen only supports taps.
 * This is desktop WebKit, not proof of acceptance on an iPhone GPU/compositor.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium, webkit} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';
import {browserOwnership} from '../lib/browser-ownership.mjs';

const kind = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const url = process.env.ASHEN_TEST_URL || 'http://127.0.0.1:5173/ashen-reach.html?play&clean';
const injectDepthFailure = process.argv.includes('--inject-depth-bundle-failure');
const disableDepthFallback = process.argv.includes('--disable-depth-fallback');
const identityControls = process.argv.includes('--identity-controls');
assert(!identityControls||process.argv.includes('--customization-controls'),'Identity controls require the customization check');
assert(!disableDepthFallback || injectDepthFailure, 'disabling the fallback is only for the injected negative control');
const dir = process.env.ASHEN_CAPTURE_DIR || `ve-capture/ashen-reach/iphone-regression/${kind}${disableDepthFallback ? '-depth-rejected' : injectDepthFailure ? '-depth-fallback' : ''}-runtime`;
await fs.mkdir(dir, {recursive: true});
const beforePids=new Set(execFileSync('ps',['-axo','pid='],{encoding:'utf8'}).trim().split(/\s+/));
const browser = kind === 'webkit' ? await webkit.launch({headless: true}) : await chromium.connectOverCDP(CDP_URL);
if(kind==='chromium')assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned game page is active');
const context = await browser.newContext({viewport: {width: 430, height: 734}, deviceScaleFactor: 3, isMobile: true, hasTouch: true});
const page = await context.newPage();
const savedAppearance=process.env.ASHEN_PROBE_APPEARANCE?JSON.parse(await fs.readFile(process.env.ASHEN_PROBE_APPEARANCE,'utf8')):null;
if(savedAppearance)await context.addInitScript(recipe=>localStorage.setItem('ashen.appearance.v2',JSON.stringify(recipe)),savedAppearance);
const ownedProcesses=execFileSync('ps',['-axo','pid=,command='],{encoding:'utf8'}).split('\n').filter(line=>/MiniBrowser|Playwright|WebKit.*Process/.test(line)&&!beforePids.has(line.trim().split(/\s+/)[0])).map(line=>line.trim());
const ownership={owner:'root',controllerPid:process.pid,cdpUrl:kind==='chromium'?CDP_URL:null,ownedProcesses,url,purpose:`${kind} mobile customization runtime check`,active:true,renderingClients:1,
 ...(kind==='chromium'?await browserOwnership(browser,{cdpPort:new URL(CDP_URL).port,url,purpose:'Chromium mobile customization runtime check',renderingClients:1}):{browserPid:Number(ownedProcesses.find(line=>line.includes('MiniBrowser'))?.split(/\s+/)[0])||null})};
await fs.writeFile(`${dir}/ownership.json`,JSON.stringify(ownership));
const errors = [], checks = [], frames = [], writes = [];
const report = {kind, url, injectDepthFailure, disableDepthFallback, device: 'desktop engine with mobile viewport/touch emulation', errors, checks};
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => {
  window.__gpuFailures = [];
  const request = GPUAdapter.prototype.requestDevice;
  GPUAdapter.prototype.requestDevice = async function (...args) {
    const device = await request.apply(this, args);
    device.addEventListener('uncapturederror', e => window.__gpuFailures.push(e.error.message));
    device.lost.then(info => window.__gpuFailures.push(`device lost: ${info.reason}: ${info.message}`));
    return device;
  };
});
if (injectDepthFailure) await page.addInitScript(() => {
  // Emulate WebKit 319980 with a REAL WebGPU validation error. Poison only
  // vertex-only depth bundles; color bundles and the fallback stay native.
  const depthOnly = new WeakSet();
  const createPipeline = GPUDevice.prototype.createRenderPipeline;
  GPUDevice.prototype.createRenderPipeline = function (descriptor) {
    const pipeline = createPipeline.call(this, descriptor);
    if (descriptor.depthStencil && !descriptor.fragment) depthOnly.add(pipeline);
    return pipeline;
  };
  const createBundle = GPUDevice.prototype.createRenderBundleEncoder;
  GPUDevice.prototype.createRenderBundleEncoder = function (descriptor) {
    const bundle = createBundle.call(this, descriptor), setPipeline = bundle.setPipeline.bind(bundle);
    bundle.setPipeline = pipeline => {
      if (depthOnly.has(pipeline)) bundle.draw(3); // Missing pipeline invalidates this native bundle.
      setPipeline(pipeline);
    };
    return bundle;
  };
});
if (disableDepthFallback) await page.route('**/src/ashen-reach/sun-shadows.js*', async route => {
  const response = await route.fetch(), source = await response.text();
  const marker = /(export function createSunShadows[^\n]*\{\n)/;
  assert(marker.test(source), 'negative control requires the local Vite module');
  await route.fulfill({response, body: source.replace(marker, '$1  depthOnlyFragment = false; // test: emulate pre-fix caster\n')});
});
const pos = () => page.evaluate(() => { const p = ASHEN.player.body.position; return {x: p.x, z: p.z}; });
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
let cdp, recording = false;
async function touch(type, points = []) {
  await cdp.send('Input.dispatchTouchEvent', {type, touchPoints: points.map(p => ({radiusX: 4, radiusY: 4, force: 1, ...p}))});
}
async function pressStick(id = 1) {
  const r = await page.locator('.touch-stick').boundingBox();
  const p = {id, x: r.x + r.width / 2, y: r.y + r.height / 2};
  await touch('touchStart', [p]);
  await touch('touchMove', [{...p, y: p.y - 44}]);
  return {...p, y: p.y - 44};
}
async function stopped(name) {
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => ASHEN.input.forward), 0, `${name}: held input was not cleared`);
  checks.push({name});
}
// Test composited pixels, not just JavaScript positions or offscreen GPU buffers.
// The middle world strip avoids fixed HUD panels and most of the player model.
async function pixels(name) {
  const png = await page.screenshot({path: `${dir}/${name}.png`, scale: 'css'});
  const data = await page.evaluate(async base64 => {
    const img = new Image(); img.src = `data:image/png;base64,${base64}`; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 40;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 4, img.height * .37, img.width - 8, img.height * .22, 0, 0, 80, 40);
    return Array.from(ctx.getImageData(0, 0, 80, 40).data);
  }, png.toString('base64'));
  let black = 0;
  for (let i = 0; i < data.length; i += 4) black += Math.max(data[i], data[i + 1], data[i + 2]) < 8;
  assert(black / (data.length / 4) < .85, `${name}: canvas appears black`);
  return data;
}
try {
  await page.goto(url, {waitUntil: 'commit'});
  await page.waitForFunction(() => window.ASHEN?.ready && ASHEN.hostilesReady, null, {timeout: 120000});
  if(savedAppearance){report.appearance=await page.evaluate(()=>ASHEN.getAppearance());assert.deepEqual(report.appearance,savedAppearance);}
  report.loadedScripts = await page.evaluate(() => [...document.scripts].map(s => s.src).filter(Boolean));
  if (process.env.ASHEN_EXPECT_BUNDLE) assert(report.loadedScripts.some(src => src.endsWith(process.env.ASHEN_EXPECT_BUNDLE)), 'Production page must load the expected release bundle');
  await page.bringToFront();
  assert(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), 'requires coarse pointer, not just a narrow viewport');
  assert(await page.locator('.touch-stick').isVisible());
  await page.evaluate(() => { ASHEN.dev.god = true; });
  if(process.argv.includes('--local-lights')||process.argv.includes('--street-lights')){
    const z=process.argv.includes('--street-lights')?90:40;
    await page.evaluate(z=>{const a=ASHEN;a.player.setWorldPos(0,a.world.groundHeight(0,z)+1.7,z);a.rig.yaw=0;a.player.setFacing(0);},z);
    await page.waitForTimeout(700);
    report.localLights=await page.evaluate(()=>ASHEN.localLights.state);
  }
  report.runtime = await page.evaluate(() => ({ua: navigator.userAgent, physics: ASHEN.player.getDebugState().usingPhysics, canvas: [ASHEN.engine.canvas.width, ASHEN.engine.canvas.height], post: ASHEN.post}));
  assert(report.runtime.physics, 'Havok must be active');
  report.compatibility = await page.evaluate(() => ASHEN.gpu);
  if (injectDepthFailure) {
    assert.equal(report.compatibility.depthBundle, 'empty-fragment');
  }
  if (kind === 'chromium') {
    cdp = await context.newCDPSession(page);
    if (process.argv.includes('--record')) {
      await fs.mkdir(`${dir}/frames`, {recursive: true});
      cdp.on('Page.screencastFrame', e => {
        cdp.send('Page.screencastFrameAck', {sessionId: e.sessionId}).catch(() => {});
        const name = `frame-${String(frames.length).padStart(5, '0')}.jpg`;
        frames.push({name, ts: e.metadata.timestamp});
        writes.push(fs.writeFile(`${dir}/frames/${name}`, Buffer.from(e.data, 'base64')));
      });
      await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 85, maxWidth: 430, maxHeight: 734, everyNthFrame: 1});
      recording = true;
    }
  }
  if(process.argv.includes('--customization-controls')) {
    await page.locator('#armory-launch').tap();
    const control=page.locator('.creator-section input[aria-label="Build"]');
    await control.scrollIntoViewIfNeeded();const box=await control.boundingBox();
    const before=await page.evaluate(()=>ASHEN.getAppearance().shape.build);
    await page.touchscreen.tap(box.x+box.width*.25,box.y+box.height*.5);
    await page.evaluate(()=>ASHEN.creator.settled());
    const after=await page.evaluate(()=>ASHEN.getAppearance().shape.build);
    assert.notEqual(after,before,'native touch must edit the body control');
    await page.screenshot({path:`${dir}/body-controls.png`,scale:'css'});
    checks.push({name:'touch-body-control',before,after});
    // Exercise the narrow-layout select/change path separately from the native
    // touch drag above; selectOption does not prove the OS colour picker UI.
    const colour=page.locator('[data-dye="torso"]');
    await colour.scrollIntoViewIfNeeded();
    const beforeColour=await page.evaluate(()=>ASHEN.getAppearance().dyes.torso||'undyed');
    const nextColour=beforeColour==='moss'?'oxblood':'moss';
    await colour.selectOption(nextColour);
    await page.waitForFunction(id=>ASHEN.getAppearance().dyes.torso===id,nextColour);
    await page.evaluate(()=>ASHEN.creator.settled());
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ashen.appearance.v2')).dyes.torso),nextColour);
    await page.screenshot({path:`${dir}/colour-controls.png`,scale:'css'});
    checks.push({name:'mobile-layout-colour-select-and-persistence',before:beforeColour,after:nextColour});
    if(identityControls){
      const identity=page.getByLabel('Face and hair',{exact:true});
      await identity.scrollIntoViewIfNeeded();
      const beforeIdentity=await page.evaluate(()=>({selected:ASHEN.creator.identity.selected,appearance:ASHEN.getAppearance()}));
      const nextIdentity=beforeIdentity.selected==='weathered-bald'?'prime-bald':'weathered-bald';
      await identity.selectOption(nextIdentity);
      await page.waitForFunction(id=>ASHEN.creator.identity.selected===id,nextIdentity);
      await page.evaluate(()=>ASHEN.creator.settled());
      const selected=await page.evaluate(()=>({appearance:ASHEN.getAppearance(),stored:JSON.parse(localStorage.getItem('ashen.appearance.v2'))}));
      assert.deepEqual(selected.stored,selected.appearance);
      assert.deepEqual(selected.appearance.shape,beforeIdentity.appearance.shape);
      assert.deepEqual(selected.appearance.equipment,beforeIdentity.appearance.equipment);
      assert.deepEqual(selected.appearance.dyes,beforeIdentity.appearance.dyes);
      await page.screenshot({path:`${dir}/identity-controls.png`,scale:'css'});
      await page.getByRole('button',{name:'Undo identity',exact:true}).tap();
      await page.waitForFunction(id=>ASHEN.creator.identity.selected===id,beforeIdentity.selected);
      await page.evaluate(()=>ASHEN.creator.settled());
      assert.deepEqual(await page.evaluate(()=>ASHEN.getAppearance()),beforeIdentity.appearance);
      checks.push({name:'mobile-layout-identity-select-persistence-and-independent-undo',before:beforeIdentity.selected,after:nextIdentity});
    }
    await page.locator('#armory [data-close]').first().tap();
  }
  const beforeImage = await pixels('before'), before = await pos();
  if (injectDepthFailure) assert(await page.evaluate(() => ASHEN.shadows.state.depthOnlyFragment), 'world shadow caster must use Lite depthOnlyFragment');
  if (cdp) await pressStick(); else await page.keyboard.down('KeyW');
  // Twelve samples also catch gross intermittent black presentation during travel.
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(100); await pixels(`travel-${i}`); }
  if (cdp) await touch('touchEnd'); else await page.keyboard.up('KeyW');
  const traveled = distance(before, await pos());
  assert(traveled > 3, `movement only traveled ${traveled}`);
  const afterImage = await pixels('after');
  let delta = 0;
  for (let i = 0; i < beforeImage.length; i++) if (i % 4 !== 3) delta += Math.abs(beforeImage[i] - afterImage[i]);
  delta /= beforeImage.length * .75;
  assert(delta > 5, `world image did not advance with movement: mean color delta ${delta}`);
  checks.push({name: cdp ? 'native touch advances simulation and displayed world' : 'keyboard advances WebKit simulation and displayed world', traveled, imageDelta: delta});
  if (cdp) {
    for (const reason of ['capture-loss', 'cancel', 'modal', 'blur']) {
      await page.evaluate(() => { ASHEN.player.setWorldPos(0, ASHEN.world.groundHeight(0, -55) + 1.7, -55); ASHEN.rig.yaw = 0; });
      await page.waitForTimeout(300);
      const heldPoint = await pressStick(); await page.waitForTimeout(250);
      assert(await page.evaluate(() => ASHEN.input.forward > .9));
      if (reason === 'capture-loss') {
        await page.evaluate(() => {
          const stick = document.querySelector('.touch-stick');
          // Pointer ids are browser-assigned; find the captured one, not the CDP touch id.
          for (let id = 1; id < 100; id++) if (stick.hasPointerCapture(id)) stick.releasePointerCapture(id);
        });
        // Pending capture changes are processed at the next native pointer event.
        await touch('touchMove', [{...heldPoint, y: heldPoint.y - 1}]);
      }
      if (reason === 'cancel') await touch('touchCancel');
      if (reason === 'modal') await page.evaluate(() => ASHEN.menu.open());
      if (reason === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await stopped(reason);
      if (reason !== 'cancel') await touch('touchEnd');
      if (reason === 'modal') await page.evaluate(() => ASHEN.menu.close());
      if (reason === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      const p = await pos();
      await pressStick(2); await page.waitForTimeout(500); await touch('touchEnd');
      assert(distance(p, await pos()) > 1, `${reason}: new finger did not recover`);
    }
  }
  for (const height of [810, 734]) {
    await page.setViewportSize({width: 430, height}); await page.waitForTimeout(300);
    await pixels(`resize-${height}`);
  }
  await page.waitForTimeout(1000);
  report.gpuFailures = await page.evaluate(() => window.__gpuFailures);
  report.compatibility = await page.evaluate(() => ASHEN.gpu);
  assert.deepEqual(report.gpuFailures, []);
  assert.deepEqual(errors, []);
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  await page.screenshot({path: `${dir}/failure.png`, scale: 'css'}).catch(() => {});
  report.gpuFailures = await page.evaluate(() => window.__gpuFailures).catch(() => []);
  throw error;
} finally {
  if (recording) {
    await cdp.send('Page.stopScreencast').catch(() => {}); await Promise.all(writes);
    const concat = ['ffconcat version 1.0'];
    frames.forEach((f, i) => concat.push(`file 'frames/${f.name}'`, `duration ${Math.max(.008, (frames[i + 1]?.ts ?? f.ts + .033) - f.ts)}`));
    if (frames.length) concat.push(`file 'frames/${frames.at(-1).name}'`);
    await fs.writeFile(`${dir}/frames.ffconcat`, `${concat.join('\n')}\n`);
  }
  await fs.writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await context.close(); await browser.close();
  await fs.writeFile(`${dir}/ownership.json`,JSON.stringify({...ownership,active:false,renderingClients:0}));
}
