import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const out=process.argv[2]||'ve-capture/ashen-reach/gait-polish';await fs.mkdir(out,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9337');
const page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach'));
try {
 await page.bringToFront();await page.reload();await page.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:120000});
 const result=await page.evaluate(async()=>{
  const text=await(await fetch('/src/ashen-reach/main.js')).text(),url=text.match(/from\s*["']([^"']*babylonjs_lite[^"']*)["']/)[1];
  const lite=await import(url),{jointWorldMatrix}=await import('/src/character/sockets.js');
  const body=ASHEN.body;body.update=()=>{};
  const joints=['Hips','LeftFoot','RightFoot','LeftToeBase','RightToeBase'];
  const bones=joints.map(n=>body.skeleton.bones.find(b=>b.name==='mixamorig:'+n));
  const result={};
  for(const name of ['Idle_Loop','Walk_Loop','Sprint_Loop','Jog_Fwd_Loop','Jog_Bwd_Loop','Jog_Left_Loop','Jog_Right_Loop','Jump_Start','Jump_Loop','Jump_Land']){
   for(const g of body.animationGroups){lite.stopAnimation(g);lite.setAnimationWeight(g,0);g.mask=undefined;}
   const g=body.animationGroups.find(g=>g.name===name);g.speedRatio=0;g.loopAnimation=false;lite.playAnimation(g);lite.setAnimationWeight(g,1);
   const samples=[];
   for(let i=0;i<=120;i++){
    g.currentTime=g.duration*i/120;lite.updateAnimationManager(body.manager,0);
    samples.push({t:g.currentTime,joints:Object.fromEntries(bones.map((bone,i)=>{const m=jointWorldMatrix(body.animationGroups,bone);return[joints[i],Array.from(m.slice(12,15))];}))});
   }
   result[name]={duration:g.duration,samples};
  }
  return result;
 });
 await fs.writeFile(`${out}/authored-gaits.json`,JSON.stringify(result,null,2));
 console.log(Object.fromEntries(Object.entries(result).map(([name,r])=>[name,{duration:r.duration,hipRange:[Math.min(...r.samples.map(s=>s.joints.Hips[1])),Math.max(...r.samples.map(s=>s.joints.Hips[1]))]}])));
}finally{await page.reload();await browser.close();}
