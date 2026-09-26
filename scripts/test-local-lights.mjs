import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {desiredLocalLights,advanceLocalSlots,LOCAL_LIGHT_UNIFORMS,LOCAL_LIGHT_COUNT} from '../src/ashen-reach/local-light-shared.js';
const lights=[44,50,58].map(z=>({id:String(z),position:[0,3,z]}));
test('nearest two lights fit the shadow budget',()=>{assert.equal(LOCAL_LIGHT_COUNT,2);assert.deepEqual(desiredLocalLights(lights,[],{x:0,z:43}),lights.slice(0,2));});
test('hysteresis retains an established light near the midpoint',()=>{const slots=[{light:lights[0],weight:1},{light:lights[1],weight:1}];assert.deepEqual(desiredLocalLights(lights,slots,{x:0,z:51.5}).map(l=>l.id),['50','44']);});
test('slots fade out before replacing a fixture, without duplicates',()=>{
 const slots=[{light:lights[0],weight:1},{light:lights[1],weight:1}];
 advanceLocalSlots(slots,lights.slice(1),.05);assert.equal(slots[0].light,lights[0]);assert.equal(slots[0].weight,.85);
 for(let i=0;i<20;i++){const before=slots[0].weight;const light=slots[0].light;advanceLocalSlots(slots,lights.slice(1),.05);assert.equal(new Set(slots.map(s=>s.light)).size,2);if(light!==slots[0].light)assert(before<=.15);}
 assert.equal(slots[0].light,lights[2]);assert.equal(slots[0].weight,1);
});
test('large deltas cannot create an instant budget transition',()=>{const s=[{light:lights[0],weight:1},{light:lights[1],weight:1}];advanceLocalSlots(s,lights.slice(1),10);assert.equal(s[0].weight,.85);});
test('shared uniform contract exactly occupies 256 aligned bytes',()=>{assert.equal(LOCAL_LIGHT_UNIFORMS.reduce((n,u)=>n+(u.type.startsWith('mat')?64:16),0),256);});
test('fog uploads current lamp data on first frame and slot reassignment',()=>{
 const source=fs.readFileSync(new URL('../src/ashen-reach/volumetric-fog.js',import.meta.url),'utf8');
 const body=source.slice(source.indexOf(' function update(){'),source.indexOf(' const recordFog='));
 const values=Object.fromEntries(LOCAL_LIGHT_UNIFORMS.map((u,i)=>[u.name,new Float32Array(u.type.startsWith('mat')?16:4).fill(i+1)]));
 const uploads=[],env={invertMat4:()=>new Float32Array(16),getViewProjectionMatrix:()=>null,getCameraPosition:()=>({x:0,y:0,z:0}),scene:{camera:{}},sourceRT:{_width:640,_height:360},sg:{_lightMatrix:new Float32Array(16),_version:1},uniforms:new Float32Array(192),SUN_DIR:[0,1,0],state:{density:1,sunPower:1,height:1,maxDistance:1,enabled:true,shadows:true,debug:0},MAP_SIZE:2048,shadows:{data:new Float32Array(72),view:new Float32Array(16),state:{enabled:true,range:180}},LOCAL_LIGHT_UNIFORMS,localLights:{values},integrate:'fog',composite:'composite',setEffectUniforms:(target,data)=>uploads.push({target,data:Array.from(data)})};
 const update=new Function(...Object.keys(env),`${body};return update;`)(...Object.values(env));
 for(let frame=0;frame<2;frame++){
  for(const value of Object.values(values))for(let i=0;i<value.length;i++)value[i]+=10;
  update();assert.equal(uploads.length,2);const expected=LOCAL_LIGHT_UNIFORMS.flatMap(u=>Array.from(values[u.name]));
  for(const upload of uploads.splice(0)){assert.deepEqual(upload.data.slice(128),expected,`${upload.target} must use this frame's light data`);}
 }
});
test('selected fixtures never contribute to the old vertex bake',()=>{
 const source=fs.readFileSync(new URL('../src/ashen-reach/geometry.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('export function bakeLamp'),source.indexOf('/**',source.indexOf('export function bakeLamp'))).replace('export ','');
 const bake=new Function(`${fn};return bakeLamp;`)();
 const l={position:[0,3,44],strength:4,radius:8};assert.equal(bake(0,0,44,[{...l,shadowed:true}]),0);assert(bake(0,0,44,[l])>0);
});
