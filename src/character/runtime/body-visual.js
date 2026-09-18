/**
 * One skinned visual + clip table from an already-loaded container.
 * Does not own the locomotion state machine or a second animation loop.
 */
import {
    AnimationGroupMaskMode,
    addAnimationGroups,
    addToScene,
    clearAnimationManager,
    createAnimationGroupMask,
    createAnimationManager,
    enableAnimationBlending,
    getBoneByName,
    getContainerMeshes,
    pauseAnimation,
    playAnimation,
    removeFromScene,
    setAnimationAdditive,
    setAnimationWeight,
    setMeshVisible,
    setParent,
    stopAnimation,
    updateAnimationManager,
} from '@babylonjs/lite';

import {
    deriveLegBoneNames,
    resolvePlayableClips,
    usesAdditiveCast,
} from './playable-body.js';

const SPELL_LEG_BONES = [
    'mixamorig:Hips',
    'mixamorig:LeftUpLeg',
    'mixamorig:LeftLeg',
    'mixamorig:LeftFoot',
    'mixamorig:LeftToeBase',
    'mixamorig:RightUpLeg',
    'mixamorig:RightLeg',
    'mixamorig:RightFoot',
    'mixamorig:RightToeBase',
];

export function findGroup(groups, needles, exclude = []) {
    const want = needles.map((n) => n.toLowerCase());
    const skip = exclude.map((n) => n.toLowerCase());
    const named = (groups ?? []).filter((group) => {
        const name = (group.name || '').toLowerCase();
        return !skip.some((token) => name.includes(token));
    });
    for (const needle of want) {
        const exact = named.find((group) => (group.name || '').toLowerCase() === needle);
        if (exact) return exact;
    }
    for (const needle of want) {
        const part = named.find((group) => (group.name || '').toLowerCase().includes(needle));
        if (part) return part;
    }
    return null;
}

export function findBone(skeleton, names) {
    if (!skeleton) return undefined;
    for (const name of names) {
        const bone = getBoneByName(skeleton, name);
        if (bone) return bone;
    }
    const lower = names.map((n) => n.toLowerCase());
    return skeleton.bones.find((bone) => {
        const name = (bone.name || '').toLowerCase();
        return lower.some((token) => name === token || name.endsWith(token) || name.includes(token));
    });
}

export function identityLocal(node) {
    if (node.rotation) {
        node.rotation.x = 0;
        node.rotation.y = 0;
        node.rotation.z = 0;
    }
    const q = node.rotationQuaternion;
    if (q) {
        q.x = 0;
        q.y = 0;
        q.z = 0;
        q.w = 1;
    }
}

export function mountBodyRoot(root, player, capsuleHeight) {
    setParent(root, player.body);
    root.position.x = 0;
    root.position.y = -(capsuleHeight * 0.5);
    root.position.z = 0;
    identityLocal(root);
    if (root.scaling) {
        root.scaling.x = -1;
        root.scaling.y = 1;
        root.scaling.z = 1;
    }
}

export function resolveVisualClips(groups, definition) {
    const byName = (name) => (name && groups.find((group) => group.name === name)) || null;
    const exact = definition?.clipMode === 'exact'
        ? resolvePlayableClips(groups.map((group) => group.name), definition)
        : null;
    const idle = exact
        ? byName(exact.clips.idle)
        : findGroup(groups, ['Idle_Loop', 'Idle', 'idle'], ['talk', 'torch', 'pistol', 'crouch']);
    const idleArmed = exact
        ? null
        : findGroup(groups, ['Spell_Simple_Idle_Loop', 'spell_simple_idle'])
            || findGroup(groups, ['Sword_Idle'], ['attack']);
    const walk = exact
        ? byName(exact.clips.walk)
        : findGroup(groups, ['Walk_Loop', 'Walking', 'walk'], ['back', 'formal', 'crouch']);
    const walkBack = exact ? byName(exact.clips.walkBack) : findGroup(groups, ['WalkingBackwards', 'walkback', 'walk backwards']);
    const strafeL = exact ? byName(exact.clips.strafeL) : findGroup(groups, ['Strafe_Left', 'strafeleft', 'strafe_left', 'StrafeLeft']);
    const strafeR = exact ? byName(exact.clips.strafeR) : findGroup(groups, ['Strafe_Right', 'straferight', 'strafe_right', 'StrafeRight']);
    const turnL = exact ? byName(exact.clips.turnL) : null;
    const turnR = exact ? byName(exact.clips.turnR) : null;
    const sprint = exact
        ? byName(exact.clips.run)
        : findGroup(groups, ['Sprint_Loop', 'sprint']);
    const samba = exact ? null : findGroup(groups, ['sambadancing', 'samba']);
    const jumpStart = exact
        ? byName(exact.clips.jumpStart)
        : findGroup(groups, ['Jump_Start', 'jumpstart', 'jump_start']);
    const jumpLoop = exact
        ? byName(exact.clips.jumpLoop)
        : findGroup(groups, ['Jump_Loop', 'jumploop', 'jump_loop']);
    const jumpLand = exact
        ? byName(exact.clips.jumpLand)
        : findGroup(groups, ['Jump_Land', 'jumpland', 'jump_land']);
    const spellShoot = exact
        ? byName(exact.clips.cast)
        : findGroup(groups, ['Spell_Simple_Shoot', 'spell_simple_shoot']);
    const spellLoop = exact ? byName(exact.clips.spellLoop) : findGroup(groups, ['Spell_Simple_Idle_Loop', 'spell_simple_idle']);
    const spellEnter = exact ? byName(exact.clips.spellEnter) : findGroup(groups, ['Spell_Simple_Enter', 'spell_simple_enter']);
    const spellExit = exact ? byName(exact.clips.spellExit) : findGroup(groups, ['Spell_Simple_Exit', 'spell_simple_exit']);
    const twoHand = exact ? byName(exact.clips.twoHand) : findGroup(groups, ['Pistol_Idle_Loop', 'Pistol_Aim_Neutral', 'rifle_idle']);
    return {
        idle, idleArmed, walk, walkBack, strafeL, strafeR, turnL, turnR, sprint, samba,
        jumpStart, jumpLoop, jumpLand, spellShoot, spellLoop, spellEnter, spellExit, twoHand,
    };
}

