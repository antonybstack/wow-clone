/** Real WebGPU/Havok checks: failed partial worker retry, frontier, upgrade, disposal. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { CDP_URL } from "../lib/cdp.mjs";
const url =
  process.env.ASHEN_TEST_URL ||
  "http://127.0.0.1:7073/?play&clean&fastStart&pixelRatio=1";
const dir =
  process.env.ASHEN_CAPTURE_DIR ||
  ".dream-loop/startup-takeover-2026-09-27/progressive";
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.connectOverCDP(CDP_URL),
  report = { url, checks: [] };
async function run(name, fn, options={}) {
  const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      ...options,
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.addInitScript(() => {
    window.__gpuErrors = [];
    const request = GPUAdapter.prototype.requestDevice;
    GPUAdapter.prototype.requestDevice = async function (...args) {
      const d = await request.apply(this, args);
      d.addEventListener("uncapturederror", (e) =>
        __gpuErrors.push(e.error.message),
      );
      return d;
    };
  });
  try {
    const details = await fn(page, context);
    const unexpected=name==='initial-body-failure'?errors.filter(message=>!(/503/.test(message)&&(/body-|Failed to load resource/.test(message)))):errors;
    assert.deepEqual(unexpected, []);
    assert.deepEqual(await page.evaluate(() => __gpuErrors), []);
    report.checks.push({ name, ...details, passed: true });
    console.log(name, "PASS");
  } catch (error) {
    report.checks.push({ name, errors, failure: error.stack });
    await page
      .screenshot({ path: `${dir}/${name}-failure.png` })
      .catch(() => {});
    throw error;
  } finally {
    await context.close();
    await fs.writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
  }
}
const pos = (page) =>
  page.evaluate(() => ({
    x: ASHEN.player.body.position.x,
    z: ASHEN.player.body.position.z,
    y: ASHEN.player.body.position.y,
    recoveries: ASHEN.player.getDebugState().recoveries,
    grounded: ASHEN.player.getGrounded(),
    frame: ASHEN.gpu.frames,
  }));

try {
  await run('wait-for-supported-frame',async(page)=>{
    await page.addInitScript(()=>{
      window.__holdSupport=true;
      const timer=setInterval(()=>{
        const player=globalThis.ASHEN?.player;if(!player)return;
        clearInterval(timer);const grounded=player.getGrounded.bind(player);
        player.getGrounded=()=>!window.__holdSupport&&grounded();
        window.__supportHook=true;
      },0);
    });
    await page.goto(url);
    await page.waitForFunction(()=>window.__supportHook&&!!globalThis.ASHEN?.whenFirstGpuFrame);
    await page.evaluate(()=>ASHEN.whenFirstGpuFrame);
    assert.equal(await page.evaluate(()=>ASHEN.playableReady),false);
    const before=await pos(page);await page.keyboard.down('KeyW');await page.waitForTimeout(250);await page.keyboard.up('KeyW');
    const held=await pos(page);assert(Math.hypot(held.x-before.x,held.z-before.z)<.05);
    const released=await page.evaluate(()=>{window.__holdSupport=false;return performance.now();});
    await page.waitForFunction(()=>ASHEN.playableReady);
    const marks=await page.evaluate(()=>ASHEN.startup.timings());
    assert(marks['supported-frame-submitted']>=released);
    assert(marks['supported-frame-completed']>=marks['supported-frame-submitted']);
    assert(marks.playable>=marks['supported-frame-completed']);return {released,marks};
  });
  await run('initial-body-failure',async(page,context)=>{
    let release;const held=new Promise(resolve=>{release=resolve;});
    await context.route('**/startup/character/body-*.bin',async route=>{await held;await route.fulfill({status:503,body:'Injected body failure'});});
    await page.goto(url);await page.waitForFunction(()=>!!globalThis.ASHEN?.whenPlayable,null,{timeout:30000});release();
    await page.locator('#loading-retry').waitFor({state:'visible'});
    const statuses=await page.evaluate(()=>Promise.race([Promise.allSettled([ASHEN.whenPlayable,ASHEN.whenCombat,ASHEN.whenRegion,ASHEN.whenHostiles,ASHEN.whenFirstGpuFrame]).then(rows=>rows.map(row=>row.status)),new Promise(resolve=>setTimeout(()=>resolve(['timeout']),2000))]));
    assert.deepEqual(statuses,Array(5).fill('rejected'));return {statuses};
  });
  await run('dispose-during-spell-download',async(page,context)=>{
    let release,arrived;const held=new Promise(resolve=>{release=resolve;}),seen=new Promise(resolve=>{arrived=resolve;});
    await context.route('**/fire-blast/fire_01.png',async route=>{arrived();await held;await route.continue();});
    await page.goto(url);await Promise.race([seen,new Promise((_,reject)=>setTimeout(()=>reject(Error('Spell download did not begin')),30000))]);
    await page.evaluate(()=>ASHEN.dispose());release();await page.waitForTimeout(1000);
    const meshes=await page.evaluate(()=>ASHEN.scene.meshes.length);assert.equal(meshes,0);return {meshes};
  });
  await run("partial-worker-retry", async (page) => {
    await page.addInitScript(() => {
      const NativeWorker = Worker;
      let injected = false;
      globalThis.Worker = class extends NativeWorker {
        constructor(...args) {
          super(...args);
          let blocks = 0;
          this.addEventListener("message", (event) => {
            if (!injected && event.data.batch && ++blocks === 12) {
              injected = true;
              this.terminate();
              this.dispatchEvent(
                new ErrorEvent("error", {
                  message: "Injected transient worker failure",
                }),
              );
            }
          });
        }
      };
    });
    await page.goto(url);
    await page.waitForFunction(() => globalThis.ASHEN?.playableReady);
    await page.waitForFunction(
      () => globalThis.ASHEN?.backgroundError,
      {},
      { timeout: 30000 },
    );
    const before = await pos(page);
    await page.keyboard.down("KeyS");
    await page.waitForTimeout(5500);
    await page.keyboard.up("KeyS");
    const gated = await pos(page);
    assert(gated.z < before.z - 5);
    assert(gated.z > -13, "frontier must block before incomplete route");
    assert.equal(gated.recoveries, 0);
    const blocks = await page.evaluate(() => ASHEN.world.streaming.blocks);
    assert(blocks > 7, "some remote blocks installed before interruption");
    await page
      .getByRole("button", { name: "Retry loading", exact: true })
      .click();
    await page.waitForFunction(() => ASHEN.ready, null, { timeout: 90000 });
    const after = await pos(page);
    assert(
      Math.hypot(after.x - gated.x, after.z - gated.z) < 0.3,
      "retry preserves player position",
    );
    assert.equal(after.recoveries, 0);
    await page.keyboard.down("KeyS");
    await page.waitForTimeout(1800);
    await page.keyboard.up("KeyS");
    const outside = await pos(page);
    assert(outside.z < -14, "frontier removed after real collision");
    assert.equal(outside.recoveries, 0);
    const state = await page.evaluate(() => ({
      streaming: ASHEN.world.streaming,
      foliage: ASHEN.world.stats.foliageInstances,
      woodland: ASHEN.world.woodland.state,
      enemies: ASHEN.combat.enemies.length,
    }));
    assert.equal(state.foliage, 117242);
    assert.equal(state.enemies, 7);
    return { before, gated, after, outside, blocks, ...state };
  });
  await run("partial-install-retry",async page=>{
    await page.addInitScript(()=>{
      const write=GPUQueue.prototype.writeBuffer;let injected=false;
      GPUQueue.prototype.writeBuffer=function(buffer,offset,...args){
        if(!injected&&globalThis.ASHEN?.playableReady&&buffer.label==='Earth'&&offset>0){injected=true;throw Error('Injected vertex upload failure');}
        return write.call(this,buffer,offset,...args);
      };
    });
    await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.backgroundError,null,{timeout:30000});
    await page.getByRole('button',{name:'Retry loading',exact:true}).click();await page.waitForFunction(()=>ASHEN.ready,null,{timeout:90000});
    const counts=await page.evaluate(()=>ASHEN.player.getDebugState().colliders);assert.equal(counts.meshCount,717,'retry must not duplicate an already cooked shape');assert.equal(counts.boxCount,678);return {counts};
  });
  await run('early-touch-movement',async(page,context)=>{
    await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.playableReady);
    const before=await pos(page),regionAtStart=await page.evaluate(()=>ASHEN.regionReady);
    const stick=await page.locator('.touch-stick').boundingBox();assert(stick);
    const cdp=await context.newCDPSession(page),finger={id:1,x:stick.x+stick.width/2,y:stick.y+stick.height/2,radiusX:4,radiusY:4,force:1};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...finger,y:finger.y-43}]});
    await page.waitForTimeout(1000);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const after=await pos(page);assert.equal(regionAtStart,false);assert(Math.hypot(after.x-before.x,after.z-before.z)>2);assert.equal(after.recoveries,0);return {before,after,regionAtStart};
  },{viewport:{width:430,height:734},isMobile:true,hasTouch:true});
  await run('combat-before-region',async page=>{
    await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.combatReady,null,{timeout:30000});
    const before=await page.evaluate(()=>({region:ASHEN.regionReady,hp:ASHEN.combat.dummy.hp,casts:ASHEN.combat.spell.casts,marks:ASHEN.startup.timings()}));assert.equal(before.region,false);
    await page.keyboard.press('Tab');await page.keyboard.press('Digit1');await page.waitForTimeout(1900);
    const after=await page.evaluate(()=>({hp:ASHEN.combat.dummy.hp,casts:ASHEN.combat.spell.casts}));assert(after.casts>before.casts);assert(after.hp<before.hp);return {before,after};
  });
  await run('race-switch-before-region',async page=>{
    await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.combatReady,null,{timeout:30000});
    assert.equal(await page.evaluate(()=>ASHEN.regionReady),false);
    await page.evaluate(async()=>{await ASHEN.equipment.switchRace('orc');globalThis.__orcRoot=ASHEN.body.root;});
    await page.waitForFunction(()=>ASHEN.ready,null,{timeout:90000});
    assert(await page.evaluate(()=>ASHEN.equipment.race==='orc'&&ASHEN.body.root===__orcRoot));
    await page.evaluate(()=>ASHEN.equipment.switchRace('human'));assert.equal(await page.evaluate(()=>ASHEN.equipment.race),'human');return {restored:'human'};
  });
  await run("continuous-upgrade", async (page) => {
    await page.goto(url);
    await page.waitForFunction(() => globalThis.ASHEN?.playableReady);
    const before = await pos(page);
    await page.evaluate(() => {
      globalThis.__originalBody = ASHEN.body;
      globalThis.__originalPlayer = ASHEN.player;
      globalThis.__originalRoot = ASHEN.body.root;
    });
    await page.keyboard.down("KeyS");
    await page.waitForTimeout(900);
    await page.keyboard.up("KeyS");
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(400);
    await page.keyboard.up("KeyD");
    await page.waitForFunction(() => ASHEN.ready, null, { timeout: 90000 });
    const after = await pos(page);
    assert(Math.hypot(after.x - before.x, after.z - before.z) > 1);
    assert.equal(after.recoveries, 0);
    assert(
      await page.evaluate(
        () =>
          ASHEN.body === __originalBody &&
          ASHEN.player === __originalPlayer &&
          ASHEN.body.root === __originalRoot,
      ),
    );
    return {
      before,
      after,
      streaming: await page.evaluate(() => ASHEN.world.streaming),
    };
  });
  for (const mode of ["loading", "complete"])
    await run(`dispose-${mode}`, async (page) => {
      await page.goto(url);
      await page.waitForFunction(() => globalThis.ASHEN?.playableReady);
      if (mode === "complete")
        await page.waitForFunction(() => ASHEN.ready, null, { timeout: 90000 });

      await page.evaluate(() => ASHEN.dispose());
      await page.waitForTimeout(800);
      const state = await page.evaluate(() => ({
        woodland: ASHEN.world.woodland.state,
        frames: ASHEN.gpu.frames,
      }));
      assert(state.woodland.disposed);
      assert.equal(state.woodland.tiles, 0);
      return state;
    });
} finally {
  await browser.close();
}
