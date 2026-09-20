// Real-input regression for delayed release and additive full-body cast layering.
import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const dir=process.env.FIRE_BLAST_CAPTURE_DIR||'ve-capture/ashen-reach/cast-motion';
await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
const page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach.html'));
const checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(name,ok)=>{checks.push({name,ok:!!ok});assert.ok(ok,name);console.log('PASS',name);};
const read=()=>page.evaluate(()=>({
 ...ASHEN.body.getState(),hp:ASHEN.combat.dummy.hp,pending:ASHEN.combat.pending,
 casts:ASHEN.combat.spell.casts,cooldown:ASHEN.combat.spell.cooldown,
 sounds:ASHEN.combat.audio.status.played,active:ASHEN.combat.fx.active,
 position:{x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z},
}));
async function reset(){
 await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});
 await page.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:60000});
 await page.waitForTimeout(700);await page.keyboard.press('Tab');
}
try{
 await page.bringToFront();await reset();
 await page.keyboard.press('Digit1');await page.waitForTimeout(75);
 let s=await read();check('Wind-up animates and primes fire before consuming damage/cooldown/sound',s.castingShoot&&s.pending&&s.active&&s.hp===600&&s.cooldown===0&&s.sounds===0);
 const elapsed=s.castElapsed;await page.keyboard.press('Digit1');await page.waitForTimeout(60);
 s=await read();check('Repeated input cannot restart wind-up or release early',s.castElapsed>elapsed&&s.hp===600&&s.casts===0);
 await page.waitForFunction(()=>ASHEN.combat.spell.casts===1);
 s=await read();check('Release marker applies exactly one hit and sound with a braced stance',s.hp===480&&s.sounds===1&&!s.pending&&s.castElapsed>=.28&&s.castLegWeight>.9&&s.cooldown>2.8);
 await page.waitForTimeout(1300);s=await read();check('Cast fully returns to locomotion',!s.castingShoot&&s.casts===1);

 await reset();await page.keyboard.down('KeyW');await page.waitForTimeout(150);
 const start=await read();await page.keyboard.press('Digit1');
 await page.waitForFunction(()=>ASHEN.combat.spell.casts===1);
 s=await read();check('Moving cast preserves travel and suppresses the braced leg layer',s.castLegWeight<.1&&Math.hypot(s.position.x-start.position.x,s.position.z-start.position.z)>.3&&s.hp===480);
 await page.keyboard.up('KeyW');await page.waitForTimeout(300);s=await read();
 check('Stopping mid-cast does not restore a stale braced stance',s.castingShoot&&s.castLegWeight<.1);

 await reset();await page.keyboard.press('Digit1');await page.waitForTimeout(60);
 await page.keyboard.down('Space');await page.waitForTimeout(80);await page.keyboard.up('Space');await page.waitForTimeout(270);s=await read();
 check('Jump before release cancels damage, cooldown, sound and wind-up effects',!s.pending&&s.hp===600&&s.casts===0&&s.cooldown===0&&s.sounds===0&&!s.active&&!s.castingShoot);

 await reset();await page.keyboard.press('Digit1');await page.waitForTimeout(60);
 await page.keyboard.press('Escape');await page.waitForTimeout(350);s=await read();
 check('Clearing the target before release cancels gameplay and wind-up fire',!s.pending&&s.hp===600&&s.casts===0&&s.cooldown===0&&s.sounds===0&&!s.active);
 check('No runtime or GPU validation errors',errors.length===0);
}finally{
 await page.keyboard.up('KeyW');await page.keyboard.up('Space');
 await fs.writeFile(dir+'/cast-motion-checks.json',JSON.stringify({checks,errors,state:await read().catch(()=>null)},null,2));
 await browser.close();
}
