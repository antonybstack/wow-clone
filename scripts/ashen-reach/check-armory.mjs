import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const dir='ve-capture/ashen-reach/armory';await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9337');
const context=browser.contexts()[0];
const page=context.pages().find(p=>p.url().includes('ashen-reach.html'))||await context.newPage();
const checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(name,ok)=>{checks.push({name,ok:!!ok});assert.ok(ok,name);console.log('PASS',name);};
const read=()=>page.evaluate(()=>({armory:ASHEN.armory.getState(),position:{x:ASHEN.player.body.position.x,y:ASHEN.player.body.position.y,z:ASHEN.player.body.position.z},facing:ASHEN.player.getFacing(),hp:ASHEN.combat.dummy.hp,casts:ASHEN.combat.spell.casts,lavaCasts:ASHEN.combat.lava.casts,pending:ASHEN.combat.pendingSpell,sceneMeshes:ASHEN.scene.meshes.length,bodyState:ASHEN.body.getState(),clips:ASHEN.body.getPlaying(),pointerLock:!!document.pointerLockElement,rig:{yaw:ASHEN.rig.yaw,pitch:ASHEN.rig.pitch,distance:ASHEN.rig.distanceTarget},camera:ASHEN.scene.camera===ASHEN.armory.camera?'armory':ASHEN.scene.camera===ASHEN.camera?'play':'reference',alpha:ASHEN.armory.camera.alpha,radius:ASHEN.armory.camera.radius}));
const bones=()=>page.evaluate(()=>{const stack=[ASHEN.body.root];while(stack.length){const node=stack.pop();if(node.skeleton?.boneMatrices)return Array.from(node.skeleton.boneMatrices);stack.push(...(node.children||[]));}throw new Error('No evaluated skin binding');});
try{
 await page.bringToFront();await page.goto(process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:60000});await page.waitForTimeout(700);
 const baseline=await read();
 await page.locator('#armory-launch').click();await page.waitForTimeout(150);let s=await read();check('Button opens armory on existing actor',s.armory.open&&s.camera==='armory'&&s.sceneMeshes===baseline.sceneMeshes);
 check('Only unsupported races disabled',await page.locator('[data-race] option:disabled').count()===1);
 check('Orc2 is not a race option',await page.locator('[data-race] option[value="orc2"]').count()===0);
 await page.locator('[data-race]').selectOption('orc');
 await page.waitForFunction(()=>ASHEN.equipment.race==='orc'&&ASHEN.armory.getState().race==='orc'&&ASHEN.body.parked&&(ASHEN.scene.meshes.some(m=>m.name==='OrcV1Body'&&m.visible)||ASHEN.scene.meshes.some(m=>m.name==='BodyExposed'&&m.visible))&&!ASHEN.equipment.getStatus?.().pending,null,{timeout:60000});
 const orc=await page.evaluate(()=>{const visible=name=>ASHEN.scene.meshes.some(m=>m.name===name&&m.visible);return {names:ASHEN.scene.meshes.map(m=>m.name),visible:{OrcV1Hair:visible('OrcV1Hair'),OrcV1Brows:visible('OrcV1Brows'),OrcV1Body:visible('OrcV1Body'),HumanHair:visible('HumanHair'),WayfarerTunic:visible('WayfarerTunic')},parked:ASHEN.body.parked,bones:ASHEN.body.skeleton?.bones?.length??0,options:(ASHEN.body.inspection?.options??[]).map(o=>o.id),status:document.querySelector('[data-equipment-status]')?.textContent??'',state:ASHEN.equipment.getState(),presetsDisabled:[...document.querySelectorAll('[data-outfit]')].every(b=>b.disabled),torsoDisabled:document.querySelector('[data-equipment="torso"]')?.disabled===true};});
 check('Selecting Orc swaps to the sculpt body',(orc.visible.OrcV1Body||orc.names.includes('BodyExposed'))&&orc.parked&&orc.bones===65&&!orc.visible.HumanHair);
 check('Orc preview exposes the full runtime clip set',['idle','walk','run','jump','land','fire','lava','carry'].every(id=>orc.options.includes(id)));
 check('Orc wears transferred catalogue clothes',orc.visible.WayfarerTunic&&orc.state.torso==='wayfarerTunic'&&!orc.presetsDisabled&&!orc.torsoDisabled&&/report clipping/i.test(orc.status));
 await page.screenshot({path:dir+'/armory-orc.png'});
 await page.locator('[data-race]').selectOption('human');
 await page.waitForFunction(()=>ASHEN.equipment.race==='human'&&ASHEN.armory.getState().race==='human'&&!ASHEN.body.parked&&ASHEN.scene.meshes.some(m=>m.name==='HumanHair'&&m.visible)&&ASHEN.scene.meshes.some(m=>m.name==='WayfarerTunic'&&m.visible)&&!ASHEN.equipment.getStatus?.().pending,null,{timeout:60000});
 const human=await page.evaluate(()=>({names:ASHEN.scene.meshes.map(m=>m.name),parked:ASHEN.body.parked,state:ASHEN.equipment.getState(),hair:ASHEN.scene.meshes.some(m=>m.name==='HumanHair'&&m.visible)}));
 check('Returning to Human restores the equipped body',!human.parked&&human.names.includes('BodyExposed')&&human.hair&&human.state.torso==='wayfarerTunic');
 await page.mouse.click(650,280);
 await page.keyboard.down('KeyW');await page.keyboard.down('KeyD');await page.keyboard.down('Space');await page.keyboard.press('Digit1');await page.keyboard.press('Digit2');await page.waitForTimeout(450);
 await page.keyboard.up('KeyW');await page.keyboard.up('KeyD');await page.keyboard.up('Space');s=await read();
 check('Modal keys cannot move, turn, jump or cast',s.armory.open&&Math.hypot(s.position.x-baseline.position.x,s.position.z-baseline.position.z)<.02&&Math.abs(s.facing-baseline.facing)<.001&&s.casts===0&&s.lavaCasts===0&&s.hp===baseline.hp&&s.bodyState.phase!=='air');
 await page.locator('[data-motion]').selectOption('run');await page.waitForTimeout(250);s=await read();check('Run uses original clip',s.clips.some(c=>c.name==='Sprint_Loop'&&c.w>.9));
 await page.locator('[data-pause]').click();const frozen=(await read()).armory.preview.time;const firstBones=await bones();await page.waitForTimeout(200);check('Pause freezes time',Math.abs((await read()).armory.preview.time-frozen)<1e-6);check('Pause freezes evaluated joints',firstBones.length>0&&JSON.stringify(firstBones)===JSON.stringify(await bones()));
 await page.locator('[data-time-slider]').fill('0.15');await page.waitForTimeout(80);check('Scrub changes evaluated pose',JSON.stringify(firstBones)!==JSON.stringify(await bones()));
 for(const [id,time,name] of [['fire','0.28','FireBlast'],['lava','1.5','LavaBall']]){
  await page.locator('[data-motion]').selectOption(id);await page.locator('[data-time-slider]').fill(time);await page.waitForTimeout(80);s=await read();check(id+' preview includes upper/lower layers without damage',s.clips.some(c=>c.name===name+'_Upper')&&s.clips.some(c=>c.name===name+'_Lower')&&s.hp===baseline.hp&&s.casts===0&&s.lavaCasts===0);
 }
 await page.locator('[data-motion]').selectOption('idle');await page.locator('[data-view="back"]').click();const back=(await read()).alpha;await page.locator('[data-view="front"]').click();check('Front/back presets',Math.abs(Math.abs((await read()).alpha-back)-Math.PI)<.001);
 await page.mouse.move(650,280);await page.mouse.down();await page.mouse.move(735,290,{steps:5});await page.mouse.up();s=await read();check('Drag orbits without pointer lock',Math.abs(s.alpha-Math.PI/2)>.1&&!s.pointerLock);
 const radius=s.radius;await page.mouse.wheel(0,-200);await page.waitForTimeout(80);check('Scroll zooms',(await read()).radius<radius);
 await page.locator('[data-view="front"]').click();await page.locator('[data-view="full"]').click();await page.locator('[data-light]').check();await page.screenshot({path:dir+'/armory-front.png'});
 await page.keyboard.press('Escape');await page.waitForTimeout(120);s=await read();check('Escape restores gameplay and animation',!s.armory.open&&s.camera==='play'&&!s.bodyState.castingShoot&&s.clips.some(c=>c.name==='Idle_Loop'));
 check('Gameplay camera settings preserved',JSON.stringify(s.rig)===JSON.stringify(baseline.rig));
 const start=s.position;await page.keyboard.down('KeyW');await page.waitForTimeout(220);await page.keyboard.up('KeyW');s=await read();check('Movement resumes after button-opened armory',Math.hypot(s.position.x-start.x,s.position.z-start.z)>.4);
 await page.keyboard.press('Tab');await page.keyboard.press('Digit1');await page.waitForFunction(()=>ASHEN.combat.spell.casts===1);const afterFire=(await read()).hp;check('Fire releases after inspection',afterFire<baseline.hp);
 await page.waitForTimeout(1300);await page.keyboard.press('Digit2');await page.waitForTimeout(100);check('Lava charge begins',(await read()).pending===2);await page.keyboard.press('KeyC');await page.waitForTimeout(1600);s=await read();check('Opening cancels pending charge without release',s.armory.open&&s.pending===null&&s.hp===afterFire&&s.lavaCasts===0);
 await page.locator('[data-close]').last().click();await page.waitForTimeout(200);await page.keyboard.press('Digit2');await page.waitForFunction(()=>ASHEN.combat.lava.casts===1);check('Lava recovers after modal cancellation',(await read()).lavaCasts===1);
 for(let i=0;i<3;i++){await page.keyboard.press('KeyC');await page.waitForTimeout(40);await page.keyboard.press('Escape');}
 check('Repeated toggles preserve mesh count',(await read()).sceneMeshes===baseline.sceneMeshes);
 await page.evaluate(()=>ASHEN.setView('reference'));await page.keyboard.press('KeyC');await page.keyboard.press('Escape');check('Reference view restores',(await read()).camera==='reference');
 await page.evaluate(()=>ASHEN.setView('play'));await page.keyboard.press('KeyC');await page.locator('[data-light]').check();await page.waitForTimeout(150);await page.screenshot({path:dir+'/armory-final.png'});
 check('No runtime errors',errors.length===0);
}finally{
 await page.keyboard.up('KeyW');await page.keyboard.up('KeyD');await page.keyboard.up('Space');
 await fs.writeFile(dir+'/checks.json',JSON.stringify({checks,errors,state:await read().catch(()=>null)},null,2));await browser.close();
}
