/** One motion contract for ordinary Ashen play and its compiled startup assets.
 * Keep native Lite groups/masks/additive layers; compacting never resamples curves.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/07-animation.md
 */
import {resolvePlayableBody} from './playable-body.js';

const source = resolvePlayableBody('?character=human-source');
export const ASHEN_MELEE_CLIP = 'PyreBurst_Upper';
export const ASHEN_PLAYABLE_MOTION = Object.freeze({
    directionalSpeed: 3.5,
    // Left-foot low-contact phases measured by audit-gaits.mjs on the fitted GLB.
    gaitContacts: Object.freeze({Walk_Loop: .233333, Sprint_Loop: .175,
        Jog_Bwd_Loop: .333333, Jog_Left_Loop: .208333, Jog_Right_Loop: .983333}),
    landing: Object.freeze({duration: .42, standingWeight: .4, movingWeight: .23}),
    castMotion: Object.freeze({lowerClip: 'FireBlast_Lower', releaseTime: .55,
        followThrough: .85, fadeOut: 0, hand: 'mainHand'}),
    castMotions: Object.freeze({
        lava: Object.freeze({upperClip: 'LavaBall_Upper', lowerClip: 'LavaBall_Lower',
            releaseTime: 1.5, followThrough: .8, fadeOut: 0, hand: 'mainHand'}),
        pulse: Object.freeze({upperClip: 'PyreBurst_Upper', lowerClip: 'PyreBurst_Lower',
            releaseTime: 1.1, followThrough: .8, fadeOut: 0, holdWeapon: true, hand: 'mainHand'}),
    }),
    clips: Object.freeze({...source.clips, cast: 'FireBlast_Upper', walkBack: 'Jog_Bwd_Loop',
        strafeL: 'Jog_Left_Loop', strafeR: 'Jog_Right_Loop', turnL: 'Turn90_L',
        turnR: 'Turn90_R', hit: 'Hit_Chest'}),
});

export const ASHEN_PLAYABLE_CLIP_NAMES = Object.freeze([...new Set([
    ...Object.values(ASHEN_PLAYABLE_MOTION.clips),
    ASHEN_MELEE_CLIP,
    ASHEN_PLAYABLE_MOTION.castMotion.lowerClip,
    ...Object.values(ASHEN_PLAYABLE_MOTION.castMotions).flatMap(p => [p.upperClip, p.lowerClip]),
])]);
