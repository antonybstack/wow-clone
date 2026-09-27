/** Sample a single local startup in an owned Chromium CDP browser.
 *
 * ASHEN_CDP_PORT=10437 ASHEN_TEST_URL='http://127.0.0.1:6273/ashen-reach.html?play&clean' \
 *   node scripts/ashen-reach/profile-startup.mjs /tmp/ashen-startup.cpuprofile
 * The profile includes asynchronous load after the first page commit. Fresh
 * context does not imply fresh browser, OS or GPU driver caches.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';

const output=process.argv[2];
assert(output,'Usage: node scripts/ashen-reach/profile-startup.mjs <profile.cpuprofile>');
assert(output.endsWith('.cpuprofile'),'Profile output must end in .cpuprofile');
const url=new URL(process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean');
url.searchParams.set('startupMarks','');url.searchParams.set('pixelRatio','1');
const browser=await chromium.connectOverCDP(CDP_URL);
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
const page=await context.newPage(),cdp=await context.newCDPSession(page);
try{
 await cdp.send('Profiler.enable');
 await cdp.send('Profiler.setSamplingInterval',{interval:1000});
 await cdp.send('Profiler.start');
 await page.goto(url.toString());
 await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
 const {profile}=await cdp.send('Profiler.stop');
 const marks=await page.evaluate(()=>performance.getEntriesByType('mark').filter(e=>e.name.startsWith('ashen-startup-')).map(e=>({name:e.name,at:e.startTime})));
 await fs.mkdir(path.dirname(output),{recursive:true});
 await fs.writeFile(output,JSON.stringify(profile));
 await fs.writeFile(output.replace(/\.cpuprofile$/,'.marks.json'),JSON.stringify({url:url.toString(),marks},null,2));
 console.log(JSON.stringify({profile:output,samples:profile.samples?.length,ready:marks.find(m=>m.name==='ashen-startup-ready')?.at}));
}finally{await context.close();await browser.close();}