export function applyVisualMasks(visual, definition) {
    const additiveCast = usesAdditiveCast(definition);
    const boneNames = (visual.skeleton?.bones ?? []).map((bone) => bone.name).filter(Boolean);
    const legNames = deriveLegBoneNames(boneNames, definition);
    const spellMask = createAnimationGroupMask(
        additiveCast ? SPELL_LEG_BONES : legNames,
        AnimationGroupMaskMode.Exclude,
    );
    const locoMask = additiveCast
        ? null
        : createAnimationGroupMask(legNames, AnimationGroupMaskMode.Include);
    visual.additiveCast = additiveCast;
    visual.spellMask = spellMask;
    visual.locoMask = locoMask;
    visual.legNames = legNames;
    if (visual.twoHand) visual.twoHand.loopAnimation = true;
    // The authored Fire Blast adaptation starts in Idle, so Lite can subtract
    // that pose and smoothly layer independent upper/lower contributions.
    if (definition?.castMotion) {
        visual.castMotions = {};
        for (const [key, profile] of Object.entries(definition.castMotions ?? {})) {
            const upper = visual.groups.find(g => g.name === profile.upperClip);
            const lower = visual.groups.find(g => g.name === profile.lowerClip);
            if (!upper || !lower) throw new Error('Missing cast-motion profile ' + key);
            visual.castMotions[key] = { upper, lower, profile };
            for (const clip of [upper, lower]) {
                setAnimationAdditive(clip, { referenceTime: 0 });
                if (!visual.spellClips.includes(clip)) visual.spellClips.push(clip);
            }
        }
        visual.castLower = visual.groups.find(g => g.name === definition.castMotion.lowerClip);
        if (!visual.castLower || !visual.spellShoot) throw new Error('Missing cast-motion layers');
        for (const clip of [visual.spellShoot, visual.castLower]) {
            setAnimationAdditive(clip, { referenceTime: 0 });
            if (!visual.spellClips.includes(clip)) visual.spellClips.push(clip);
        }
    }

    if (additiveCast) {
        const spellOverlay = visual.spellClips.filter((group) => group !== visual.idleArmed);
        for (const group of spellOverlay) {
            group.mask = spellMask;
            setAnimationAdditive(group);
        }
    } else {
        for (const clip of visual.spellClips) clip.mask = spellMask;
    }
}

/** Authored (nonadditive) cast keeps legs on loco; additive Mixamo overlays do not mask loco clips. */
export function locoOverlayFromSnapshot(visual, machine) {
    return !visual?.additiveCast && !!((machine?.castingShoot && !visual?.definition?.castMotion) || machine?.channelPhase);
}

export function applyLocoOverlay(visual, on) {
    if (!visual?.locoMask) return;
    for (const clip of visual.locoClips ?? []) {
        clip.mask = on ? visual.locoMask : undefined;
    }
}

export function restoreLocoOverlayMasks(visual, machine) {
    applyLocoOverlay(visual, locoOverlayFromSnapshot(visual, machine));
}

export function snapshotMachineState(state) {
    return {
        phase: state.phase,
        jump: state.jump,
        castingShoot: state.castingShoot,
        channeling: state.channeling,
        channelPhase: state.channelPhase,
        channelBlocked: state.channelBlocked,
        locoName: state.locoName,
        backing: state.backing,
        strafing: state.strafing,
        landAt: state.landAt,
    };
}

export function restoreMachineState(state, snapshot) {
    if (!snapshot) return;
    state.phase = snapshot.phase;
    state.jump = snapshot.jump;
    state.castingShoot = snapshot.castingShoot;
    state.channeling = snapshot.channeling;
    state.channelPhase = snapshot.channelPhase || '';
    state.channelBlocked = !!snapshot.channelBlocked;
    state.locoName = snapshot.locoName;
    state.backing = snapshot.backing;
    state.strafing = snapshot.strafing;
    state.landAt = snapshot.landAt;
}

