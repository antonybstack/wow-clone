import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createActionBindings} from '../src/action-bindings.js';
test('rebind changes keyboard and numpad mapping, persists and restores',()=>{
 const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
 const b=createActionBindings(storage);assert(b.set(1,'Digit8').ok);
 assert.equal(b.action('Digit1'),null);assert.equal(b.action('Numpad8'),'1');
 assert.equal(createActionBindings(storage).key(1),'Digit8');b.reset();assert.equal(b.action('Digit1'),'1');
});
test('conflicting/reserved binds preserve previous settings; corrupt storage restores defaults',()=>{
 const b=createActionBindings();assert.equal(b.set(1,'Digit2').ok,false);assert.equal(b.set(1,'KeyW').ok,false);assert.equal(b.key(1),'Digit1');
 assert.equal(createActionBindings({getItem:()=>'{"1":"KeyW"}'}).key(1),'Digit1');
});
test('preference write failure keeps functional binding and reports session-only change',()=>{
 const b=createActionBindings({setItem(){throw Error('denied')}});let calls=0;const off=b.subscribe(()=>calls++);
 assert.deepEqual(b.set('attack','KeyJ'),{ok:true,saved:false});assert.equal(b.action('KeyJ'),'attack');assert.equal(calls,1);off();b.reset();assert.equal(calls,1);
});
