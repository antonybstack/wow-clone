import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const dir=process.env.FIRE_BLAST_CAPTURE_DIR||'ve-capture/ashen-reach/fire-blast';await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9337');const page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach.html'));
const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const read=()=>page.evaluate(()=>({casts:ASHEN.combat.spell.casts,hp:ASHEN.combat.dummy.hp,target:ASHEN.combat.targeting.current?.id,result:ASHEN.combat.spell.lastResult,cooldown:ASHEN.combat.spell.cooldown,shoot:ASHEN.body.getState().castingShoot,grounded:ASHEN.player.getGrounded()}));
const press=async key=>{await page.keyboard.press(key);await page.waitForTimeout(400);};
function check(name,ok){assert.ok(ok,name);checks.push(name);console.log('PASS',name);}
try{
 await page.bringToFront();await page.goto('http://127.0.0.1:5180/ashen-reach.html?play&clean',{waitUntil:'commit'});await page.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:60000});await page.waitForTimeout(1000);
 await press('Digit1');let s=await read();check('No target rejects without gesture, damage or cooldown',s.casts===0&&s.hp===600&&!s.shoot&&s.cooldown===0);
 await press('Tab');check('Tab selects training dummy',!!(await read()).target);
 await press('Digit1');s=await read();check('One keypress releases one animated 120 damage hit',s.casts===1&&s.hp===480&&s.shoot&&s.cooldown>2.5);
 await press('Digit1');s=await read();check('Spam cannot bypass cooldown',s.casts===1&&s.hp===480&&s.result.includes('not ready'));
 await page.waitForTimeout(3100);await press('Digit1');s=await read();check('Can cast again after cooldown',s.casts===2&&s.hp===360);
 await page.waitForTimeout(3100);await page.keyboard.down('Space');await page.waitForTimeout(140);await page.keyboard.up('Space');await press('Digit1');s=await read();check('Airborne rejection does not consume spell',s.casts===2&&s.cooldown===0&&!s.grounded&&s.result==='Land before casting');await page.waitForTimeout(1400);
 // Set the distant fixture location directly; casting and targeting still use real key events.
 await page.evaluate(()=>ASHEN.player.setWorldPos(0,ASHEN.world.groundHeight(0,-16)+ASHEN.player.capsuleHeight/2,-16));await page.waitForTimeout(400);await press('Digit1');s=await read();check('Out-of-range rejection leaves health and cooldown unchanged',s.casts===2&&s.hp===360&&s.cooldown===0&&s.result.startsWith('Out of range'));
 await page.evaluate(()=>{ASHEN.reset();ASHEN.setView('play')});await page.waitForTimeout(500);
 await page.keyboard.down('KeyW');await press('Digit1');await page.keyboard.up('KeyW');s=await read();check('Cast release works while moving',s.casts===3&&s.hp===240);
 await page.waitForTimeout(3100);await press('Digit1');await page.waitForTimeout(3100);await press('Digit1');s=await read();check('Fifth hit reaches zero health',s.casts===5&&s.hp===0);await press('Digit1');check('Recovering dummy rejects further hits',(await read()).casts===5);await page.waitForTimeout(3100);check('Training dummy restores health for another round',(await read()).hp===600);
 await press('Escape');await press('Digit1');s=await read();check('Escape clears target and rejected recast stays idle',!s.target&&s.casts===5&&!s.shoot);
 await press('Digit3');check('Unimplemented slots do not play fake casts',!(await read()).shoot);
 await fs.writeFile(dir+'/gameplay-errors.json',JSON.stringify(errors,null,2));console.log('Errors',errors);check('No runtime or GPU validation errors',errors.length===0);
 await fs.writeFile(dir+'/gameplay-checks.json',JSON.stringify({checks,errors,state:await read()},null,2));
}finally{await page.keyboard.up('KeyW');await page.keyboard.up('Space');await browser.close();}
