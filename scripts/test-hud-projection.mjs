import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFreeCamera} from '@babylonjs/lite';
import {createHudProjection} from '../src/ashen-reach/hud-projection.js';

test('HUD projection culls depth and offscreen points while reusing its result', () => {
  const canvas={width:1280,height:720};
  const layout={size:{width:1280,height:720,left:0,top:0}};
  const camera=createFreeCamera({x:0,y:0,z:0},{x:0,y:0,z:1});
  const projection=createHudProjection(canvas,layout);
  projection.begin(camera);
  const front=projection.project({x:0,z:10},0);
  assert(front);
  assert.equal(front.cssX,640);
  assert.equal(front.cssY,360);
  assert.equal(projection.project({x:0,z:-10},0),null);
  assert.equal(projection.project({x:0,z:0.1},0),null);
  assert.equal(projection.project({x:0,z:20000},0),null);
  assert.equal(projection.project({x:100,z:10},0),null);
  assert.strictEqual(projection.project({x:0,z:10},0),front);
});

test('HUD projection uses active viewport and CSS dimensions across resize and DPR', () => {
  const canvas={width:2560,height:1440};
  const layout={size:{width:1280,height:720,left:24,top:48}};
  const camera=createFreeCamera({x:0,y:0,z:0},{x:0,y:0,z:1});
  camera.viewport={x:0.25,y:0,width:0.5,height:1};
  const projection=createHudProjection(canvas,layout);
  projection.begin(camera);
  const center=projection.project({x:0,z:10},0);
  assert.equal(center.cssX,640);
  assert.equal(center.cssY,360);
  canvas.width=780;canvas.height=1688;
  layout.size.width=390;layout.size.height=844;
  camera.viewport={x:0,y:0,width:1,height:1};
  projection.begin(camera);
  const portrait=projection.project({x:0,z:10},0);
  assert.strictEqual(portrait,center);
  assert.equal(portrait.cssX,195);
  assert.equal(portrait.cssY,422);
  assert.equal(layout.size.left+portrait.cssX,219);
  assert.equal(layout.size.top+portrait.cssY,470);
});
