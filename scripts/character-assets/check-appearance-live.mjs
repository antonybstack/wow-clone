/** M002 read-only adapter check in a separately owned game browser.
 * Requires an audited harness slot; this script closes only its matched game tab.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const port=Number(process.env.ASHEN_CDP_PORT),url=process.env.ASHEN_URL;
if(!port || !url) throw Error('ASHEN_CDP_PORT and ASHEN_URL required');
const target=new URL(url);target.searchParams.set('pixelRatio','1');
const out=process.env.ASHEN_CAPTURE_DIR || 've-capture/character-mmo/m002';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith(url.split('?')[0]));
if(!page) throw Error('Owned game tab not found');
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const snapshot=()=>page.evaluate(async()=>{
  const {appearanceFromEquipment}=await import('/src/character/appearance/from-equipment.js');
  const {encodeAppearance,appearanceKey}=await import('/src/character/appearance/codec.js');
  const before=ASHEN.equipment.getState(),race=ASHEN.equipment.race;
  const recipe=appearanceFromEquipment({race,loadout:before});
  const after=ASHEN.equipment.getState();
  return {race,before,after,recipe,encodedBytes:new TextEncoder().encode(encodeAppearance(recipe)).length,key:appearanceKey(recipe),pending:ASHEN.equipment.getStatus().pending};
});
try {
  await page.setViewportSize({width:1280,height:720});
  await page.goto(target.href);
  await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});
  const initial=await snapshot();
  assert.equal(initial.race,'human');assert.deepEqual(initial.before,initial.after);
  await page.screenshot({path:path.join(out,'human.png')});
  const pending=await page.evaluate(async()=>{
    const {appearanceFromEquipment}=await import('/src/character/appearance/from-equipment.js');
    const before=ASHEN.equipment.getState(),request=ASHEN.equipment.equipPreset('warden');
    const status=ASHEN.equipment.getStatus();
    const during=appearanceFromEquipment({race:ASHEN.equipment.race,loadout:ASHEN.equipment.getState()});
    const result=await request;
    return {before,pending:status.pending,desired:status.desired,during:during.equipment,result,after:ASHEN.equipment.getState()};
  });
  assert.equal(pending.pending,true);
  assert.deepEqual(pending.during,pending.before);
  assert.equal(pending.result.status,'applied');
  assert.equal(pending.after.mainHand,'graveweaverGreatstaff');
  const failed=await page.evaluate(async()=>{
    const before=ASHEN.equipment.getState(),result=await ASHEN.equipment.equip('torso','unknownM002Item');
    return {before,result,after:ASHEN.equipment.getState()};
  });
  assert.equal(failed.result.status,'failed');assert.deepEqual(failed.before,failed.after);
  const races=[];
  for(const race of ['orc','undead','human']) {
    await page.evaluate(r=>ASHEN.equipment.switchRace(r),race);
    const entry=await snapshot();
    assert.equal(entry.race,race);assert.deepEqual(entry.before,entry.after);
    races.push(entry);
    if(race!=='human')await page.screenshot({path:path.join(out,`${race}.png`)});
  }
  const runtime=await page.evaluate(()=>({canvas:[document.getElementById('renderCanvas').width,document.getElementById('renderCanvas').height],physics:ASHEN.player.getDebugState().usingPhysics,enemies:ASHEN.combat.enemies.length}));
  assert.deepEqual(runtime.canvas,[1280,720]);assert(runtime.physics);assert.equal(runtime.enemies,7);
  assert.deepEqual(errors,[]);
  const report={url:target.href,viewport:[1280,720],runtime,initial,pending,failed,races,errors};
  await fs.writeFile(path.join(out,'live-check.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({races:[initial.race,...races.map(x=>x.race)],initialBytes:initial.encodedBytes,pendingPreserved:pending.pending,failedPreserved:failed.result.status,errors}));
} finally {
  await page.goto('about:blank').catch(()=>{});
  await browser.close();
}
