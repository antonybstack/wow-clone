import assert from 'node:assert/strict';

/** Meshopt's triangle codec may rotate a triangle's provoking vertex. Allow
 * only that representation change: retain face order, multiplicity and winding.
 * These opaque PBR pieces do not use a provoking-vertex/flat per-face payload.
 * https://github.com/zeux/meshoptimizer#index-compression
 */
export function assertTriangleRotations(actual,expected,label='Triangle indices'){
 assert.equal(actual.length,expected.length,`${label}: triangle count changed`);
 assert.equal(actual.length%3,0,`${label}: incomplete triangle`);
 for(let i=0;i<actual.length;i+=3){
  const [a,b,c]=actual.subarray(i,i+3),[x,y,z]=expected.subarray(i,i+3);
  assert((a===x&&b===y&&c===z)||(a===y&&b===z&&c===x)||(a===z&&b===x&&c===y),`${label}: face order, winding or vertices changed at ${i/3}`);
 }
}
