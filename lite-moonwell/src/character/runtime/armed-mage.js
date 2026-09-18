import {parseGlb,glbWriter} from './glb.js';

/** Append authored rotations/Hips translation after fit composition; preserve binds. */
export function applyArmedMage(buffer, pose) {
    if (![1,2].includes(pose?.schema) || pose.profileId !== 'human-v1') throw new Error('Invalid armed mage pose');
    const {json,binary}=parseGlb(buffer);
    for (let i=0;i<pose.nodeNames.length;i++) {
        if (json.nodes[i]?.name !== pose.nodeNames[i]) throw new Error('Armed mage node layout mismatch');
    }
    const writer=glbWriter(json,binary), names=new Map(json.nodes.map((n,i)=>[n.name,i]));
    for (const clip of pose.clips) {
        const animation=json.animations.find(a=>a.name===clip.name);
        if (!animation || clip.times.length<2 || clip.times.some((v,i)=>!Number.isFinite(v)||(i&&v<=clip.times[i-1]))) throw new Error('Invalid armed mage clip');
        const input=writer.append(new Float32Array(clip.times),'SCALAR',true);
        for (const [name,rotations] of Object.entries(clip.rotations)) {
            const node=names.get(name);
            if (node==null || !/^(Left|Right)(Arm|ForeArm|Hand|Shoulder|UpLeg|Leg|Foot|ToeBase)$|^(upperarm02|lowerarm02|pelvis|upperleg02|lowerleg02|shoulder01)\.[LR]$|^finger[1-5]-[1-3]\.R$|^(Hips|Spine|Spine2|spine0[124]|Neck|neck0[23]|Head)$/.test(name)) throw new Error('Invalid armed mage bone');
            if (rotations.length!==clip.times.length || rotations.some(q=>q.length!==4||q.some(v=>!Number.isFinite(v))||Math.abs(Math.hypot(...q)-1)>.001)) throw new Error('Invalid armed mage quaternion');
            const output=writer.append(new Float32Array(rotations.flat()),'VEC4');
            const sampler=animation.samplers.push({input,output,interpolation:'LINEAR'})-1;
            const existing=animation.channels.find(c=>c.target.node===node&&c.target.path==='rotation');
            if (existing) existing.sampler=sampler;
            else animation.channels.push({sampler,target:{node,path:'rotation'}});
        }
        for (const [name,values] of Object.entries(clip.translations||{})) {
            if (pose.schema!==2 || name!=='Hips' || !names.has(name) || values.length!==clip.times.length || values.some(v=>v.length!==3||v.some(x=>!Number.isFinite(x)))) throw new Error('Invalid armed mage translation');
            const node=names.get(name),output=writer.append(new Float32Array(values.flat()),'VEC3');
            const sampler=animation.samplers.push({input,output,interpolation:'LINEAR'})-1;
            const existing=animation.channels.find(c=>c.target.node===node&&c.target.path==='translation');
            if(existing)existing.sampler=sampler;
            else animation.channels.push({sampler,target:{node,path:'translation'}});
        }
    }
    return writer.finish();
}

/** Cadence belongs to the authored in-place stride, scaled by actual travel. */
export function armedMagePlayback(pose, name, speed) {
    const gait=pose?.locomotion?.[name],clip=pose?.clips?.find(c=>c.name===name);
    if (!gait || !clip) return null;
    if (!(gait.cycleSeconds>0 && gait.speed>0 && Number.isFinite(speed))) throw new Error('Invalid mage cadence');
    return clip.times.at(-1)/gait.cycleSeconds*Math.min(1.5,Math.max(.15,Math.abs(speed)/gait.speed));
}

export function armedMageGrip(pose, authoredOffset) {
    // Lite's socket decomposition reverses bone-local Y relative to the GLB.
    // Measured using MCP joint positions in the live wrist frame.
    const c=pose.grip.center,a=pose.grip.axis;
    const x=a[2],z=-a[0],w=1-a[1],length=Math.hypot(x,z,w);
    return {position:{x:c[0]-authoredOffset[0],y:-c[1]-authoredOffset[1],z:c[2]-authoredOffset[2]},
        rotationQuaternion:{x:x/length,y:0,z:z/length,w:w/length}};
}
