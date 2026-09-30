/** One owned renderer; measure first appearance promotion separately from capture/settled FPS. */
import {chromium} from 'playwright';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {summarizeFrameIntervals} from './summarize-frame-intervals.mjs';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL,out=process.argv[2];assert(port&&url&&out);
const b=await chromium.connectOverCDP(`http://127.0.0.1:${port}`),report={url,recording:false,rows:[],errors:[]};
try {for(let run=1;run<=3;run++) {
 const c=await b.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),p=await c.newPage();
 p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 try {await p.goto(url);await p.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});await p.waitForTimeout(3000);
  await p.evaluate(()=>ASHEN.renderLoop.beginMeasurement());
  const started=Date.now();await p.evaluate(()=>ASHEN.creator.set('build',.95));const promotionMs=Date.now()-started;
  await p.waitForTimeout(2500);const result=await p.evaluate(()=>({frames:ASHEN.renderLoop.endMeasurement(),gpuErrors:ASHEN.gpu.errors.slice(),appearance:ASHEN.getAppearance(),physics:ASHEN.player.getDebugState().usingPhysics,detailError:ASHEN.appearanceDetailError||null}));
  report.rows.push({run,promotionMs,...result,tails:summarizeFrameIntervals(result.frames)});
  assert(result.physics);assert.equal(result.appearance.shape.build,.95);assert.deepEqual(result.gpuErrors,[]);assert.equal(result.detailError,null);
 }finally{await c.close();}
}assert.deepEqual(report.errors,[]);}finally{await fs.writeFile(out,JSON.stringify(report,null,2));await b.close();}
console.log(JSON.stringify(report.rows.map(r=>({run:r.run,promotionMs:r.promotionMs,tails:r.tails}))));
