/** Diagnose a parser barrier with the real built page, without timing claims.
 * The control retains published HTML. The candidate only moves its neutral-pack
 * inline script ahead of the stylesheet, leaving native modules/data untouched.
 * https://html.spec.whatwg.org/multipage/scripting.html#prepare-the-script-element
 * https://playwright.dev/docs/network#handle-requests
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL,out=process.argv[2];
const fixed=process.argv.includes('--fixed');
assert(port&&url&&out,'Require audited CDP port, built URL and report');
const seed=JSON.parse(await fs.readFile('docs/baselines/character-mmo/startup-normal-release-2026-10-06/seed-maximum-compact.json'));
const bodyPath=JSON.parse(await fs.readFile('docs/baselines/character-mmo/startup-normal-release-2026-10-06/maximum-compact-budget.json')).maximum.resources.find(a=>a.id==='body').url;
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned page is active');
const ownership=await browserOwnership(browser,{cdpPort:port,url,purpose:'Held CSS startup discovery control',renderingClients:1});
await fs.writeFile(out+'.ownership.json',JSON.stringify(ownership));
const report={url,rows:[],timingClaim:false,fixed};
try{
 for(const move of fixed?[false]:[false,true]){
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
  let release,held=0,bodyHits=0,rewrites=0;const errors=[];
  const gate=new Promise(resolve=>{release=resolve;});
  await context.addInitScript(value=>localStorage.setItem('ashen.appearance.v2',JSON.stringify(value)),seed);
  page.on('request',r=>{if(new URL(r.url()).pathname===bodyPath)bodyHits++;});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/\/assets\/(?:[^/]+\/)*ashen-reach-[^/]+\.css(?:\?.*)?$/,async route=>{held++;await gate;await route.continue();});
  if(move)await page.route('**/*',async route=>{
   if(route.request().resourceType()!=='document')return route.fallback();
   const response=await route.fetch();let html=await response.text();
   const candidates=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].filter(m=>m[1].includes('/ashen-reach/startup/character/manifest.json'));
   assert.equal(candidates.length,1,'Expected one build-owned neutral-pack preloader');
   const script=candidates[0][0];html=html.replace(script,'');
   const style=/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/i.exec(html);assert(style,'Missing built stylesheet');
   html=html.slice(0,style.index)+script+html.slice(style.index);rewrites++;
   const headers={...response.headers()};delete headers['content-encoding'];delete headers['content-length'];
   await route.fulfill({response,headers,body:html});
  });
  try{
   await page.goto(url,{waitUntil:'commit'});
   // Bounded observation window is intentional: the control cannot reach body
   // discovery until the stylesheet is released. Keep the intercepted-hit guard.
   await page.waitForTimeout(1500);assert(held>0,'CSS control did not intercept');
   const beforeRelease={bodyHits,cataloguePresent:await page.locator('#ashen-human-identity-catalogue').count()};
   const row={move,held,rewrites,beforeRelease,errors};report.rows.push(row);await fs.writeFile(out,JSON.stringify(report,null,2));
   release();await page.waitForFunction(()=>globalThis.ASHEN?.ready===true,null,{timeout:60000});
   const state=await page.evaluate(()=>({appearance:ASHEN.getAppearance(),physics:ASHEN.player.getDebugState().usingPhysics,gpuErrors:ASHEN.gpu.errors}));
   assert.deepEqual(state.appearance,seed);assert(state.physics);assert.deepEqual(errors,[]);assert.deepEqual(state.gpuErrors,[]);assert.equal(bodyHits,1,'Body request must be shared');
   Object.assign(row,{bodyHits,state});
   await fs.writeFile(out,JSON.stringify(report,null,2));
  }finally{release();await page.unrouteAll({behavior:'wait'});await context.close();}
 }
 if(fixed)assert.equal(report.rows[0].beforeRelease.bodyHits,1,'Built saved discovery still waits for CSS');
 else{
  assert.equal(report.rows[0].beforeRelease.bodyHits,0,'Published control did not reproduce a CSS barrier');
  assert.equal(report.rows[1].beforeRelease.bodyHits,1,'Moving the inline script did not unblock saved discovery');
 }
 report.passed=true;
}finally{
 await fs.writeFile(out,JSON.stringify(report,null,2));ownership.active=false;await fs.writeFile(out+'.ownership.json',JSON.stringify(ownership));await browser.close();
}
