import test from 'node:test';
import assert from 'node:assert/strict';
import {createRegionProgressReporter,regionProgressLabel} from '../src/ashen-reach/region-progress.js';
test('processing notifications throttle intermediate ranges but preserve phase and completion',()=>{
 let now=0;const seen=[],report=createRegionProgressReporter(p=>seen.push(p),()=>now);
 report({phase:'index'});report({phase:'surfaces',processed:0,total:4,encodedBytes:22401010});
 now=100;report({phase:'surfaces',processed:1,total:4});now=500;report({phase:'surfaces',processed:2,total:4});
 now=501;report({phase:'surfaces',processed:4,total:4});report({phase:'surfaces',processed:4,total:4});
 report({phase:'supports',processed:0,total:2});report({phase:'supports',processed:2,total:2});report({phase:'detail',processed:0,total:5});
 assert.deepEqual(seen.map(p=>[p.phase,p.processed]),[['index',undefined],['surfaces',0],['surfaces',2],['surfaces',4],['supports',0],['supports',2],['detail',0]]);
});
test('retry gets a fresh attempt counter and publication snapshots do not alias input',()=>{
 const seen=[],value={phase:'surfaces',processed:3,total:4};createRegionProgressReporter(p=>seen.push(p),()=>0)(value);value.processed=4;
 createRegionProgressReporter(p=>seen.push(p),()=>0)({phase:'surfaces',processed:0,total:4});
 assert.deepEqual(seen.map(p=>p.processed),[3,0]);
});
test('phase labels distinguish static packet size and optional work without invented timing',()=>{
 assert.match(regionProgressLabel({phase:'surfaces',encodedBytes:22401010}),/22\.4 MB packet/);
 assert.match(regionProgressLabel({phase:'surfaces',encodedBytes:14389733}),/14\.4 MB packet/);
 for(const phase of ['detail','foliage','finishing'])assert.match(regionProgressLabel({phase}),/routes are open/);
 for(const phase of ['index','surfaces','supports','detail','foliage','finishing'])assert.doesNotMatch(regionProgressLabel({phase,encodedBytes:14389733}),/percent|seconds|%|downloaded/);
});
