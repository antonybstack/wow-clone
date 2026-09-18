import {chromium} from 'playwright';import fs from 'node:fs/promises';
const dir='ve-capture/ashen-reach/gait-polish';await fs.mkdir(dir,{recursive:true});
const b=await chromium.connectOverCDP('http://127.0.0.1:9337'),p=b.contexts()[0].pages().find(p=>p.url().includes('ashen-reach'));
const keys=new Set(),errors=[];p.on('pageerror',e=>errors.push(e.message));
const down=async k=>{keys.add(k);await p.keyboard.down(k);};const up=async k=>{keys.delete(k);await p.keyboard.up(k);};
try{
 await p.bringToFront();await p.reload();await p.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:120000});
 await p.evaluate(()=>{ASHEN.reset();ASHEN.setView('play');window.gaitReview={phase:'settle',samples:[]};gaitReview.timer=setInterval(()=>{const a=ASHEN;gaitReview.samples.push({phase:gaitReview.phase,state:a.body.getState(),motion:a.player.getDebugState(),clips:a.body.getPlaying(),gaits:a.body.animationGroups.filter(g=>g.isPlaying&&g.weight>.1&&a.body.definition.gaitContacts?.[g.name]!==undefined).map(g=>({name:g.name,phase:((g.currentTime/g.duration-a.body.definition.gaitContacts[g.name])%1+1)%1}))});},25);});
 const phase=async name=>p.evaluate(n=>gaitReview.phase=n,name);
 await p.waitForTimeout(500);
 for(const [name,move,side]of [['forward-right','KeyW','KeyE'],['backward-left','KeyS','KeyQ'],['forward-left','KeyW','KeyQ'],['backward-right','KeyS','KeyE']]){
  await phase(name);await down('Shift');await down(move);await down(side);await p.waitForTimeout(1400);await up(side);await up(move);await up('Shift');await p.waitForTimeout(200);
 }
 await phase('moving-jump');await down('KeyW');await p.waitForTimeout(450);await down('Space');await p.waitForTimeout(100);await up('Space');await p.waitForTimeout(950);await up('KeyW');
 await phase('standing-jump');await p.waitForTimeout(450);await down('Space');await p.waitForTimeout(100);await up('Space');await p.waitForTimeout(1400);
 const r=await p.evaluate(()=>{clearInterval(gaitReview.timer);return gaitReview;});delete r.timer;r.errors=errors;
 const shared=r.samples.filter(s=>s.gaits.length>1),distance=(a,b)=>Math.min(Math.abs(a-b),1-Math.abs(a-b));
 const worst=Math.max(...shared.flatMap(s=>s.gaits.map(g=>distance(g.phase,s.state.gaitPhase))));
 const lands=r.samples.filter(s=>s.state.phase==='land');
 const checks={noErrors:errors.length===0,allDiagonalsSampled:['forward-right','backward-left','forward-left','backward-right'].every(n=>shared.some(s=>s.phase===n)),phaseAgreement:shared.length>40&&worst<.002,
  movingLandingPlays:lands.some(s=>s.phase==='moving-jump'&&s.motion.speed>6&&s.clips.some(c=>c.name==='Jump_Land'&&c.w>.05)),
  boundedLanding:lands.length>4&&lands.every(s=>s.clips.filter(c=>c.name==='Jump_Land').every(c=>c.w<=.401)),
  landingWeightsNormalized:lands.every(s=>Math.abs(s.clips.reduce((sum,c)=>sum+c.w,0)-1)<.05),
  finalGrounded:r.samples.at(-1).motion.grounded};
 r.checks=checks;r.worstPhaseError=worst;await fs.writeFile(`${dir}/gait-play.json`,JSON.stringify(r,null,2));console.log({checks,worst,shared:shared.length,landSamples:lands.length});if(Object.values(checks).some(v=>!v))process.exitCode=1;
}finally{for(const k of keys)await p.keyboard.up(k);await p.evaluate(()=>{if(window.gaitReview)clearInterval(gaitReview.timer);ASHEN.reset();ASHEN.setView('play');}).catch(()=>{});await b.close();}
