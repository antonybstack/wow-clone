import test from 'node:test';import assert from 'node:assert/strict';
import {createEquipmentLoader} from '../src/ashen-reach/equipment-loader.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('superseded preparation never commits and queued selections merge',async()=>{
 const gate=deferred(),started=deferred(),commits=[],dead=[];
 const loader=createEquipmentLoader({initial:{torso:null,boots:null},validate(){},maxIdle:0,prepare:async id=>{if(id==='old'){started.resolve();await gate.promise;}return {dispose(){dead.push(id);}};},commit:x=>commits.push({...x})});
 const old=loader.request({torso:'old'});await started.promise;
 const newer=loader.request({torso:'new'});const latest=loader.request({boots:'boots'});gate.resolve();
 assert.equal((await old).status,'superseded');assert.equal((await newer).status,'superseded');assert.equal((await latest).status,'applied');
 assert.deepEqual(commits,[{torso:'new',boots:'boots'}]);assert.deepEqual(dead,['old']);loader.dispose();assert.equal(dead.length,3);
});
test('failed load preserves visible state and can retry; unused entries are bounded',async()=>{
 let fail=true;const dead=[],commits=[];
 const loader=createEquipmentLoader({initial:{torso:null},validate(){},maxIdle:1,prepare:async id=>{if(id==='bad'&&fail)throw Error('network');return {dispose(){dead.push(id);}};},commit:x=>commits.push({...x})});
 await loader.request({torso:'good'});assert.equal((await loader.request({torso:'bad'})).status,'failed');assert.deepEqual(loader.getState(),{torso:'good'});assert.equal(commits.length,1);
 fail=false;await loader.request({torso:'bad'});await loader.request({torso:'third'});assert.equal(loader.getStatus().cached.length,2);assert.deepEqual(dead,['good']);loader.dispose();loader.dispose();assert.equal(dead.length,3);
});
test('dispose during preparation retires late resource and never commits',async()=>{
 const gate=deferred();let disposed=0,committed=0;
 const loader=createEquipmentLoader({initial:{torso:null},validate(){},prepare:async()=>{await gate.promise;return {dispose(){disposed++;}};},commit(){committed++;}});
 const pending=loader.request({torso:'robe'});await Promise.resolve();loader.dispose();gate.resolve();await pending;assert.equal(disposed,1);assert.equal(committed,0);assert.equal((await loader.request({})).status,'disposed');
});
test('failed commit and invalid request preserve previous loadout',async()=>{
 let reject=false;
 const loader=createEquipmentLoader({initial:{torso:null},validate:x=>{if(x.torso==='invalid')throw Error('invalid');},prepare:async()=>({dispose(){}}),commit(){if(reject)throw Error('commit');}});
 await loader.request({torso:'good'});reject=true;assert.equal((await loader.request({torso:'other'})).status,'failed');assert.equal((await loader.request({torso:'invalid'})).status,'failed');assert.equal(loader.getState().torso,'good');loader.dispose();
});

test('a newer valid request aborts blocked fetch preparation',async()=>{
 const started=deferred();
 const loader=createEquipmentLoader({initial:{torso:null},validate(){},prepare:async(id,signal)=>{
  if(id==='blocked'){started.resolve();await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));}
  return {dispose(){}};
 },commit(){}});
 const blocked=loader.request({torso:'blocked'});await started.promise;const next=loader.request({torso:'new'});
 assert.equal((await blocked).status,'superseded');assert.equal((await next).status,'applied');assert.equal(loader.getState().torso,'new');loader.dispose();
});
