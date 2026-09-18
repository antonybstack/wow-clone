import {chromium} from 'playwright';import fs from 'node:fs/promises';
const dir=process.env.FIRE_BLAST_CAPTURE_DIR||'ve-capture/ashen-reach/fire-blast';await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9337');const page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach.html'));
try{
 await page.bringToFront();await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});await page.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:60000});await page.waitForTimeout(3000);await page.keyboard.press('Tab');await page.keyboard.press('Digit1');await page.waitForTimeout(3500);
 await page.evaluate(()=>{window.__spellPerf={idle:[],active:[],maxDrawCalls:0,running:true};let last=performance.now();function tick(now){const d=now-last;last=now;const m=window.__spellPerf;if(!m.running)return;(ASHEN.combat.fx.active?m.active:m.idle).push(d);m.maxDrawCalls=Math.max(m.maxDrawCalls,ASHEN.engine.drawCallCount);requestAnimationFrame(tick);}requestAnimationFrame(tick);});
 for(let i=0;i<4;i++){await page.keyboard.press('Digit1');await page.waitForTimeout(3450);}
 const result=await page.evaluate(()=>{const m=window.__spellPerf;m.running=false;const stats=list=>{const a=[...list].sort((a,b)=>a-b),mean=a.reduce((s,v)=>s+v,0)/a.length;return {frames:a.length,fps:1000/mean,meanMs:mean,p95Ms:a[Math.floor(a.length*.95)],maxMs:a.at(-1)};};return {idle:stats(m.idle),active:stats(m.active),maxDrawCalls:m.maxDrawCalls,scene:ASHEN.metrics.summary(),note:'Foreground Chrome CDP 9337; no screencast. Local resolution only.'};});
 await fs.writeFile(dir+'/performance.json',JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close();}
