/** Hold only post-play clothing refinement to inspect the actual compact actor.
 * The glTF Transform simplifier remaps skin and morph attributes together:
 * https://gltf-transform.dev/modules/functions/functions/simplify
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL;
assert(port&&url,'Require an audited owned browser and built preview');
const dir=process.env.ASHEN_CUSTOMIZATION_DIR||'.cache/production-customization-2026-09-30';
const seed=JSON.parse(await fs.readFile(`${dir}/seed-largest.json`,'utf8'));
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`),rows=[];
try {
 for(const build of [-.95,.95])for(const height of [.9,1.15]) {
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  let release;const gate=new Promise(resolve=>{release=resolve;}),errors=[];
  try {
   const recipe={...seed,shape:{...seed.shape,build,height}};
   await context.addInitScript(r=>localStorage.setItem('ashen.appearance.v2',JSON.stringify(r)),recipe);
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/human-shape-v1/*.bin',async route=>{
    if(!/\/body-|\-compact-/.test(route.request().url()))await gate;
    await route.continue();
   });
   await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});
   await page.evaluate(()=>{ASHEN.dev.god=true;ASHEN.armory.open();ASHEN.body.inspection.setPaused(true);ASHEN.body.inspection.seek(0);});
   const prefix=`compact-${build<0?'slender':'stout'}-${height}`;
   assert.deepEqual(await page.evaluate(()=>ASHEN.getAppearance()),recipe);
   await page.screenshot({path:`${dir}/${prefix}.png`});
   release();
   // A same-value body edit queues behind the real background actor transaction.
   await page.evaluate(h=>ASHEN.creator.set('height',h),height);
   await page.screenshot({path:`${dir}/${prefix}-full.png`});
   const gpuErrors=await page.evaluate(()=>ASHEN.gpu.errors.slice());
   assert.deepEqual(gpuErrors,[]);assert.deepEqual(errors,[]);
   rows.push({build,height,recipe,compact:`${prefix}.png`,full:`${prefix}-full.png`,errors,gpuErrors});
  }finally{release();await context.close();}
 }
}finally{await browser.close();await fs.writeFile(`${dir}/compact-visual.json`,JSON.stringify({url,rows},null,2));}
