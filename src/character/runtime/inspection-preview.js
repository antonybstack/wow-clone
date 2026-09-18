import {playAnimation, stopAnimation, setAnimationWeight, updateAnimationManager} from '@babylonjs/lite';

/** Diagnostic playback on the actor's existing manager; never owns gameplay input. */
export function createInspectionPreview(visual) {
    const groups = visual.groups;
    const saved = groups.map(group => ({group, mask: group.mask, speed: group.speedRatio, loop: group.loopAnimation}));
    const options = [
        {id:'idle', label:'Idle', clips:[visual.idle]},
        {id:'walk', label:'Walk', clips:[visual.walk]},
        {id:'run', label:'Run', clips:[visual.sprint]},
        {id:'jump', label:'Jump takeoff', clips:[visual.jumpStart]},
        {id:'land', label:'Landing', clips:[visual.jumpLand]},
        {id:'fire', label:'Fire Blast', clips:[visual.idle, visual.spellShoot, visual.castLower], layered:true},
        {id:'lava', label:'Lava Ball', clips:[visual.idle, visual.castMotions?.lava?.upper, visual.castMotions?.lava?.lower], layered:true},
    ].filter(option => option.clips.every(Boolean));
    let selected, time = 0, paused = false;
    const halt = () => { for (const group of groups) { stopAnimation(group); setAnimationWeight(group, 0); } };
    const ease = x => { x = Math.max(0, Math.min(1, x)); return x*x*(3-2*x); };
    const duration = () => selected?.clips[selected.layered ? 1 : 0]?.duration || 1;
    const evaluate = () => {
        if (!selected) return;
        selected.clips.forEach((group, index) => {
            // Explicit seeking with a zero delta gives a genuinely frozen skinned pose.
            group.currentTime = index === 0 && selected.layered ? time % (group.duration || 1) : Math.min(time, group.duration - 0.00001);
            const weight = selected.layered && index > 0 ? ease(time/.09)*ease((duration()-time)/.18) : 1;
            setAnimationWeight(group, weight);
        });
        updateAnimationManager(visual.manager, 0);
    };
    const select = id => {
        const option = options.find(item => item.id === id);
        if (!option) throw new Error(`Unavailable inspection animation: ${id}`);
        halt(); selected = option; time = 0;
        for (const group of selected.clips) {
            group.mask = undefined; group.speedRatio = 1; group.loopAnimation = true;
            playAnimation(group); setAnimationWeight(group, 1);
        }
        evaluate();
    };
    select('idle');
    return {
        options: options.map(({id,label})=>({id,label})), select,
        setPaused(value) { paused = !!value; },
        seek(value) { if (Number.isFinite(value)) { time = Math.max(0,Math.min(duration()-0.00001,value)); paused = true; evaluate(); } },
        update(dt) { if (!paused) time = (time + dt) % duration(); evaluate(); },
        getState: () => ({id:selected.id, time, duration:duration(), paused}),
        dispose() { halt(); for (const {group,mask,speed,loop} of saved) { group.mask=mask;group.speedRatio=speed;group.loopAnimation=loop; } },
    };
}
