import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const dir=process.env.FIRE_BLAST_CAPTURE_DIR||'ve-capture/ashen-reach/fire-blast-polish';await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9337');const page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach.html'));const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push({message:m.text(),location:m.location()})});
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
try{
 await page.bringToFront();await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});await page.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:60000});await page.waitForTimeout(900);await page.keyboard.press('Tab');await page.waitForTimeout(100);
 check('Keyboard interaction unlocks decoded sound',await page.evaluate(()=>ASHEN.combat.audio.status.ready&&ASHEN.combat.audio.status.state==='running'));
 await page.evaluate(()=>ASHEN.player.setWorldPos(-6,ASHEN.world.groundHeight(-6,-3)+ASHEN.player.capsuleHeight/2,-3));await page.waitForTimeout(400);
 const blocked=await page.evaluate(()=>ASHEN.combat.lineOfSight());console.log('Blocked fixture',blocked);check('Existing foreground tomb blocks Havok sight query',!blocked.clear&&!!blocked.obstacle);
 await page.keyboard.press('Digit1');await page.waitForTimeout(100);
 check('Blocked cast produces no damage, cooldown, particles, sound or gesture',await page.evaluate(()=>{const c=ASHEN.combat;return c.dummy.hp===600&&c.spell.cooldown===0&&c.spell.casts===0&&c.spell.lastResult==='Target is blocked'&&!c.fx.active&&c.audio.status.played===0&&!ASHEN.body.getState().castingShoot;}));
 await page.screenshot({path:dir+'/blocked.png'});
 await page.evaluate(()=>{ASHEN.reset();ASHEN.setView('play');});await page.waitForTimeout(500);check('Open path clears terrain and accepts target collider',await page.evaluate(()=>ASHEN.combat.lineOfSight().clear));
 await page.keyboard.press('Digit1');await page.waitForTimeout(350);
 check('Successful hit ignites hand/impact, plays sound, and rocks dummy',await page.evaluate(()=>{const c=ASHEN.combat;return c.dummy.hp===480&&c.fx.active&&c.audio.status.played===1&&Math.hypot(c.dummy.root.rotation.x,c.dummy.root.rotation.z)>.015;}));
 await page.waitForTimeout(1700);check('Effects and hit reaction settle completely',await page.evaluate(()=>{const c=ASHEN.combat;return !c.fx.active&&c.dummy.root.rotation.x===0&&c.dummy.root.rotation.z===0;}));
 await page.locator('.sound-toggle').click();check('Mute control works',await page.evaluate(()=>ASHEN.combat.audio.muted));await page.locator('.sound-toggle').click();check('Sound can be restored',await page.evaluate(()=>!ASHEN.combat.audio.muted));
 await page.waitForTimeout(1400);await page.locator('[data-spell="1"]').click();await page.waitForTimeout(400);check('Clickable spell slot remains independent of mute',await page.evaluate(()=>ASHEN.combat.spell.casts===2&&!ASHEN.combat.audio.muted));
 await fs.writeFile(dir+'/polish-errors.json',JSON.stringify(errors,null,2));console.log('Errors',errors);check('No runtime/GPU errors',errors.length===0);await fs.writeFile(dir+'/polish-checks.json',JSON.stringify({checks,errors,blocked},null,2));
}finally{await browser.close();}
