import { evaluateHandAnimation } from './hand-grip.js';
import { CARRY_WEIGHT, TWO_HAND_STILL_TIME } from './body-visual.js';
import {playAnimation, stopAnimation, setAnimationWeight} from '@babylonjs/lite';

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
        {id:'carry', label:'Two-handed carry (raw source clip)', clips:[visual.twoHand]},
    ].filter(option => option.clips.every(Boolean));
    // Gameplay composition, not a second animation path: when a two-handed
    // prop is held the game layers the carry clip on the arms over the
    // directional gait (body.js updateCarry). The standard options mirror that
    // here so the Armory shows the equipped state instead of a one-handed
    // stand-in; `carry` stays as the unmasked source audition.
    const ARMED_BASE = new Set(['idle', 'walk', 'run', 'jump', 'land']);
    const armedCarry = () => (
        ARMED_BASE.has(selected?.id) && visual.twoHand && visual.carryMask
        && visual.handGrips?.()?.twoHanded ? visual.twoHand : null
    );
    let selected, time = 0, paused = false, carried = null;
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
        const carry = armedCarry();
        if (carry) {
            // Same complementary masks and weight as gameplay: base clips give
            // up the arms, the carry owns them outright.
            for (const group of selected.clips) group.mask = visual.carryLocoMask;
            carry.mask = visual.carryMask;
            carry.loopAnimation = true;
            carry.speedRatio = 1;
            carry.currentTime = selected.id === 'walk' || selected.id === 'run'
                ? time % (carry.duration || 1)
                : TWO_HAND_STILL_TIME;
            if (!carry.isPlaying) playAnimation(carry);
            setAnimationWeight(carry, CARRY_WEIGHT);
            carried = carry;
        } else if (carried) {
            for (const group of selected.clips) group.mask = undefined;
            stopAnimation(carried);
            setAnimationWeight(carried, 0);
            carried = null;
        }
        evaluateHandAnimation(visual, 0);
    };
    const select = id => {
        const option = options.find(item => item.id === id);
        if (!option) throw new Error(`Unavailable inspection animation: ${id}`);
        halt(); selected = option; time = 0; carried = null;
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
