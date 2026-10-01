/** Native offline bake using one explicitly owned, blank CDP page. Run the
 * GLB builder with --region first. Source clocks/bounds are never rebuilt in play.
 * ASHEN_CDP_PORT and ASHEN_TEST_URL select the tracked harness.
 */
import fs from 'node:fs/promises';import {createHash} from 'node:crypto';import {chromium} from 'playwright';import assert from 'node:assert/strict';
if(!process.env.ASHEN_CDP_PORT||!process.env.ASHEN_TEST_URL)throw Error('Select the owned harness with ASHEN_CDP_PORT and ASHEN_TEST_URL');
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${process.env.ASHEN_CDP_PORT||9837}`);assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'));const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
try{
 await page.goto(process.env.ASHEN_TEST_URL||'http://127.0.0.1:5673/ashen-reach.html?play&clean&pixelRatio=1');await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:90000});
 const r=await page.evaluate(async()=>{const {prepare}=await import('/src/character/region-crowd/prepare-native.js');return prepare(ASHEN);});
 for(const v of Object.values(r.variants)){
  assert.equal(v.escaped,0);for(const p of v.payloads){const data=Buffer.from(new Float32Array(p.data).buffer);const sha=createHash('sha256').update(data).digest('hex');p.file=`vat-${sha}.bin`;p.sha256=sha;p.bytes=data.length;delete p.data;await fs.writeFile(`.cache/character-mmo/region-crowd/${p.file}`,data);}
 }
 await fs.writeFile('.cache/character-mmo/region-crowd/prepared.json',JSON.stringify(r,null,2));console.log(JSON.stringify(Object.fromEntries(Object.entries(r.variants).map(([k,v])=>[k,{points:v.points,escaped:v.escaped,files:[...new Set(v.payloads.map(p=>p.file))],clips:v.clips}]))));
}finally{await context.close();await browser.close();}
