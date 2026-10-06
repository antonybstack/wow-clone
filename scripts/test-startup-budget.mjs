import test from 'node:test';
import assert from 'node:assert/strict';
import {startupBudget} from './lib/startup-budget.mjs';
const rows=Array.from({length:20},(_,i)=>({run:i+1,playableMs:900+i}));
test('full cohort at the inclusive limit passes',()=>{
 const result=startupBudget([...rows.slice(0,19),{run:20,playableMs:1000}],20,1000);
 assert.equal(result.passed,true);assert.equal(result.p95Ms,918);assert.equal(result.worstMs,1000);
});
test('a single tail miss fails even with p95 below budget',()=>{
 const result=startupBudget([...rows.slice(0,19),{run:20,playableMs:1001}],20,1000);
 assert.equal(result.passed,false);assert.equal(result.misses,1);assert.equal(result.p95Ms,918);
});
test('aborted, duplicate and failed cohorts cannot pass',()=>{
 for(const cohort of [rows.slice(0,19),[...rows.slice(0,19),rows[0]],
  [...rows.slice(0,19),{run:20,failed:true}],
  [...rows.slice(0,19),{run:20,playableMs:900,validationFailure:{message:'input failed'}}],
  [...rows.slice(0,19),{run:20,playableMs:NaN}]])
  assert.equal(startupBudget(cohort,20,1000).passed,false);
});
