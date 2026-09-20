/** Live two-handed proof: the greatstaff occupies both hands, both hands stay on
 * the shaft through locomotion and both spells, the carry pose releases for casts,
 * and stow/draw is an eased travel rather than an instant snap. */
import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/ashen-reach/two-handed';await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
const page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach.html'));
const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS '+name);};
const axisDistances=()=>page.evaluate(()=>{
  const s=ASHEN.combat.fx.sockets,bw=ASHEN.player.body.worldMatrix;
  const xf=(m,x,y,z)=>[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];
  const hw=n=>{const bone=ASHEN.body.skeleton.bones.find(x=>x.name===n);const c=s.toCapsule(bone);return xf(bw,c.x,c.y,c.z);};
  const root=ASHEN.scene.meshes.find(m=>m.name==='greatstaffWood')?.parent;if(!root)return null;const w=root.worldMatrix;
  const o=[w[12],w[13],w[14]],ax=[w[4],w[5],w[6]],an=Math.hypot(...ax),u=ax.map(v=>v/an);
  const d=p=>{const v=[p[0]-o[0],p[1]-o[1],p[2]-o[2]];const t=v[0]*u[0]+v[1]*u[1]+v[2]*u[2];return Math.hypot(p[0]-(o[0]+u[0]*t),p[1]-(o[1]+u[1]*t),p[2]-(o[2]+u[2]*t));};
  return {left:d(hw('mixamorig:LeftHand')),right:d(hw('mixamorig:RightHand'))};
});
const propState=()=>page.evaluate(()=>{
  const root=ASHEN.scene.meshes.find(m=>m.name==='greatstaffWood').parent,stow=ASHEN.equipment.items.graveweaverGreatstaff.stow.position,p=root.position;
  return {parent:root.parent?.name,dist:Math.hypot(p.x-stow[0],p.y-stow[1],p.z-stow[2]),attachment:ASHEN.equipment.attachment,two:+(ASHEN.body.animationGroups.find(g=>g.name==='Walk_Carry_Loop')?.weight??-1).toFixed(3)};
});
try{
  await page.bringToFront();await page.goto((process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean'),{waitUntil:'commit',timeout:60000});
  await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:60000});await page.waitForTimeout(700);
  // Hand exclusivity.
  await page.evaluate(async()=>{await ASHEN.equipment.equipPreset('warden');});await page.waitForTimeout(900);
  check('Warden preset equips the two-handed greatstaff with no off-hand',await page.evaluate(()=>ASHEN.equipment.getState().mainHand==='graveweaverGreatstaff'&&ASHEN.equipment.getState().offHand===null));
  check('Equipping an off-hand clears the two-handed main hand',await page.evaluate(async()=>{await ASHEN.equipment.equip('offHand','graveweaverBook');return ASHEN.equipment.getState().mainHand===null&&ASHEN.equipment.getState().offHand==='graveweaverBook';}));
  check('Equipping the greatstaff clears an equipped off-hand',await page.evaluate(async()=>{await ASHEN.equipment.equipPreset('graveweaver');await ASHEN.equipment.equip('mainHand','graveweaverGreatstaff');return ASHEN.equipment.getState().offHand===null;}));
  await page.waitForTimeout(700);
  // Carry contact in the shared armory preview.
  await page.keyboard.press('KeyC');await page.waitForTimeout(400);
  for(const [motion,time] of [['carry','0.1'],['carry','0.4'],['carry','0.7']]){
    await page.locator('[data-motion]').selectOption(motion);await page.locator('[data-time-slider]').fill(time);await page.waitForTimeout(200);
    const d=await axisDistances();check(`Armory carry t=${time}: both hands stay on the greatstaff shaft`,d&&d.left<.02&&d.right<.02);
  }
  await page.screenshot({path:dir+'/armory-carry.png'});
  await page.keyboard.press('Escape');await page.waitForTimeout(500);
  // Carry contact in live locomotion.
  await page.keyboard.down('KeyW');await page.waitForTimeout(700);const moving=await axisDistances();await page.keyboard.up('KeyW');await page.waitForTimeout(300);
  check('Live movement keeps both hands on the shaft',moving&&moving.left<.02&&moving.right<.02);
  check('Two-handed carry pose is active during locomotion',await page.evaluate(()=>{const s=ASHEN.combat.fx.sockets,cap=n=>{const b=ASHEN.body.skeleton.bones.find(x=>x.name===n);const c=s.toCapsule(b);return c?[c.x,c.y,c.z]:null;};const L=cap('mixamorig:LeftHand'),R=cap('mixamorig:RightHand');return !!L&&!!R&&L[2]>0.08&&Math.abs(L[0]-R[0])>0.14;}));
  // Fire Blast: pose releases, prop stows and travels, then recovers.
  await page.keyboard.press('Tab');await page.keyboard.press('Digit1');
  await page.waitForFunction(()=>ASHEN.combat.spell.casts===1,null,{timeout:8000});
  let sawTravel=false,stowed=false;
  for(let i=0;i<8;i++){const s=await propState();if(s.parent==='backSocket'&&s.dist>.02)sawTravel=true;if(s.parent==='backSocket'&&s.dist<.002)stowed=true;await page.waitForTimeout(45);}
  check('Stowing the greatstaff is eased travel, not an instant snap',sawTravel);
  check('The greatstaff reaches its authored back transform',stowed);
  check('Two-handed carry pose releases for Fire Blast',await page.evaluate(()=>ASHEN.body.getState().castingShoot===true));
  await page.waitForTimeout(1200);
  check('Fire Blast recovery returns the greatstaff to the hand',await page.evaluate(()=>ASHEN.equipment.attachment==='hand'));
  check('Fire Blast still deals its timed damage',await page.evaluate(()=>ASHEN.combat.dummy.hp===480));
  const afterFire=await axisDistances();check('Both hands re-grip the shaft after Fire Blast',afterFire.left<.02&&afterFire.right<.02);
  await page.screenshot({path:dir+'/gameplay-carry.png'});
  // Lava Ball.
  await page.keyboard.press('Digit2');await page.waitForFunction(()=>ASHEN.combat.pendingSpell===2,null,{timeout:6000});
  await page.waitForTimeout(250);const charging=await propState();
  check('Lava Ball charge stows the greatstaff and releases the carry pose',charging.attachment==='back'&&await page.evaluate(()=>ASHEN.body.getState().castingShoot===true));
  await page.waitForFunction(()=>ASHEN.combat.lava.casts===1,null,{timeout:9000});await page.waitForTimeout(1400);
  check('Lava Ball recovery returns the greatstaff and deals damage',await page.evaluate(async()=>ASHEN.equipment.attachment==='hand'&&ASHEN.combat.dummy.hp===240));
  const afterLava=await axisDistances();check('Both hands re-grip the shaft after Lava Ball',afterLava.left<.02&&afterLava.right<.02);
  check('No runtime/WebGPU errors',errors.length===0);
}finally{
  await page.keyboard.up('KeyW').catch(()=>{});
  await fs.writeFile(dir+'/checks.json',JSON.stringify({checks,errors},null,2));
  await browser.close();
}
