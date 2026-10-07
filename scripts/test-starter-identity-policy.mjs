import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compactStarterIdentity} from '../src/ashen-reach/starter-identity-policy.js';
import {manifestBodyCoverage} from '../src/ashen-reach/coverage-manifest.js';
const index=JSON.parse(fs.readFileSync('public/ashen-reach/human-identity-v1/manifest.json','utf8'));
const pony=index.presets['prime-ponytail'].manifest,bald=index.presets['prime-bald'].manifest;

test('covered startup retains selected recipe and clothes, using only the proved visible body',()=>{
 const compact=compactStarterIdentity(pony,bald,{helmet:'graveweaverHood'},true);
 assert.equal(compact.items.body,bald.compactItems.body);
 assert.equal(compact.identity,pony.identity);
 assert.equal(compact.fullManifest,pony);
 assert.equal(compact.deferredIdentityBody,pony.compactItems.body);
 assert.equal(compact.items.graveweaverHood,pony.compactItems.graveweaverHood);
 assert.equal(compact.startup,bald.startup);
 assert(!manifestBodyCoverage(compact,'human').baseMeshes.includes('HumanPonytail01'));
 assert.equal(pony.items.body.meshes.includes('HumanPonytail01'),true,'Source descriptor must stay complete');
});

test('uncovered hair and a disabled trial retain the full selected compact body',()=>{
 for(const [loadout,enabled]of [[{helmet:null},true],[{torso:'graveweaverTop'},true],[{helmet:'graveweaverHood'},false]]){
  const compact=compactStarterIdentity(pony,bald,loadout,enabled);
  assert.equal(compact.items.body,pony.compactItems.body);
  assert.equal(compact.deferredIdentityBody,undefined);
 }
});

test('new or missing assets safely retain the selected identity pending a fresh proof',()=>{
 for(const fallback of [undefined,{...bald,compactItems:{...bald.compactItems,body:{...bald.compactItems.body,sha256:'updated'}}}])
  assert.equal(compactStarterIdentity(pony,fallback,{helmet:'graveweaverHood'},true).items.body,pony.compactItems.body);
 const updated={...pony,compactItems:{...pony.compactItems,body:{...pony.compactItems.body,sha256:'updated'}}};
 assert.equal(compactStarterIdentity(updated,bald,{helmet:'graveweaverHood'},true).items.body,updated.compactItems.body);
});

test('other heads and hairstyles keep their authored body',()=>{
 for(const id of ['prime-bald','weathered-bald']){
  const full=index.presets[id].manifest;
  assert.equal(compactStarterIdentity(full,bald,{helmet:'graveweaverHood'},true).items.body,full.compactItems.body);
 }
});
