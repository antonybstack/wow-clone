import test from 'node:test';import assert from 'node:assert/strict';
import {height,legacyHeight} from '../src/ashen-reach/geometry.js';
import {REGION_ROUTES,REGION_LANDMARKS} from '../src/ashen-reach/region-layout.js';
test('every destination has a continuous route with four metre clearance and walkable grade',()=>{
 for(const route of REGION_ROUTES){assert(route.width>=4);assert(route.points.length>1);for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i],run=Math.hypot(b[0]-a[0],b[2]-a[2]);assert(run>0&&run<=2.01);assert(Math.abs(b[1]-a[1])/run<=Math.tan(20*Math.PI/180)+.001,`${route.id} segment${i}: ${Math.atan(Math.abs(b[1]-a[1])/run)*180/Math.PI} degrees`);}}
 for(const l of REGION_LANDMARKS.filter(l=>l.kind!=='cathedral'))assert(l.route?.length);
});
test('destination pads coincide with physical floor datum and remain finite',()=>{
 for(const l of REGION_LANDMARKS.filter(l=>l.kind==='keep'||l.kind==='tower'))assert(Math.abs(height(l.x,l.z)-(l.floorY-.1))<.0001,l.id);
 assert.equal(height(0,0),legacyHeight(0,0));
});
