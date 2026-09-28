import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {audit, compareRig, decodeEntry, sha, validateWeights} from './character-assets/audit-active-character-assets.mjs';
import {summarizeFrameIntervals} from './character-assets/summarize-frame-intervals.mjs';

const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const joint=(name,parent=null)=>({name,parent,world:[...I],inverseBind:[...I]});
const rig=(joints)=>({joints,meshFrames:[[...I]]});
test('current palette borrowing requires identical order and rejects bind or frame drift',()=>{
  const body=rig([joint('root'),joint('hand','root')]);
  assert.equal(compareRig(body,rig([joint('root'),joint('hand','root')])).status,'valid');
  const reordered=rig([joint('hand','root'),joint('root')]);
  assert.deepEqual(compareRig(body,reordered).jointIndexRemap,[1,0]);
  assert.match(compareRig(body,reordered).reasons.join(),/no vertex remap/);
  reordered.joints[0].inverseBind[12]=0.1;
  assert.match(compareRig(body,reordered).reasons.join(),/inverse bind/);
  reordered.joints[0].inverseBind[12]=0;
  reordered.meshFrames[0][12]=0.1;
  assert.match(compareRig(body,reordered).reasons.join(),/mesh frame/);
});
test('weights enforce finite normalized values and in-range indices',()=>{
  assert.deepEqual(validateWeights([1,0,0,0],[0,0,0,0],2),[]);
  assert.match(validateWeights([NaN,0,0,0],[0,0,0,0],2).join(),/weight sum/);
  assert.match(validateWeights([0.9,0,0,0],[0,0,0,0],2).join(),/weight sum/);
  assert.match(validateWeights([1,0,0,0],[2,0,0,0],2).join(),/invalid influence/);
});
test('declared gzip bytes and decoded identity are both checked',()=>{
  const payload=Buffer.from('fixture');
  const compressed=gzipSync(payload);
  assert.deepEqual(decodeEntry(compressed,{compression:'gzip',encodedBytes:compressed.length,bytes:payload.length,sha256:sha(payload)}),payload);
  assert.throws(()=>decodeEntry(compressed,{compression:'gzip',encodedBytes:1,bytes:payload.length,sha256:sha(payload)}),/encoded/);
  assert.throws(()=>decodeEntry(compressed,{compression:'gzip',encodedBytes:compressed.length,bytes:payload.length,sha256:'bad'}),/SHA/);
});
test('animation payload identity does not change bind compatibility',()=>{
  const a={...rig([joint('root')]),animationSha256:'a'};
  const b={...rig([joint('root')]),animationSha256:'b'};
  assert.notEqual(a.animationSha256,b.animationSha256);
  assert.equal(compareRig(a,b).status,'valid');
});
test('nearest-rank tails and counts agree with raw intervals',()=>{
  const raw=[5,10,7,6,20];
  const s=summarizeFrameIntervals(raw);
  assert.equal(s.p50Ms,7);
  assert.equal(s.p95Ms,20);
  assert.equal(s.p99Ms,20);
  assert.equal(s.above8_33,2);
  assert.equal(s.above16_67,1);
});
test('missing active file fails while preserving prior valid report rows',async()=>{
  const source=await fs.readFile('src/ashen-reach/main.js','utf8');
  assert.match(source,/const UNDEAD_PACK_DIR='equipment-undead'/);
  const read=async (file,...args)=>file.endsWith('/equipment-orc/wayfarerBoots.glb')?Promise.reject(Object.assign(new Error('missing fixture'),{code:'ENOENT'})):fs.readFile(file,...args);
  const report=await audit(undefined,read);
  assert.equal(Object.keys(report.packs).length,4);
  assert.equal(report.packs.human.items.body.status,'valid');
  assert.equal(report.packs.undead.items.graveweaverHood.status,'incompatible');
  assert.equal(report.packs.orc.items.wayfarerBoots.status,'invalid');
  assert.match(report.errors.join(),/orc\/wayfarerBoots: missing fixture/);
});
