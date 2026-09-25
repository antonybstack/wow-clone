import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {CDP_URL} from '../lib/cdp.mjs';
const b=await chromium.connectOverCDP(CDP_URL),c=await b.newContext({viewport:{width:1280,height:720}}),p=await c.newPage(),errors=[],checks=[];
p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto(process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});await p.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:120000});
 const y=await p.evaluate(()=>ASHEN.world.cathedral.floorY);
 for(const [name,x,z,level,yaw,limit,sign] of [['gallery-inner',7,330,8.5,-Math.PI/2,5.5,-1],['gallery-outer',7,330,8.5,Math.PI/2,8.5,1],['parapet',-27,330,8.5,-Math.PI/2,-28.2,-1],['bell-landing',-19.2,306,25,Math.PI/2,-18.3,1]]){
  await p.evaluate(({x,z,level,yaw,y})=>{const a=ASHEN;a.dev.god=true;a.player.setFlying(false);a.player.setWorldPos(x,y+level+1.7,z);a.player.setFacing(yaw);a.rig.yaw=yaw;},{x,z,level,yaw,y});await p.waitForTimeout(700);
  const recovery=await p.evaluate(()=>ASHEN.player.getDebugState().recoveries);await p.keyboard.down('KeyW');await p.waitForTimeout(2000);await p.keyboard.up('KeyW');
  const state=await p.evaluate(()=>({x:ASHEN.player.body.position.x,y:ASHEN.player.body.position.y,z:ASHEN.player.body.position.z,debug:ASHEN.player.getDebugState(),lights:ASHEN.localLights.state}));
  assert(state.debug.usingPhysics);assert.equal(state.debug.recoveries,recovery);assert(sign*(state.x-limit)<0,`${name}: escaped guard`);assert(Math.abs(state.y-y-level)<1.5,`${name}: fell`);assert(state.lights.budget===2&&state.lights.active.length<=2);checks.push({name,state});
 }
 assert.deepEqual(errors,[]);await fs.mkdir('ve-capture/ashen-reach/v26',{recursive:true});await fs.writeFile('ve-capture/ashen-reach/v26/barriers.json',JSON.stringify({checks,errors,passed:true},null,2));console.log(JSON.stringify({passed:true,checks:checks.length}));
}finally{await p.keyboard.up('KeyW').catch(()=>{});await c.close();await b.close();}
