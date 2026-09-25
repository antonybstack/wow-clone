/** Three 12-second walking runs per representative region route, without recording.
 * Run only in an isolated --uncapped harness with no other active game renderers. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {summarizeDurations,detectVsyncCap} from '../../src/ashen-reach/metrics.js';
import {CDP_URL} from '../lib/cdp.mjs';
const b=await chromium.connectOverCDP(CDP_URL),p=b.contexts()[0].pages()[0];
const rows=[];try{await p.goto(process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});await p.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});await p.setViewportSize({width:1280,height:720});await p.evaluate(()=>{ASHEN.metrics.setInternalResolution(1280,720);ASHEN.dev.god=true;});
for(const [name,x,z,yaw] of [['town',0,80,0],['bridge',0,190,0],['cathedral',0,265,0],['forest',130,-50,0]])for(let run=1;run<=3;run++){
 await p.evaluate(({x,z,yaw})=>{const a=ASHEN,c=a.world.cathedral,g=x===0&&z>=c.route.start[2]&&z<=c.terrace.maxZ?c.route.heightAt(z):a.world.groundHeight(x,z);a.player.setFlying(false);a.player.setWorldPos(x,g+1.7,z);a.player.setFacing(yaw);a.rig.yaw=yaw;},{x,z,yaw});await p.waitForTimeout(1000);await p.keyboard.down('KeyW');await p.waitForTimeout(1500);await p.evaluate(()=>ASHEN.renderLoop.beginMeasurement());await p.waitForTimeout(12000);const times=await p.evaluate(()=>ASHEN.renderLoop.endMeasurement());await p.keyboard.up('KeyW');const state=await p.evaluate(()=>({resolution:ASHEN.metrics.summary().resolution,enemies:ASHEN.combat.enemies.length,position:{...ASHEN.player.body.position},physics:ASHEN.player.getDebugState()}));const r={name,run,...summarizeDurations(times),...detectVsyncCap(times),...state};rows.push(r);console.log(JSON.stringify(r));await fs.writeFile(process.argv[2],JSON.stringify({conditions:'M1 Max Chromium153 uncapped WebGPU 1280x720 seven enemies, no recording; 12s runs after 1.5s walking warmup',rows},null,2));}
}finally{await p.keyboard.up('KeyW').catch(()=>{});await p.goto('about:blank');await b.close();}
