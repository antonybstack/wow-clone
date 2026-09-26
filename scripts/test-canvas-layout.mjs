import {test} from 'node:test';
import assert from 'node:assert/strict';
import {observeCanvasLayout} from '../src/ashen-reach/canvas-layout.js';
test('HUD layout caches CSS size and offset, ignores hidden size and disconnects', () => {
 let reads=0, callback, observed, disconnected=false;
 let rect={left:24,top:48};
 const canvas={get clientWidth(){reads++;return 1280;},get clientHeight(){reads++;return 720;},getBoundingClientRect(){reads++;return rect;}};
  class Observer {constructor(fn){callback=fn;} observe(v){observed=v;} disconnect(){disconnected=true;}}
  const layout=observeCanvasLayout(canvas,Observer);
 assert.equal(observed,canvas);assert.deepEqual(layout.size,{width:1280,height:720,left:24,top:48});
  for(let i=0;i<100;i++)assert.equal(layout.size.width,1280);
 assert.equal(reads,3);
 rect={left:16,top:32};
 callback([{target:canvas,contentRect:{width:391,height:843}}]);
 assert.deepEqual(layout.size,{width:391,height:843,left:16,top:32});
 callback([{target:canvas,contentRect:{width:0,height:0}}]);
 assert.deepEqual(layout.size,{width:391,height:843,left:16,top:32});
  layout.dispose();assert.equal(disconnected,true);
});
