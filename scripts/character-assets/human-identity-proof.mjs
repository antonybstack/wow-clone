/** Lossless mesh/curve fingerprints, independent of accessor placement and
 * meshopt's allowed triangle corner rotation. This never retargets a source.
 * https://github.com/zeux/meshoptimizer/blob/v0.22/README.md#lossless-index-buffer-compression
 */
import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const array=accessor=>Array.from(accessor.getArray());
export function identityGeometryHash(root){
 return hash(root.listMeshes().map(mesh=>({name:mesh.getName(),extras:mesh.getExtras(),weights:mesh.getWeights(),primitives:mesh.listPrimitives().map(p=>({
  mode:p.getMode(),material:p.getMaterial()?.getName(),
  attributes:p.listSemantics().sort().map(s=>[s,p.getAttribute(s).getNormalized(),array(p.getAttribute(s))]),
  targets:p.listTargets().map(t=>t.listSemantics().sort().map(s=>[s,array(t.getAttribute(s))])),
  indices:Array.from({length:p.getIndices().getCount()/3},(_,i)=>{const a=Array.from(p.getIndices().getArray().subarray(i*3,i*3+3)),k=a.indexOf(Math.min(...a));return a.slice(k).concat(a.slice(0,k));}),
 }))})));
}
export function identityAnimationHash(root,{names=null}={}){
 return hash(root.listAnimations().filter(a=>!names||names.has(a.getName())).map(a=>({name:a.getName(),channels:a.listChannels().map(c=>({
  node:c.getTargetNode().getName(),path:c.getTargetPath(),interpolation:c.getSampler().getInterpolation(),
  input:array(c.getSampler().getInput()),output:array(c.getSampler().getOutput()),
 }))})));
}
