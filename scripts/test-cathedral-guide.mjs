import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cathedralGuideLevels,cathedralGuideLocation,floorRouteSegments,stairDiagram,stairDiagramPosition} from '../src/ashen-reach/cathedral-guide-data.js';
const cathedral=JSON.parse(fs.readFileSync('public/ashen-reach/startup/starter/manifest.json')).metadata.cathedral;
const levels=cathedralGuideLevels(cathedral);
test('guide derives five distinct levels and separates flat routes from vertical stairs',()=>{
 assert.deepEqual(levels.map(l=>l.id),['ground','undercroft','gallery','west-bell','east-bell']);
 for(const l of levels){assert(l.directions.length>=2);assert(l.markers.every(m=>m.point.every(Number.isFinite)));
  for(const segment of l.segments??[])for(const p of segment)assert(Math.abs(p[1]-l.floorY)<.2);
  if(l.stair){const d=stairDiagram(l.stair);assert(d.slice(1).every((p,i)=>p.distance>d[i].distance&&p.height>d[i].height));assert.equal(d.at(-1).height,l.floorY-cathedral.floorY);}
 }
 assert.deepEqual(floorRouteSegments([[0,0,0],[1,0,1],[2,5,2],[3,5,3]],0),[[[0,0,0],[1,0,1]]]);
});
test('tower diagram clamps settled feet to landing and interpolates intermediate runs',()=>{
 const points=cathedral.exploration.towers[0].route,d=stairDiagram(points),top=d.at(-1);
 assert.equal(stairDiagramPosition(points,top.height+.12).distance,top.distance);
 assert.equal(stairDiagramPosition(points,-.12).distance,0);
 const mid=stairDiagramPosition(points,(d[1].height+d[2].height)/2);
 assert(Math.abs(mid.distance-(d[1].distance+d[2].distance)/2)<1e-8);
});
test('player level uses authored altitude and tower footprint instead of a top-down nearest marker',()=>{
 const e=cathedral.exploration;
 assert.equal(cathedralGuideLocation(levels,cathedral.entry),'ground');
 assert.equal(cathedralGuideLocation(levels,e.undercroft.route[8]),'undercroft');
 assert.equal(cathedralGuideLocation(levels,e.gallery[1]),'gallery');
 assert.equal(cathedralGuideLocation(levels,e.parapet[0]),'gallery');
 for(const t of e.towers){assert.equal(cathedralGuideLocation(levels,t.base),'ground');assert.equal(cathedralGuideLocation(levels,t.route[8]),t.id);assert.equal(cathedralGuideLocation(levels,t.landing),t.id);}
 assert.equal(cathedralGuideLocation(levels,[0,cathedral.floorY,0]),null);
 assert.equal(cathedralGuideLocation(levels,[0,cathedral.floorY+4,328]),null);
 assert.equal(cathedralGuideLocation(levels,[-7,cathedral.exploration.undercroft.floorY,100]),null);
});
test('guide follows changed route/floor metadata and safely omits unsupported worlds',()=>{
 const k=structuredClone(cathedral);
 function lift(value){if(Array.isArray(value)){if(value.length===3&&value.every(Number.isFinite))value[1]+=10;else value.forEach(lift);}else if(value&&typeof value==='object'){for(const [key,v]of Object.entries(value)){if(key==='floorY')value[key]+=10;else lift(v);}}}
 lift(k);const shifted=cathedralGuideLevels(k);assert.equal(shifted[0].floorY,levels[0].floorY+10);
 assert.equal(shifted[0].segments.length,levels[0].segments.length);
 assert.equal(cathedralGuideLocation(shifted,k.exploration.gallery[0]),'gallery');
 assert.equal(cathedralGuideLocation(shifted,k.exploration.towers[1].landing),'east-bell');
 assert.deepEqual(cathedralGuideLevels(null),[]);
 assert.deepEqual(cathedralGuideLevels({exploration:{}}),[]);
});
