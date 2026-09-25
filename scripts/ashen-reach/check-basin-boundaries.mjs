/** Real Havok movement across former clamps, plus a real masonry collision. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CDP_URL} from '../lib/cdp.mjs';
const b=await chromium.connectOverCDP(CDP_URL),c=await b.newContext({viewport:{width:1280,height:720}}),p=await c.newPage();
const errors=[],checks=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto(process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean');
 await p.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
 for(const [name,x,z,key,axis,sign,limit] of [
  ['west',-85,-70,'KeyQ','x',-1,91],['east',85,-70,'KeyE','x',1,91],
  ['south',0,-90,'KeyS','z',-1,96],
 ]){
  await p.evaluate(({x,z})=>{const a=ASHEN;a.dev.god=true;a.player.setFlying(false);a.player.setWorldPos(x,a.world.groundHeight(x,z)+1.7,z);a.player.setFacing(0);a.rig.yaw=0;},{x,z});
  await p.waitForTimeout(500);
  const before=await p.evaluate(()=>ASHEN.player.getDebugState());
  await p.keyboard.down(key);await p.waitForTimeout(2500);await p.keyboard.up(key);
  const after=await p.evaluate(()=>({state:ASHEN.player.getDebugState(),x:ASHEN.player.body.position.x,y:ASHEN.player.body.position.y,z:ASHEN.player.body.position.z}));
  assert(after[axis]*sign>limit,`${name}: crosses old clamp`);
  assert(after.state.usingPhysics);assert.equal(after.state.recoveries,before.recoveries);assert(Number.isFinite(after.y));
  checks.push({name,...after});
 }
 await p.evaluate(()=>{const a=ASHEN;a.player.setWorldPos(0,a.world.cathedral.floorY+1.7,330);a.player.setFacing(0);a.rig.yaw=0;});
 await p.waitForTimeout(500);await p.keyboard.down('KeyE');await p.waitForTimeout(4000);await p.keyboard.up('KeyE');
 const wall=await p.evaluate(()=>({x:ASHEN.player.body.position.x,y:ASHEN.player.body.position.y,floor:ASHEN.world.cathedral.floorY}));
 assert(wall.x>8&&wall.x<11.6,'Nave side wall blocks real movement');assert(wall.y>wall.floor&&wall.y<wall.floor+3);
 checks.push({name:'nave-wall',...wall});assert.deepEqual(errors,[]);
 await fs.mkdir('ve-capture/ashen-reach/gothic-world',{recursive:true});
 await fs.writeFile('ve-capture/ashen-reach/gothic-world/boundaries.json',JSON.stringify({checks,errors,passed:true},null,2));
 console.log(JSON.stringify({checks,errors,passed:true}));
}finally{await c.close();await b.close();}
