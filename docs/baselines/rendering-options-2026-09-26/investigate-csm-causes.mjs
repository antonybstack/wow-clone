// Investigation only: requires csm-experiment.patch in a separate checkout and harness slot 13.
// Native cache contract: https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/17-cascaded-shadow.md
import {chromium} from 'playwright';import fs from 'node:fs/promises';
const browser=await chromium.connectOverCDP('http://127.0.0.1:10637');const page=browser.contexts()[0].pages()[0];await page.setViewportSize({width:1280,height:720});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
await page.goto('http://127.0.0.1:6473/ashen-reach.html?play&clean&gpuTiming&csmCache',{waitUntil:'commit'});await page.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
await page.evaluate(()=>{ASHEN.metrics.setInternalResolution(1280,720);ASHEN.player.setWorldPos(0,ASHEN.world.groundHeight(0,-60)+1.7,-60);ASHEN.rig.pitch=.24;ASHEN.rig.distance=ASHEN.rig.distanceTarget=5;const sg=__csmTrial;const original=sg._renderShadowMap;const wrapped=new WeakSet();window.__causes={frames:0,camera:0,force:0,refit:0,driftOnly:0};sg._renderShadowMap=function(e,s){const g=s._gate;if(g&&!wrapped.has(g)){wrapped.add(g);const old=g.update;g.update=function(...args){const r=old.apply(this,args);__causes.frames++;__causes.camera+=+args[4];__causes.force+=+args[5];__causes.refit+=+r.refit;__causes.driftOnly+=+g._lastRefitDriftOnly();return r;};}return original.call(this,e,s);};});
const rows=[];
for(const view of ['play','reference']){
 await page.evaluate(view=>ASHEN.setView(view),view);await page.waitForTimeout(2500);
 await page.evaluate(()=>{__causes={frames:0,camera:0,force:0,refit:0,driftOnly:0};ASHEN.metrics.reset();});await page.waitForTimeout(5000);
 rows.push(await page.evaluate(view=>({view,causes:__causes,metrics:ASHEN.metrics.summary(),camera:{version:ASHEN.scene.camera.worldMatrixVersion,radius:ASHEN.scene.camera.radius},player:ASHEN.player.getDebugState()}),view));
 await page.screenshot({path:`/tmp/ashen-csm-${view}.png`});
}
await fs.writeFile('/tmp/ashen-csm-causes.json',JSON.stringify({rows,errors},null,2));console.log(JSON.stringify(rows.map(x=>({view:x.view,causes:x.causes,fps:x.metrics.fps,gpu:x.metrics.gpuMeanMs})),null,2));
}finally{await page.goto('about:blank');await browser.close();}