export function snapshotClips(groups) {
    return (groups ?? []).map((group) => ({
        name: group.name,
        currentTime: group.currentTime,
        weight: group.weight,
        speedRatio: group.speedRatio,
        loopAnimation: group.loopAnimation,
        isPlaying: group.isPlaying,
    }));
}

/**
 * playAnimation does not reset time; stopAnimation does. Restore time first,
 * then play or pause. Never stopAnimation when keeping a nonzero time.
 */
export function restoreClips(groups, clipSnapshots) {
    const byName = new Map((groups ?? []).map((group) => [group.name, group]));
    for (const snap of clipSnapshots ?? []) {
        const group = byName.get(snap.name);
        if (!group) continue;
        group.loopAnimation = snap.loopAnimation;
        group.speedRatio = snap.speedRatio;
        setAnimationWeight(group, snap.weight);
        group.currentTime = snap.currentTime;
        if (snap.isPlaying) playAnimation(group);
        else pauseAnimation(group);
    }
}

export function snapshotVisualAnimation(visual, state) {
    return {
        machine: snapshotMachineState(state),
        clips: snapshotClips(visual?.groups),
    };
}

export function restoreVisualAnimation(visual, snapshot, state) {
    restoreMachineState(state, snapshot?.machine);
    restoreClips(visual?.groups, snapshot?.clips);
    applyVisualMasks(visual, visual.definition);
    restoreLocoOverlayMasks(visual, snapshot?.machine);
    if (visual.manager && visual.groups?.length) {
        updateAnimationManager(visual.manager, 0);
    }
}

export function setVisualVisible(visual, visible) {
    if (!visual?.root) return;
    setMeshVisible(visual.root, visible);
}

export function retireVisual(scene, visual) {
    if (!visual || visual.retired) return;
    visual.retired = true;
    for (const group of visual.groups ?? []) {
        stopAnimation(group);
        setAnimationWeight(group, 0);
    }
    if (visual.manager) {
        clearAnimationManager(visual.manager);
    }
    if (visual.container && scene) {
        removeFromScene(scene, visual.container);
    }
    visual.inScene = false;
}

function haltAll(groups) {
    for (const group of groups ?? []) {
        stopAnimation(group);
        setAnimationWeight(group, 0);
    }
}

/**
 * @param {{
 *   engine: object,
 *   scene: object,
 *   player: { body: object },
 *   capsuleHeight: number,
 *   definition: object,
 *   container: object,
 *   mode?: 'boot'|'stage',
 *   loadout?: object,
 *   manifest?: object,
 * }} opts
 */
export function assembleBodyVisual(opts) {
    const {
        engine, scene, player, capsuleHeight, definition, container,
        mode = 'boot', loadout = null, manifest = null,
    } = opts;
    const root = container.entities?.[0];
    if (!root) {
        throw new Error('body visual has no root');
    }
    root.name = mode === 'stage' ? 'BodyRootStaged' : 'BodyRoot';

    const skeleton = container.skeletons?.[0];
    const groups = container.animationGroups ?? [];
    const clips = resolveVisualClips(groups, definition);
    const hips = findBone(skeleton, ['mixamorig:Hips', 'Hips', 'hips']);
    const head = findBone(skeleton, ['mixamorig:Head', 'Head', 'head']);
    const meshes = getContainerMeshes(container);
    for (const mesh of meshes) {
        mesh.receiveShadows = true;
    }

    if (mode === 'stage') {
        setVisualVisible({ root }, false);
    }

    addToScene(scene, container);
    mountBodyRoot(root, player, capsuleHeight);

    const manager = createAnimationManager({ engine });
    if (groups.length) {
        addAnimationGroups(manager, groups);
        enableAnimationBlending(manager);
    }

    haltAll(groups);
    for (const group of groups) {
        group.loopAnimation = true;
        group.speedRatio = 1;
    }

    const rest = clips.idleArmed || clips.idle;
    if (mode === 'boot' && rest) {
        rest.loopAnimation = true;
        setAnimationWeight(rest, 1);
        playAnimation(rest);
    }

    const visual = {
        definition,
        container,
        root,
        skeleton,
        groups,
        meshes,
        manager,
        hips,
        head,
        loadout,
        manifest,
        inScene: true,
        retired: false,
        ...clips,
        locoClips: [clips.idle, clips.idleArmed, clips.walk, clips.walkBack, clips.sprint, clips.strafeL, clips.strafeR, clips.turnL, clips.turnR, clips.twoHand].filter(Boolean),
        jumpClips: [clips.jumpStart, clips.jumpLoop, clips.jumpLand].filter(Boolean),
        spellClips: [clips.spellShoot, clips.spellLoop, clips.spellEnter, clips.spellExit].filter(Boolean),
    };
    applyVisualMasks(visual, definition);
    if (groups.length) {
        updateAnimationManager(manager, 0);
    }
    return visual;
}
