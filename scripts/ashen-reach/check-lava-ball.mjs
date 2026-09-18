import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const dir='ve-capture/ashen-reach/lava-ball';await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9337'),page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach'));
const checks=[],errors=[];let serial=0;
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(name,ok)=>{checks.push({name,ok:!!ok});assert.ok(ok,name);console.log('PASS',name);};
const read=()=>page.evaluate(()=>({hp:ASHEN.combat.dummy.hp,lava:ASHEN.combat.lava.casts,fire:ASHEN.combat.spell.casts,cooldown:ASHEN.combat.lava.cooldown,pending:ASHEN.combat.pendingSpell,flight:!!ASHEN.combat.lava.flight,stage:ASHEN.combat.lavaFx.stage,state:ASHEN.body.getState(),audio:ASHEN.combat.audio.status,bar:!document.querySelector('.cast-progress').hidden,result:ASHEN.combat.lava.lastResult}));
async function reset(target=true){await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean&lavaCheck='+Date.now()+'-'+serial++,{waitUntil:'commit'});await page.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:60000});await page.waitForTimeout(650);if(target)await page.keyboard.press('Tab');}
try{
 await page.bringToFront();await reset(false);await page.keyboard.press('Digit2');await page.waitForTimeout(100);let s=await read();
 check('No target rejects lava without animation, charge, cooldown or damage',!s.pending&&!s.state.castingShoot&&s.stage==='idle'&&s.cooldown===0&&s.hp===600);
 await page.keyboard.press('Tab');await page.keyboard.press('Digit2');await page.waitForTimeout(650);s=await read();
 check('Charge shows cast bar and body motion while preserving health/cooldown',s.pending===2&&s.stage==='charge'&&s.bar&&s.state.castingShoot&&s.state.castReleaseTime===1.5&&s.state.castLegWeight>.9&&s.hp===600&&s.cooldown===0);
 const elapsed=s.state.castElapsed;await page.keyboard.press('Digit2');await page.keyboard.press('Digit1');await page.waitForTimeout(120);s=await read();
 check('Repeated lava and Fire Blast cannot replace a charging spell',s.pending===2&&s.state.castElapsed>elapsed&&s.fire===0&&s.lava===0);
 await page.waitForFunction(()=>!!ASHEN.combat.lava.flight);s=await read();
 check('Release occurs after 1.5s and launches a projectile without early damage',s.state.castElapsed>=1.5&&s.state.castElapsed<1.7&&s.hp===600&&s.lava===1&&s.cooldown>5.7&&!s.bar&&s.stage==='flight');
 await page.keyboard.down('KeyW');await page.keyboard.press('Escape');await page.waitForTimeout(140);await page.keyboard.up('KeyW');
 await page.waitForFunction(()=>ASHEN.combat.dummy.hp===360);s=await read();
 check('Released projectile survives movement and deselection, hits once and plays release/impact audio',s.hp===360&&s.lava===1&&!s.flight&&s.stage==='impact'&&s.audio.lavaPlayed===2);
 await page.keyboard.press('Tab');await page.keyboard.press('Digit2');await page.waitForTimeout(120);s=await read();check('Cooldown rejects recast',s.lava===1&&s.result==='Lava Ball is not ready');
 await page.waitForTimeout(2400);s=await read();check('Impact particles/light and body animation settle',s.stage==='idle'&&!s.state.castingShoot&&s.hp===360);

 await reset();await page.keyboard.press('Digit2');await page.waitForTimeout(550);await page.keyboard.down('KeyW');await page.waitForTimeout(180);await page.keyboard.up('KeyW');await page.waitForTimeout(1100);s=await read();
 check('Moving during charge cancels without delayed damage or cooldown',!s.pending&&s.lava===0&&s.cooldown===0&&s.hp===600&&s.stage==='idle'&&!s.state.castingShoot);
 await page.keyboard.down('KeyW');await page.keyboard.press('Digit2');await page.waitForTimeout(150);s=await read();await page.keyboard.up('KeyW');check('Moving character cannot start a stationary lava cast',!s.pending&&s.lava===0&&s.stage==='idle');

 await reset();await page.keyboard.press('Digit2');await page.waitForTimeout(400);await page.keyboard.down('Space');await page.waitForTimeout(80);await page.keyboard.up('Space');await page.waitForTimeout(1300);s=await read();
 check('Jump interrupts charge without release or damage',!s.pending&&s.lava===0&&s.hp===600&&s.cooldown===0&&s.stage==='idle'&&s.audio.lavaPlayed===0);

 await reset();await page.keyboard.press('Digit2');await page.waitForTimeout(400);await page.keyboard.press('Escape');await page.waitForTimeout(1300);s=await read();
 check('Target clearing cancels charge and cast bar',!s.pending&&!s.bar&&s.lava===0&&s.hp===600&&s.stage==='idle');

 await reset();await page.evaluate(()=>ASHEN.player.setWorldPos(-6,ASHEN.world.groundHeight(-6,-3)+ASHEN.player.capsuleHeight/2,-3));await page.waitForTimeout(400);await page.keyboard.press('Digit2');await page.waitForTimeout(120);s=await read();
 check('Existing solid tomb blocks charge before it starts',s.result==='Target is blocked'&&s.lava===0&&s.stage==='idle'&&!s.pending);

 await reset();await page.keyboard.press('Digit1');await page.waitForTimeout(1250);await page.locator('[data-spell="2"]').click();await page.waitForFunction(()=>ASHEN.combat.dummy.hp===240);s=await read();
 check('Clickable Lava Ball and Fire Blast apply independent damage/cooldowns to one target',s.fire===1&&s.lava===1&&s.hp===240&&s.cooldown>5);
 await page.waitForFunction(()=>ASHEN.combat.lava.cooldown===0);await page.keyboard.press('Digit2');await page.waitForFunction(()=>ASHEN.combat.dummy.hp===0);
 check('Second lava impact can defeat the dummy', (await read()).lava===2);
 await page.waitForFunction(()=>ASHEN.combat.dummy.hp===600);check('Lava kill recovers dummy exactly once', (await read()).hp===600);
 check('No runtime or GPU errors',errors.length===0);
}finally{
 await page.keyboard.up('KeyW');await page.keyboard.up('Space');
 await fs.writeFile(dir+'/gameplay-checks.json',JSON.stringify({checks,errors,state:await read().catch(()=>null)},null,2));await browser.close();
}
