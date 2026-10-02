/** One tracked game/engine prepares native piece bounds, never a second renderer.
 * Candidate outputs stay outside public until motion and resource gates pass.
 */
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL;
assert(port&&url,'Select an audited owned dev harness');
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned renderer is active');
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
const folder='.cache/character-mmo/remote-pieces-v1',errors=[];await fs.mkdir(folder,{recursive:true});
const ownership=await browserOwnership(browser,{cdpPort:port,url,purpose:'Offline native per-piece swept bounds and deformed-vertex controls; not FPS',renderingClients:1});
await fs.writeFile(`${folder}/native-ownership.json`,JSON.stringify(ownership,null,2));
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.exposeFunction('__remotePreparationProgress',row=>console.log(JSON.stringify(row)));
 await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
 const result=await page.evaluate(async()=>{
  const {prepareNativeRemotePieces}=await import('/src/character/remote-pieces/prepare-native.js');
  return prepareNativeRemotePieces(ASHEN,{onProgress:row=>void globalThis.__remotePreparationProgress(row)});
 });
 result.errors=errors;result.gpuErrors=await page.evaluate(()=>ASHEN.gpu.errors.slice());
 assert.equal(result.escaped,0);assert.equal(result.finalByteCache.leases,0);assert.equal(result.finalByteCache.reservedBytes,0);assert.deepEqual(errors,[]);assert.deepEqual(result.gpuErrors,[]);
 await fs.writeFile(`${folder}/prepared.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({completed:true,points:result.points,escaped:result.escaped,byteCache:result.finalByteCache}));
}catch(error){await fs.writeFile(`${folder}/native-failure.json`,JSON.stringify({message:error.stack,errors},null,2)+'\n');throw error;}
finally{await context.close();await browser.close();await fs.writeFile(`${folder}/native-ownership.json`,JSON.stringify({...ownership,active:false,renderingClients:0},null,2));}
