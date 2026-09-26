import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerLateFeatures} from '../src/ashen-reach/register-late-features.js';

test('late features prepare after unregister and await shadow-aware registration', async()=>{
  const scene={id:'scene'};
  const calls=[];
  let complete;
  const pending=new Promise(resolve=>{complete=resolve;});
  const result=registerLateFeatures(scene,
    ()=>{calls.push('prepare');assert.deepEqual(calls,['unregister','prepare']);},
    value=>{assert.strictEqual(value,scene);calls.push('unregister');},
    async value=>{assert.strictEqual(value,scene);calls.push('register');await pending;calls.push('registered');});
  assert.deepEqual(calls,['unregister','prepare','register']);
  complete();
  await result;
  assert.deepEqual(calls,['unregister','prepare','register','registered']);
});

test('a registration failure reaches the loader', async()=>{
  await assert.rejects(registerLateFeatures({},()=>{},()=>{},async()=>{throw Error('late shader failed');}),
    /late shader failed/);
});
