/** Live first-use check for late Lite billboard registration and Pyre layers. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {CDP_URL} from '../lib/cdp.mjs';

const url=process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean';
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/ashen-reach/lite1311/f6-late-features';
await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.addInitScript(()=>{
  window.__lateFeatureGpuErrors=[];
  const requestDevice=GPUAdapter.prototype.requestDevice;
  GPUAdapter.prototype.requestDevice=async function(...args){
    const device=await requestDevice.apply(this,args);
    device.addEventListener('uncapturederror',event=>window.__lateFeatureGpuErrors.push(event.error.message));
    return device;
  };
});
const report={url,errors};
try{
  await page.goto(url,{waitUntil:'commit'});
  await page.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
  await page.evaluate(()=>{
    const a=ASHEN,d=a.combat.dummy.position,z=d.z-2.6;
    a.setView('play');a.player.setWorldPos(d.x,a.world.groundHeight(d.x,z)+a.player.capsuleHeight*.5,z);
    a.player.setFacing(0);a.rig.yaw=.6;a.rig.pitch=.25;a.rig.distance=a.rig.distanceTarget=6;
  });
  await page.waitForFunction(()=>ASHEN.player.getGrounded(),null,{timeout:8000});
  report.initial=await page.evaluate(()=>{
    const systems=ASHEN.scene._renderables.filter(r=>r._system?._entityType==='billboard-sprite-system');
    return {pending:ASHEN.scene._deferredBuilders.length,
      capacities:systems.map(r=>r._system._capacity),cast:ASHEN.combat.pulse.casts};
  });
  assert.equal(report.initial.pending,0,'Late builders remain pending');
  for(const size of [176,18,96])assert(report.initial.capacities.includes(size),`Missing Pyre billboard capacity ${size}`);
  await page.screenshot({path:path.join(dir,'before-pyre.png')});
  await page.keyboard.press('Digit3');
  await page.waitForFunction(previous=>ASHEN.combat.pulse.casts>previous,report.initial.cast,{timeout:8000});
  report.samples=[];
  for(let i=0;i<7;i++){
    await page.waitForTimeout(65);
    report.samples.push(await page.evaluate(()=>{
      const renderables=ASHEN.scene._renderables.filter(r=>r._system?._entityType==='billboard-sprite-system');
      const fire=renderables.find(r=>r._system._capacity===176);
      const smoke=renderables.find(r=>r._system._capacity===18);
      const sparks=renderables.filter(r=>r._system._capacity===96);
      // Diagnostic-only read of Lite's billboard instance sizes; production
      // code never depends on these internals.
      const visible=(system,start,count)=>{
        if(!system)return 0;
        let n=0;for(let j=start;j<start+count;j++)n+=+(system._instanceData[j*16+3]>0);
        return n;
      };
      return {age:ASHEN.combat.pulse.casts,fireDraws:fire?._drawableCount??0,
        sparkDraws:sparks.reduce((n,r)=>n+(r._drawableCount??0),0),
        ring:visible(fire?._system,0,36),pillars:visible(fire?._system,64,48),
        geyser:visible(fire?._system,112,28),sparks:sparks.reduce((n,r)=>n+visible(r._system,0,96),0),
        smoke:visible(smoke?._system,0,18)};
    }));
    if(i===3)await page.screenshot({path:path.join(dir,'first-pyre-burst.png')});
  }
  for(const key of ['ring','pillars','geyser','sparks','smoke','fireDraws','sparkDraws']){
    assert(Math.max(...report.samples.map(sample=>sample[key]))>0,`First Pyre cast missed ${key}`);
  }
  await page.waitForTimeout(1900); // Let Pyre's global cooldown and recovery finish.
  await page.keyboard.press('Tab'); // Pyre needs no target; direct spells do.
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(350);
  report.fireAttempt=await page.evaluate(()=>({result:ASHEN.combat.spell.lastResult,pending:ASHEN.combat.pendingSpell,target:ASHEN.combat.targeting.current?.id,body:ASHEN.body.getState().phase,mana:ASHEN.combat.life?.mana}));
  await page.waitForFunction(()=>ASHEN.combat.spell.casts===1,null,{timeout:8000});
  await page.waitForTimeout(1900);
  await page.keyboard.press('Digit2');
  await page.waitForFunction(()=>ASHEN.combat.lava.casts===1,null,{timeout:10000});
  report.otherSpells=await page.evaluate(()=>({fire:ASHEN.combat.spell.casts,lava:ASHEN.combat.lava.casts}));
  report.gpuErrors=await page.evaluate(()=>window.__lateFeatureGpuErrors);
  assert.deepEqual(report.gpuErrors,[]);
  assert.deepEqual(errors,[]);
  report.passed=true;
}catch(error){report.failure=error.stack;throw error;}
finally{
  await fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2));
  await context.close();await browser.close();
}
