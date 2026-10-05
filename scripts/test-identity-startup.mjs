import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {HUMAN_IDENTITY_PRESETS} from '../src/character/appearance/human-identity.js';
import {defaultAppearance} from '../src/character/appearance/store.js';
import {usesHumanShapeStarter} from '../src/ashen-reach/startup-appearance.js';
const fixture=JSON.parse(await fs.readFile('public/ashen-reach/human-identity-v1/manifest.json','utf8'));
test('saved identity requires selected starter even at neutral shape and default equipment',()=>{
 for(const preset of HUMAN_IDENTITY_PRESETS)assert.equal(usesHumanShapeStarter({...defaultAppearance(),components:preset.id==='starter'?{}:preset.components}),preset.id!=='starter');
});
test('selected early/main requests share embedded descriptors, native decompression and retry',async()=>{
 const original=globalThis.fetch,requests=new Map(),index=structuredClone(fixture);
 for(const entry of Object.values(index.presets))for(const tier of ['items','compactItems'])for(const [id,asset]of Object.entries(entry.manifest[tier])){
  asset.url=`/identity-test-${tier}-${entry.manifest.identity.preset}-${id}.bin`;asset.bytes=3;asset.compression='gzip';
 }
 let failIndex=true,failAsset=true;
 globalThis.fetch=async url=>{
  requests.set(url,(requests.get(url)||0)+1);
  if(url.endsWith('human-identity-v1/manifest.json')){if(failIndex){failIndex=false;return new Response('',{status:500});}return new Response(JSON.stringify(index));}
  if(url==='/retry-selected.bin'&&failAsset){failAsset=false;return new Response('',{status:500});}
  return new Response(gzipSync(new Uint8Array([1,2,3])));
 };
 try{
  const api=await import('../src/ashen-reach/human-identity-assets.js?identity-cache-test'),shared=await import('../src/ashen-reach/startup-fetch.js');
  const components=HUMAN_IDENTITY_PRESETS.find(p=>p.id==='prime-ponytail').components,loadout={torso:'wayfarerTunic'};
  await assert.rejects(api.preloadHumanIdentityPack(components,loadout),/HTTP 500/);
  const [early,main]=await Promise.all([api.preloadHumanIdentityPack(components,loadout,{compact:true}),api.preloadHumanIdentityPack(components,loadout,{compact:true})]);
  assert.equal(early.fullManifest,main.fullManifest);assert.equal(early.identity.preset,'prime-ponytail');
  assert.deepEqual(new Uint8Array(await shared.startupAssetBuffer(early.items.body)),new Uint8Array([1,2,3]));
  assert.equal(shared.startupAssetBuffer(early.items.body),shared.startupAssetBuffer(main.items.body));
  assert.equal(requests.get('/ashen-reach/human-identity-v1/manifest.json'),2);
  assert.equal(requests.get(early.items.body.url),1);assert.equal(requests.get(early.items.wayfarerTunic.url),1);
  assert.equal([...requests.keys()].filter(url=>/manifest-prime/.test(url)).length,0,'Embedded selected manifest must avoid a second round trip');
  const retry={url:'/retry-selected.bin',bytes:3,compression:'gzip'};await assert.rejects(shared.startupAssetBuffer(retry),/HTTP 500/);await shared.startupAssetBuffer(retry);assert.equal(requests.get(retry.url),2);
  await assert.rejects(api.preloadHumanIdentityPack({head:'unknown',hair:'unknown'}),/Unsupported/);
 }finally{(await import('../src/ashen-reach/startup-fetch.js')).invalidateHumanIdentityCatalogue();globalThis.fetch=original;}
});
test('incompatible index and a preset/body mismatch fail before selected assets load',async()=>{
 const original=globalThis.fetch;
 try{
  const preset=HUMAN_IDENTITY_PRESETS[1];
  globalThis.fetch=async()=>new Response(JSON.stringify({...fixture,targetNames:['stout','slender']}));
  const wrong=await import('../src/ashen-reach/human-identity-assets.js?wrong-layout');await assert.rejects(wrong.preloadHumanIdentityPack(preset.components),/Incompatible/);
  const changed=structuredClone(fixture);changed.presets[preset.id].manifest.identity.preset='weathered-bald';
  globalThis.fetch=async()=>new Response(JSON.stringify(changed));
  const mismatch=await import('../src/ashen-reach/human-identity-assets.js?wrong-preset');await assert.rejects(mismatch.preloadHumanIdentityPack(preset.components),/descriptor differs/);
 }finally{(await import('../src/ashen-reach/startup-fetch.js')).invalidateHumanIdentityCatalogue();globalThis.fetch=original;}
});
test('saved preloader starts the fixed catalogue immediately and shares it with the optional module',async()=>{
 const original=globalThis.fetch,index=structuredClone(fixture),requests=[];
 for(const entry of Object.values(index.presets))for(const tier of ['items','compactItems'])for(const [id,a]of Object.entries(entry.manifest[tier])){
  a.url=`/parallel-${tier}-${entry.manifest.identity.preset}-${id}.bin`;a.bytes=3;a.compression='gzip';
 }
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 globalThis.fetch=url=>{requests.push(url);return url.endsWith('human-identity-v1/manifest.json')?gate:Promise.resolve(new Response(gzipSync(new Uint8Array([1,2,3]))));};
 const shared=await import('../src/ashen-reach/startup-fetch.js');
 try{
  const recipe={...defaultAppearance(),components:HUMAN_IDENTITY_PRESETS[2].components};
  const selected=shared.preloadSavedHumanPack(recipe,{compact:true});
  assert.deepEqual(requests,['/ashen-reach/human-identity-v1/manifest.json'],'Catalogue must start without waiting for the dynamic module');
  release(new Response(JSON.stringify(index)));
  const result=await selected;
  assert.equal(result.identity.preset,'prime-ponytail');assert.equal(requests.filter(u=>u.endsWith('manifest.json')).length,1);
  assert.deepEqual(new Uint8Array(await shared.startupAssetBuffer(result.items.body)),new Uint8Array([1,2,3]));
 }finally{release(new Response(JSON.stringify(index)));shared.invalidateHumanIdentityCatalogue();globalThis.fetch=original;}
});
