/** Live evaluated-palette regression: grip contact must not slide across clips,
 * gloves or streamed/preloaded equipment. Screenshots still decide visual fit. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/ashen-reach/grips';await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9337');
const page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach.html'));
const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS '+name);};
const joints=()=>page.evaluate(()=>{
 const host=ASHEN.combat.fx.sockets;
 return ASHEN.body.skeleton.bones.filter(b=>/Hand(Thumb|Index|Middle|Ring|Pinky)[1234]$/.test(b.name)).map(b=>{
  const s=host.sockets[b.name.includes('Right')?'mainHand':'offHand'].node,q=s.rotationQuaternion,v=host.toCapsule(b);
  const a=[v.x-s.position.x,v.y-s.position.y,v.z-s.position.z],x=-q.x,y=-q.y,z=-q.z,w=q.w;
  const tx=2*(y*a[2]-z*a[1]),ty=2*(z*a[0]-x*a[2]),tz=2*(x*a[1]-y*a[0]);
  return[a[0]+w*tx+y*tz-z*ty,a[1]+w*ty+z*tx-x*tz,a[2]+w*tz+x*ty-y*tx];
 });
});
const difference=(a,b)=>Math.max(...a.map((v,i)=>Math.hypot(...v.map((x,j)=>x-b[i][j]))));
const preview=async(id,time=.1)=>{await page.evaluate(({id,time})=>{const p=ASHEN.body.inspection;p.select(id);p.setPaused(true);p.seek(time);},{id,time});await page.waitForTimeout(100);};
try{
 for(const fallback of [false,true]){
  const url=new URL(process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean');if(fallback)url.searchParams.set('preloadedEquipment','');
  await page.goto(url.href,{waitUntil:'commit'});await page.waitForFunction(()=>globalThis.ASHEN?.ready);
  await page.evaluate(()=>ASHEN.equipment.equipPreset('graveweaver'));await page.keyboard.press('KeyC');await page.locator('[data-light]').check();
  await preview('idle');const baseline=await joints(),label=fallback?'preloaded':'streamed';
  for(const id of ['walk','run','jump','land']){await preview(id,.22);check(`${label}: ${id} keeps finger contact within 1 mm`,difference(baseline,await joints())<.001);}
  await preview('fire',.2);check(`${label}: source casting releases equipment finger pose`,difference(baseline,await joints())>.005);
  check(`${label}: cast stows prop`,await page.evaluate(()=>ASHEN.equipment.attachment==='back'));
  await preview('idle');check(`${label}: regrip after casting`,difference(baseline,await joints())<.001);
  await page.evaluate(()=>ASHEN.equipment.equip('gloves',null));await page.waitForTimeout(100);check(`${label}: bare and gloved hands use identical pose`,difference(baseline,await joints())<.001);
  await page.evaluate(()=>ASHEN.equipment.equip('gloves','graveweaverGloves'));
  await page.screenshot({path:`${dir}/${label}-full.png`});
  await page.evaluate(()=>ASHEN.equipment.setLoadout({mainHand:null,offHand:null}));await page.waitForTimeout(100);check(`${label}: empty hands relax`,difference(baseline,await joints())>.015);
 }
 check('No runtime errors',errors.length===0);
 await fs.writeFile(dir+'/checks.json',JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
