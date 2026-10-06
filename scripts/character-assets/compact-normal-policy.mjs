import assert from 'node:assert/strict';

// Offline floating normal rounding only. Positions, UVs, weights, binds and
// source curves remain exact; morph normal offsets are never clamped to [-1,1].
// https://github.com/zeux/meshoptimizer/blob/v0.22/js/README.md#encoder
export const COMPACT_NORMAL_TOLERANCE=0.0001;
export function verifyCompactNormalPolicy(policy,sourceGeometrySha256){
 assert.deepEqual(Object.keys(policy??{}).sort(),['schema','method','tolerance','sourceGeometrySha256','measuredMaxComponentError'].sort(),'Invalid compact normal policy fields');
 assert.equal(policy.schema,1);assert.equal(policy.method,'meshopt-exp16-float32');
 assert.equal(policy.tolerance,COMPACT_NORMAL_TOLERANCE,'Unreviewed normal tolerance');
 assert(/^[a-f0-9]{64}$/.test(policy.sourceGeometrySha256),'Missing unrounded geometry fingerprint');
 if(sourceGeometrySha256!==undefined)assert.equal(policy.sourceGeometrySha256,sourceGeometrySha256,'Compact normal source differs from the full body');
 assert(Number.isFinite(policy.measuredMaxComponentError)&&policy.measuredMaxComponentError>=0&&policy.measuredMaxComponentError<=COMPACT_NORMAL_TOLERANCE,'Normal rounding exceeds its declared bound');
 return policy;
}
export function compactNormalPolicy(result){
 assert.equal(result.method,'exp16','Fixed normal quantization is not a release policy');
 return verifyCompactNormalPolicy({schema:1,method:'meshopt-exp16-float32',tolerance:COMPACT_NORMAL_TOLERANCE,
  sourceGeometrySha256:result.sourceGeometrySha256,measuredMaxComponentError:result.measured.maxComponentError});
}
