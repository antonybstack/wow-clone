/** Lite 1.31.1 native thin instances with direct draws and explicit membership
 * invalidation. On this M1 Max, one dressed regional actor takes ~4.9 ms GPU
 * with native indirect arguments versus ~1.15 ms with direct draws. Do not
 * change geometry, shadows or draw extra inactive capacity to conceal the cost.
 *
 * The public count setter otherwise promotes an established direct draw to
 * indirect arguments. A narrowly pinned bridge acknowledges the NEW direct
 * count only after forcing all cached render/shadow bundles to re-record.
 * Matrices, allocation, dirty ranges, swap-removal and retirement remain native.
 * Replace this bridge when Lite offers a public direct-count policy; remeasure
 * both paths on a runtime upgrade. Never use it on an indirect/culling/LOD pool.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/mesh/thin-instance-gpu.ts
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/mesh/mesh-factories.ts
 */
import {VERSION,invalidateRenderBundles,setThinInstanceCount} from '@babylonjs/lite';
export function setDirectInstanceCount(engine,mesh,count){
 const ti=mesh.thinInstances;
 if(VERSION!=='1.31.1'||!ti||ti._drawArgsBuffer||ti._gpuCullingEnabled||ti._lodPartner||ti._lodSource)throw Error('Direct crowd count bridge requires an unculled Lite 1.31.1 direct pool');
 if(!Number.isInteger(count)||count<0||count>ti._capacity)throw RangeError('Direct instance count exceeds capacity');
 if(ti.count===count&&ti._drawArgsInstanceCount===count)return;
 // Invalidation is synchronous and precedes acknowledgement: cached bundles
 // must never keep an older population while the GPU sync sees a new count.
 invalidateRenderBundles(engine);
 setThinInstanceCount(mesh,count);
 ti._drawArgsInstanceCount=count;
}
