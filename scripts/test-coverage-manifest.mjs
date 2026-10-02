import test from 'node:test';import assert from 'node:assert/strict';
import {manifestBodyCoverage,PUBLISHED_COVERAGE_REVISION} from '../src/ashen-reach/coverage-manifest.js';
const fixture=()=>({items:{body:{meshes:['HumanV1Body','HumanTorsoCore'],coverageRevision:PUBLISHED_COVERAGE_REVISION}},coverage:{schema:1,revision:PUBLISHED_COVERAGE_REVISION,race:'human',bodySegments:{HumanV1Body:['head.face','hand'],HumanTorsoCore:['torso.upper','torso.lower','waist']}}});
test('legacy packs do not pretend to have published body geosets',()=>assert.equal(manifestBodyCoverage({items:{body:{meshes:['HumanV1Body']}}},'human'),null));
test('published adapter is exact and independent from equipment slot names',()=>{
 const result=manifestBodyCoverage(fixture(),'human');assert.deepEqual(result.baseMeshes,['HumanV1Body','HumanTorsoCore']);assert.deepEqual(result.bodySegments.HumanTorsoCore,['torso.upper','torso.lower','waist']);
});
test('wrong revision/race, missing core, unknown semantics and stale body revisions fail closed',()=>{
 for(const mutate of [m=>m.coverage.revision='future',m=>m.coverage.race='undead',m=>m.items.body.meshes.pop(),m=>m.coverage.bodySegments.HumanTorsoCore=['torso'],m=>delete m.items.body.coverageRevision,m=>m.coverage.bodySegments.HumanTorsoCore=['waist','waist']]){const m=fixture();mutate(m);assert.throws(()=>manifestBodyCoverage(m,'human'));}
});
