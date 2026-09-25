import {test} from 'node:test';
import assert from 'node:assert/strict';
import {observeCanvasLayout} from '../src/ashen-reach/canvas-layout.js';
test('HUD layout is read once, follows CSS resize, ignores hidden size and disconnects', () => {
  let reads=0, callback, observed, disconnected=false;
  const canvas={get clientWidth(){reads++;return 1280;},get clientHeight(){reads++;return 720;}};
  class Observer {constructor(fn){callback=fn;} observe(v){observed=v;} disconnect(){disconnected=true;}}
  const layout=observeCanvasLayout(canvas,Observer);
  assert.equal(observed,canvas);assert.deepEqual(layout.size,{width:1280,height:720});
  for(let i=0;i<100;i++)assert.equal(layout.size.width,1280);
  assert.equal(reads,2);
  callback([{target:canvas,contentRect:{width:391,height:843}}]);
  assert.deepEqual(layout.size,{width:391,height:843});
  callback([{target:canvas,contentRect:{width:0,height:0}}]);
  assert.deepEqual(layout.size,{width:391,height:843});
  layout.dispose();assert.equal(disconnected,true);
});
