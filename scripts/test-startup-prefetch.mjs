import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultAppearance} from '../src/character/appearance/store.js';
import {APPEARANCE_V1_REGISTRY} from '../src/character/appearance/contract.js';
import {appearanceFromEquipment} from '../src/character/appearance/from-equipment.js';
import {gzipSync} from 'node:zlib';
import {permitsSavedAppearance,usesHumanShapeStarter,DEFAULT_BOOT_GEAR} from '../src/ashen-reach/startup-appearance.js';

test('early starter selection retains neutral/race/diagnostic boundaries',()=>{
  const human=defaultAppearance();
  assert.deepEqual(human.equipment,DEFAULT_BOOT_GEAR);
  assert.equal(usesHumanShapeStarter(human),false);
  assert.equal(usesHumanShapeStarter({...human,shape:{...human.shape,build:-.95}}),true);
  assert.equal(usesHumanShapeStarter({...human,shape:{...human.shape,height:1.15}}),true);
  assert.equal(usesHumanShapeStarter({...human,equipment:{...human.equipment,gloves:'graveweaverGloves'}}),true);
  assert.equal(usesHumanShapeStarter(defaultAppearance('orc')),false);
  assert.equal(usesHumanShapeStarter(null),false);
  for(const name of ['preloadedEquipment','humanShape','humanHeight','humanHair','humanHead','humanIdentity','plate','creator','garmentFit'])assert.equal(permitsSavedAppearance(new URLSearchParams(name)),false);
});
test('early and main startup share the existing validated appearance; corrupt data survives',async()=>{
  const storageBefore=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  try {
    let value=JSON.stringify(defaultAppearance()),reads=0;
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(key){reads++;return key==='ashen.appearance.v2'?value:null;}}});
    const first=await import('../src/ashen-reach/startup-appearance.js?valid');
    const early=first.loadStartupAppearance(new URLSearchParams()),main=first.loadStartupAppearance(new URLSearchParams());
    assert.equal(early,main);assert.deepEqual((await early).loaded.appearance,defaultAppearance());
    assert(reads>0);
    value='{invalid';
    const corrupt=await import('../src/ashen-reach/startup-appearance.js?corrupt');
    const result=await corrupt.loadStartupAppearance(new URLSearchParams());
    assert.equal(result.loaded.restored,false);assert(result.loaded.warning);assert.equal(value,'{invalid');
    assert.equal(await corrupt.loadStartupAppearance(new URLSearchParams('creator')),null);
    Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('storage denied');}});
    assert.equal(await corrupt.loadStartupAppearance(new URLSearchParams()),null);
  } finally {if(storageBefore)Object.defineProperty(globalThis,'localStorage',storageBefore);else delete globalThis.localStorage;}
});
test('prefetch and main share one manifest and decompression; refinement selects full pieces',async()=>{
  const original=globalThis.fetch,requests=new Map();
  const body={url:'/body.bin',bytes:3},compact={url:'/compact.bin',bytes:3},full={url:'/full.bin',bytes:3};
  globalThis.fetch=async url=>{requests.set(url,(requests.get(url)||0)+1);return new Response(url.endsWith('manifest.json')?JSON.stringify({shapeFamily:'ashen-human-shape-v1',targetNames:['slender','stout'],items:{body,wayfarerTunic:full},compactItems:{body,wayfarerTunic:compact}}):new Uint8Array([1,2,3]));};
  try {
    const api=await import('../src/ashen-reach/startup-fetch.js?shared');
    const [early,main]=await Promise.all([api.preloadHumanShapePack({torso:'wayfarerTunic'},{compact:true}),api.preloadHumanShapePack({torso:'wayfarerTunic'},{compact:true})]);
    assert.equal(early.fullManifest,main.fullManifest);
    assert.equal(api.startupAssetBuffer(body),api.startupAssetBuffer(main.items.body));
    assert.deepEqual(new Uint8Array(await api.startupAssetBuffer(compact)),new Uint8Array([1,2,3]));
    await api.preloadHumanShapePack({torso:'wayfarerTunic'});await api.startupAssetBuffer(full);
    for(const url of ['/ashen-reach/human-shape-v1/manifest.json','/body.bin','/compact.bin','/full.bin'])assert.equal(requests.get(url),1,url);
  } finally {globalThis.fetch=original;}
});
test('failed speculative manifest and asset requests can retry through the same loader',async()=>{
  const original=globalThis.fetch;let manifestCalls=0,assetCalls=0;
  globalThis.fetch=async url=>url.endsWith('manifest.json')?(++manifestCalls===1?new Response('',{status:500}):new Response(JSON.stringify({shapeFamily:'ashen-human-shape-v1',targetNames:['slender','stout'],items:{body:{url:'/body-ok.bin',bytes:1}},compactItems:{}}))):url==='/body-ok.bin'?new Response(new Uint8Array([7])):(++assetCalls===1?new Response('',{status:500}):new Response(new Uint8Array([7])));
  try {
    const api=await import('../src/ashen-reach/startup-fetch.js?retry');
    await assert.rejects(api.preloadHumanShapePack(),/HTTP 500/);
    await api.preloadHumanShapePack();
    assert.equal(manifestCalls,2);
    const asset={url:'/retry.bin',bytes:1};await assert.rejects(api.startupAssetBuffer(asset),/HTTP 500/);
    assert.deepEqual(new Uint8Array(await api.startupAssetBuffer(asset)),new Uint8Array([7]));assert.equal(assetCalls,2);
  } finally {globalThis.fetch=original;}
});
test('shared asset loader accepts equipment options and retains first request priority',async()=>{
  const original=globalThis.fetch, requests=[];
  globalThis.fetch=async (url,options)=>{
    assert(['high','low','auto'].includes(options.priority));
    requests.push({url,...options});
    return new Response(new Uint8Array([7]));
  };
  try {
    const api=await import('../src/ashen-reach/startup-fetch.js?priority-options');
    const signal=AbortSignal.abort();
    await api.startupAssetBuffer({url:'/full-detail-not-prefetched.bin',bytes:1},{signal});
    const asset={url:'/low-prefetched.bin',bytes:1};
    const prefetched=api.startupAssetBuffer(asset,{priority:'low'});
    assert.equal(prefetched,api.startupAssetBuffer(asset,{signal,priority:'high'}));
    await prefetched;
    assert.deepEqual(requests,[{url:'/full-detail-not-prefetched.bin',priority:'high'},{url:'/low-prefetched.bin',priority:'low'}]);
  }finally{globalThis.fetch=original;}
});
test('early appearance uses the real v1 and creator migrations and preserves query overrides',async()=>{
  const before=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  try {
    const legacyGear=Object.fromEntries(APPEARANCE_V1_REGISTRY.slots.map(slot=>[slot,DEFAULT_BOOT_GEAR[slot]]));
    const v1=appearanceFromEquipment({race:'human',loadout:legacyGear},APPEARANCE_V1_REGISTRY);
    assert.throws(()=>appearanceFromEquipment({race:'human',loadout:DEFAULT_BOOT_GEAR},APPEARANCE_V1_REGISTRY),{code:'UNKNOWN_FIELD'});
    for(const [key,record] of [['ashen.appearance.v1',v1],['ashen.creator.v1',{schemaVersion:1,race:'human',controls:{height:1.15,build:{slender:0,stout:.95}}}]]) {
      Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(name){return name===key?JSON.stringify(record):null;}}});
      const api=await import(`../src/ashen-reach/startup-appearance.js?${key}`),result=await api.loadStartupAppearance(new URLSearchParams());
      assert(result.loaded.restored&&result.loaded.migrated);assert.equal(result.loaded.appearance.schemaVersion,2);
      if(key==='ashen.creator.v1'){assert.equal(result.loaded.appearance.shape.build,.95);assert(usesHumanShapeStarter(result.loaded.appearance));}
      for(const query of ['creator','humanShape=stout','preloadedEquipment'])assert.equal(await api.loadStartupAppearance(new URLSearchParams(query)),null);
    }
  } finally {if(before)Object.defineProperty(globalThis,'localStorage',before);else delete globalThis.localStorage;}
});
test('gzip size mismatch releases its promise and missing compact pieces fail explicitly',async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async url=>url.endsWith('manifest.json')?new Response(JSON.stringify({shapeFamily:'ashen-human-shape-v1',targetNames:['slender','stout'],items:{body:{url:'/body.bin',bytes:1}},compactItems:{}})):new Response(gzipSync(new Uint8Array(++calls===1?[1]:[1,2])));
  try {
    const api=await import('../src/ashen-reach/startup-fetch.js?gzip'),asset={url:'/gzip.bin',bytes:2,compression:'gzip'};
    await assert.rejects(api.startupAssetBuffer(asset),/Unexpected size/);
    assert.deepEqual(new Uint8Array(await api.startupAssetBuffer(asset)),new Uint8Array([1,2]));assert.equal(calls,2);
    await assert.rejects(api.preloadHumanShapePack({}, {compact:true}),/Missing compact Human piece: body/);
  } finally {globalThis.fetch=original;}
});

test('embedded identity catalogue shares one promise without a request; malformed data can retry',async()=>{
  const originalFetch=globalThis.fetch,originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');let calls=0;
  let content=JSON.stringify({schema:1,provenance:{sha256:'test'},presets:{}});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById(id){assert.equal(id,'ashen-human-identity-catalogue');return {type:'application/json',textContent:content};}}});
  globalThis.fetch=()=>{calls++;throw Error('Embedded catalogue must avoid the request');};
  try{
    const api=await import('../src/ashen-reach/startup-fetch.js?embedded');
    const early=api.preloadHumanIdentityCatalogue(),main=api.preloadHumanIdentityCatalogue();assert.equal(early,main);
    assert.deepEqual(await early,JSON.parse(content));assert.equal(calls,0);
    api.invalidateHumanIdentityCatalogue();content='{invalid';await assert.rejects(api.preloadHumanIdentityCatalogue(),SyntaxError);
    content=JSON.stringify({schema:1});assert.deepEqual(await api.preloadHumanIdentityCatalogue(),{schema:1});assert.equal(calls,0);
  }finally{globalThis.fetch=originalFetch;if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else delete globalThis.document;}
});
