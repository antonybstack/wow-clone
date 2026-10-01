import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
// Test-only imports of pinned native source: no GPU, alternate runtime registry
// in a game page, application shader fork, or node_modules modification.
import {_registerPbrExt,PBR2_NO_COLOR_OUTPUT} from '../node_modules/@babylonjs/lite/lib/material/pbr/pbr-flags.js';
import {pbrExt} from '../node_modules/@babylonjs/lite/lib/material/pbr/fragments/vat-fragment.js';
import {createPbrComposer} from '../node_modules/@babylonjs/lite/lib/material/pbr/pbr-compose.js';
import {createThinInstanceFragment} from '../node_modules/@babylonjs/lite/lib/shader/fragments/thin-instance-fragment.js';

const metadata=JSON.parse(await fs.readFile(new URL('../node_modules/@babylonjs/lite/package.json',import.meta.url)));
assert.equal(metadata.version,'1.31.1','Revisit the native composition evidence when migrating Lite');
_registerPbrExt(pbrExt);
const VAT=512,THIN=16;

test('old non-instanced native composer fails on VAT in both color and depth views',()=>{
  for(const features2 of [0,PBR2_NO_COLOR_OUTPUT]){
    const compose=createPbrComposer({_createThinInstanceFragment:null});
    assert.doesNotThrow(()=>compose(0,features2,0));
    assert.doesNotThrow(()=>compose(0,features2,VAT));
    assert.throws(()=>compose(0,features2,VAT|THIN),error=>
      error instanceof Error&&error.stack.includes('topoSort'));
  }
});
test('native composer with thin dependency produces VAT deformation in color and depth',()=>{
  for(const features2 of [0,PBR2_NO_COLOR_OUTPUT]){
    const compose=createPbrComposer({_createThinInstanceFragment:createThinInstanceFragment});
    for(const bones of [0,4]){
      const shader=compose(0,features2,VAT|THIN|bones);
      assert.equal(shader._fragmentKey,'thin-instance|vat');
      assert.match(shader._vertexWGSL,/vatInstWorld\*mesh.world\*influence/);
      assert.match(shader._vertexWGSL,/@builtin\(instance_index\)/);
      assert.match(shader._vertexWGSL,/var vatSampler:texture_2d<f32>/);
      assert.match(shader._vertexWGSL,/var vatInstanceTex:texture_2d<f32>/);
      assert.equal(shader._vertexWGSL.includes('joints1'),bones!==0);
    }
  }
});
