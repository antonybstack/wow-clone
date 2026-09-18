/** Source-65 fitted-hand grips. Keep native body curves; mask only the finger joints.
 * Rest/closed samples are from the shipped source Idle_Loop, in its original units.
 * The fitted fingers already bend in bind pose, so its full closed fist over-curls.
 */
import {createAnimationGroupMask, getBoneByName, setBonePoseDeferred, updateAnimationManager} from '@babylonjs/lite';
import samples from './source-hand-poses.json';
const names = samples.map(sample => sample.name), fingers = new Set(names);
const cache = new WeakMap();
function mixRotation(a,b,t) {
    const sign = a.reduce((v,x,i)=>v+x*b[i],0)<0?-1:1;
    const q=a.map((x,i)=>x*(1-t)+b[i]*t*sign), n=Math.hypot(...q);
    return q.map(x=>x/n);
}
const amounts={shaft:[.58,.72,.60],relaxed:[.12,.22,.12]};
function pose(sample,kind) {
    const segment=Number(sample.name.at(-1))-1;
    const t=sample.name.includes('Thumb') ? ({shaft:[.8,.5,.3],relaxed:[.1,.1,.08]}[kind])[segment] : amounts[kind][segment];
    return mixRotation(sample.rest,sample.closed,t);
}
const rotations=Object.fromEntries(Object.keys(amounts).map(kind=>[kind,samples.map(sample=>pose(sample,kind))]));
export function evaluateHandAnimation(visual,deltaMs) {
    if (!visual.handGrips) {updateAnimationManager(visual.manager,deltaMs);return;}
    let state=cache.get(visual);
    if(!state){state={bones:samples.map(s=>getBoneByName(visual.skeleton,s.name)),masks:new WeakMap(),plain:createAnimationGroupMask(names,1)};cache.set(visual,state);}
    const active=visual.handGrips();
    // Write deferred overrides before the single native evaluation, never bake a
    // skeleton afterward: baking would replace the evaluated whole-body pose.
    for(let i=0;i<samples.length;i++){
        const s=samples[i],kind=active?.[s.name.includes('Right')?'right':'left'];
        if(state.bones[i])setBonePoseDeferred(visual.skeleton,state.bones[i],...s.position,...(kind?rotations[kind][i]:s.rest));
    }
    if(!active){updateAnimationManager(visual.manager,deltaMs);return;}
    const saved=visual.groups.map(g=>g.mask);
    for(const group of visual.groups){
        const mask=group.mask;
        if(!mask||mask.disabled){group.mask=state.plain;continue;}
        let filtered=state.masks.get(mask);
        if(!filtered){filtered=createAnimationGroupMask(mask.mode===0?mask.names.filter(n=>!fingers.has(n)):[...new Set([...mask.names,...names])],mask.mode);state.masks.set(mask,filtered);}
        group.mask=filtered;
    }
    try{updateAnimationManager(visual.manager,deltaMs);}
    finally{visual.groups.forEach((g,i)=>{g.mask=saved[i];});}
}
