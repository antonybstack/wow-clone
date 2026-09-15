/**
 * Skinned Mixamo humanoid parented to the Havok capsule.
 * enableBoneControl() must run in main.js before this loadGltf.
 * Core playground #92Y727#463 beginAnimation → Lite playAnimation on groups.
 */
import {
    AnimationGroupMaskMode,
    addAnimationGroups,
    addToScene,
    createAnimationGroupMask,
    createAnimationManager,
    enableAnimationBlending,
    getBoneByName,
    getContainerMeshes,
    loadGltf,
    playAnimation,
    setAnimationAdditive,
    setAnimationWeight,
    setParent,
    stopAnimation,
    updateAnimationManager,
} from "@babylonjs/lite";

import { input } from "../input.js";

export const BODY_URL = "/characters/base.glb";

/** ThirdPersonTemplate character.ts animationBlendSpeed. */
const BLEND_SPEED = 4;
const WALK_RATIO = 1;
const BACK_RATIO = 0.85;
const RUN_RATIO = 1.4;
const JUMP_UP = 1.5;
const ONESHOT_SLACK = 0.03;

/** Legs stay on loco clips while Spell_Simple_* writes the upper body. */
const SPELL_LEG_BONES = [
    "mixamorig:Hips",
    "mixamorig:LeftUpLeg",
    "mixamorig:LeftLeg",
    "mixamorig:LeftFoot",
    "mixamorig:LeftToeBase",
    "mixamorig:RightUpLeg",
    "mixamorig:RightLeg",
    "mixamorig:RightFoot",
    "mixamorig:RightToeBase",
];

function meshList(scene) {
    return scene.meshes ?? [];
}

function hideCapsule(scene, player) {
    player.body.visible = false;
    for (const mesh of meshList(scene)) {
        if (mesh.name === "Player" || mesh.name === "PlayerHead") {
            mesh.visible = false;
        }
    }
}

function findGroup(groups, needles, exclude = []) {
    const want = needles.map((n) => n.toLowerCase());
    const skip = exclude.map((n) => n.toLowerCase());
    const named = (groups ?? []).filter((group) => {
        const name = (group.name || "").toLowerCase();
        return !skip.some((token) => name.includes(token));
    });
    for (const needle of want) {
        const exact = named.find((group) => (group.name || "").toLowerCase() === needle);
        if (exact) {
            return exact;
        }
    }
    for (const needle of want) {
        const part = named.find((group) => (group.name || "").toLowerCase().includes(needle));
        if (part) {
            return part;
        }
    }
    return null;
}

function findBone(skeleton, names) {
    if (!skeleton) {
        return undefined;
    }
    for (const name of names) {
        const bone = getBoneByName(skeleton, name);
        if (bone) {
            return bone;
        }
    }
    const lower = names.map((n) => n.toLowerCase());
    return skeleton.bones.find((bone) => {
        const name = (bone.name || "").toLowerCase();
        return lower.some((token) => name === token || name.endsWith(token) || name.includes(token));
    });
}

function moveTowards(current, target, maxDelta) {
    const delta = target - current;
    if (Math.abs(delta) <= maxDelta) {
        return target;
    }
    return current + Math.sign(delta) * maxDelta;
}

function clamp01(value) {
    return value < 0 ? 0 : value > 1 ? 1 : value;
}

function identityLocal(node) {
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

function oneshotDone(group) {
    if (!group) {
        return true;
    }
    if (!group.isPlaying) {
        return true;
    }
    const duration = group.duration || 0;
    if (duration <= 0) {
        return true;
    }
    return group.currentTime >= duration - ONESHOT_SLACK;
}

function halt(group) {
    if (!group) {
        return;
    }
    stopAnimation(group);
    setAnimationWeight(group, 0);
}

function playLoop(group, weight = 1) {
    if (!group) {
        return;
    }
    group.loopAnimation = true;
    setAnimationWeight(group, weight);
    if (!group.isPlaying) {
        playAnimation(group);
    }
}

function playOneshot(group) {
    if (!group) {
        return;
    }
    group.loopAnimation = false;
    group.speedRatio = 1;
    setAnimationWeight(group, 1);
    stopAnimation(group);
    playAnimation(group);
}

/**
 * @param {import("@babylonjs/lite").EngineContext} engine
 * @param {import("@babylonjs/lite").SceneContext} scene
 * @param {{ body: object, setOnPose?: Function, getMotion?: Function }} player
 * @param {number} capsuleHeight
 */
export async function attachBody(engine, scene, player, capsuleHeight) {
    const container = await loadGltf(engine, BODY_URL);
    addToScene(scene, container);

    const root = container.entities?.[0];
    if (!root) {
        throw new Error("base.glb has no root");
    }
    root.name = "BodyRoot";

    const skeleton = container.skeletons?.[0];
    const groups = container.animationGroups ?? [];
    const hips = findBone(skeleton, ["mixamorig:Hips", "Hips", "hips"]);
    const head = findBone(skeleton, ["mixamorig:Head", "Head", "head"]);
    const idle = findGroup(groups, ["Idle_Loop", "Idle", "idle"], ["talk", "torch", "pistol", "crouch"]);
    // Unarmed Idle_Loop parks the staff at the hip. Spell idle is the mage rest.
    const idleArmed = findGroup(groups, ["Spell_Simple_Idle_Loop", "spell_simple_idle"])
        || findGroup(groups, ["Sword_Idle"], ["attack"]);
    const walk = findGroup(groups, ["Walk_Loop", "Walking", "walk"], ["back", "formal", "crouch"]);
    const walkBack = findGroup(groups, ["WalkingBackwards", "walkback", "walk backwards"]);
    const strafeL = findGroup(groups, ["Strafe_Left", "strafeleft", "strafe_left", "StrafeLeft"]);
    const strafeR = findGroup(groups, ["Strafe_Right", "straferight", "strafe_right", "StrafeRight"]);
    const sprint = findGroup(groups, ["Sprint_Loop", "sprint"]);
    const samba = findGroup(groups, ["sambadancing", "samba"]);
    const jumpStart = findGroup(groups, ["Jump_Start", "jumpstart", "jump_start"]);
    const jumpLoop = findGroup(groups, ["Jump_Loop", "jumploop", "jump_loop"]);
    const jumpLand = findGroup(groups, ["Jump_Land", "jumpland", "jump_land"]);
    const spellShoot = findGroup(groups, ["Spell_Simple_Shoot", "spell_simple_shoot"]);
    const spellLoop = findGroup(groups, ["Spell_Simple_Idle_Loop", "spell_simple_idle"]);
    const spellEnter = findGroup(groups, ["Spell_Simple_Enter", "spell_simple_enter"]);
    const spellExit = findGroup(groups, ["Spell_Simple_Exit", "spell_simple_exit"]);

    hideCapsule(scene, player);
    for (const mesh of getContainerMeshes(container)) {
        mesh.receiveShadows = true;
    }

    setParent(root, player.body);
    root.position.x = 0;
    root.position.y = -(capsuleHeight * 0.5);
    root.position.z = 0;
    identityLocal(root);
    // Lite glTF root is created with scale.x = -1 (RH → LH). Keep it after reparent.
    if (root.scaling) {
        root.scaling.x = -1;
        root.scaling.y = 1;
        root.scaling.z = 1;
    }

    const manager = createAnimationManager({ engine });
    if (groups.length) {
        addAnimationGroups(manager, groups);
        enableAnimationBlending(manager);
    }
    for (const group of groups) {
        group.loopAnimation = true;
        group.speedRatio = 1;
        stopAnimation(group);
        setAnimationWeight(group, 0);
    }
    const rest = idleArmed || idle;
    if (rest) {
        rest.loopAnimation = true;
        setAnimationWeight(rest, 1);
        playAnimation(rest);
    }
    if (groups.length) {
        updateAnimationManager(manager, 0);
    }

    const locoClips = [idle, idleArmed, walk, walkBack, sprint, strafeL, strafeR].filter(Boolean);
    const jumpClips = [jumpStart, jumpLoop, jumpLand].filter(Boolean);
    const spellClips = [spellShoot, spellLoop, spellEnter, spellExit].filter(Boolean);
    const spellMask = createAnimationGroupMask(SPELL_LEG_BONES, AnimationGroupMaskMode.Exclude);
    // Spell_Simple_Idle_Loop is the standing rest (full body). Only shoot/enter/exit are additive overlays.
    const spellOverlay = spellClips.filter((group) => group !== idleArmed);
    for (const group of spellOverlay) {
        group.mask = spellMask;
        setAnimationAdditive(group);
    }

    console.log(
        "body bones",
        skeleton?.bones?.length ?? 0,
        "groups",
        groups.map((g) => g.name),
        "idle",
        idle?.name,
        "idleArmed",
        idleArmed?.name,
        "walk",
        walk?.name,
        "walkBack",
        walkBack?.name,
        "sprint",
        sprint?.name,
        "strafe",
        [strafeL?.name ?? null, strafeR?.name ?? null],
        "walkBack",
        walkBack?.name ?? null,
        "jump",
        [jumpStart?.name, jumpLoop?.name, jumpLand?.name],
        "spell",
        [spellShoot?.name, spellLoop?.name],
        "hips",
        hips?.name,
        "head",
        head?.name,
    );

    const haltList = (list) => {
        for (const group of list) {
            halt(group);
        }
    };

    const blendClip = (group, target, dt) => {
        if (!group) {
            return 0;
        }
        const next = clamp01(moveTowards(group.weight, target, BLEND_SPEED * dt));
        setAnimationWeight(group, next);
        group.loopAnimation = true;
        if (next > 0 && !group.isPlaying) {
            playAnimation(group);
        }
        if (next === 0 && (group.isPlaying || !group._stopped)) {
            stopAnimation(group);
        }
        return next;
    };

    const state = {
        phase: "loco",
        jump: "",
        castingShoot: false,
        channeling: false,
        locoName: rest?.name || idle?.name || "Idle_Loop",
        backing: false,
        strafing: false,
    };

    const beginJumpStart = () => {
        haltList(locoClips);
        haltList(spellClips);
        halt(jumpLoop);
        halt(jumpLand);
        state.castingShoot = false;
        state.channeling = false;
        if (jumpStart) {
            playOneshot(jumpStart);
            state.jump = "start";
        } else if (jumpLoop) {
            playLoop(jumpLoop);
            state.jump = "loop";
        } else {
            state.jump = "";
        }
        state.phase = "air";
    };

    const beginJumpLoop = () => {
        halt(jumpStart);
        halt(jumpLand);
        if (jumpLoop) {
            playLoop(jumpLoop);
            state.jump = "loop";
        }
        state.phase = "air";
    };

    const beginJumpLand = () => {
        halt(jumpStart);
        halt(jumpLoop);
        haltList(spellClips);
        state.castingShoot = false;
        state.channeling = false;
        if (jumpLand) {
            playOneshot(jumpLand);
            state.jump = "land";
            state.phase = "land";
            state.landAt = performance.now();
        } else {
            state.jump = "";
            state.phase = "loco";
        }
    };

    const beginShoot = () => {
        haltList(jumpClips);
        halt(spellLoop);
        halt(spellEnter);
        halt(spellExit);
        state.jump = "";
        state.channeling = false;
        state.phase = "loco";
        if (spellShoot) {
            playOneshot(spellShoot);
            state.castingShoot = true;
        } else if (spellEnter) {
            playOneshot(spellEnter);
            state.castingShoot = true;
        } else {
            state.castingShoot = false;
        }
    };

    const beginChannel = () => {
        haltList(jumpClips);
        halt(spellShoot);
        halt(spellEnter);
        halt(spellExit);
        state.jump = "";
        state.castingShoot = false;
        state.channeling = true;
        state.phase = "loco";
        if (spellLoop) {
            playLoop(spellLoop);
        }
    };

    const endChannel = () => {
        halt(spellLoop);
        state.channeling = false;
        if (spellExit) {
            playOneshot(spellExit);
        }
    };

    const updateLoco = (dt, motion) => {
        const forward = motion.forward ?? 0;
        const strafe = motion.strafe ?? 0;
        const wish = Math.abs(forward) > 0.01 || Math.abs(strafe) > 0.01;
        const walking = !!(motion.walk ?? input.walk);
        const backing = wish && forward < -0.01;
        const strafing = wish && Math.abs(strafe) > 0.01 && Math.abs(forward) <= 0.01;
        let target = idleArmed || idle;
        // No WalkingBackwards in base.glb — slowed Walk_Loop, never Sprint_Loop backward.
        if (backing && walkBack) {
            target = walkBack;
        } else if (backing && walk) {
            target = walk;
        } else if (strafing && strafe < 0 && strafeL) {
            target = strafeL;
        } else if (strafing && strafe > 0 && strafeR) {
            target = strafeR;
        } else if (strafing && walk) {
            // No Strafe_* clips — Walk_Loop, not a fake Sprint.
            target = walk;
        } else if (wish && walking && walk) {
            target = walk;
        } else if (wish && !walking && sprint && forward > 0.01) {
            target = sprint;
        } else if (wish && walk) {
            target = walk;
        } else if (!wish) {
            target = idleArmed || idle;
        }
        state.backing = backing;
        state.strafing = strafing;
        state.locoName = target?.name || idle?.name || "Idle_Loop";
        if (walk) {
            walk.speedRatio = backing ? BACK_RATIO : walking ? WALK_RATIO : RUN_RATIO;
        }
        if (walkBack) {
            walkBack.speedRatio = BACK_RATIO;
        }
        if (sprint) {
            sprint.speedRatio = 1;
        }
        const stance = [idle, idleArmed, walk, walkBack, sprint, strafeL, strafeR].filter(Boolean);
        for (const clip of stance) {
            blendClip(clip, clip === target ? 1 : 0, dt);
        }
        if (samba && samba.weight > 0) {
            blendClip(samba, 0, dt);
        }
    };

    const update = (dt) => {
        const h = dt > 0 ? dt : 1 / 60;
        const motion = player.getMotion?.() ?? {
            speed: 0,
            forward: input.forward,
            strafe: input.strafe,
            grounded: player.getGrounded?.() ?? true,
            vy: 0,
            walk: input.walk,
        };
        const grounded = motion.grounded ?? true;
        const vy = motion.vy ?? 0;

        if (input.castInstant) {
            input.castInstant = false;
            if (grounded && state.phase !== "air" && (spellShoot || spellEnter)) {
                beginShoot();
            }
        }

        if (!grounded) {
            if (state.phase !== "air") {
                if (vy > JUMP_UP) {
                    beginJumpStart();
                } else {
                    haltList(locoClips);
                    haltList(spellClips);
                    state.castingShoot = false;
                    state.channeling = false;
                    beginJumpLoop();
                }
            } else if (state.jump === "start" && (oneshotDone(jumpStart) || vy < 0.25)) {
                beginJumpLoop();
            }
        } else if (state.phase === "air") {
            beginJumpLand();
        } else if (state.phase === "land") {
            const moving = (motion.speed ?? 0) > 0.55;
            const tooLong = performance.now() - (state.landAt || 0) > 450;
            if (!jumpLand || oneshotDone(jumpLand) || moving || tooLong) {
                halt(jumpLand);
                haltList(jumpClips);
                state.jump = "";
                state.phase = "loco";
            }
        }

        if (state.phase === "loco") {
            haltList(jumpClips);
            updateLoco(h, motion);
            const hold = !!(input.castHold || input.spellHeld2);
            if (state.castingShoot) {
                const shot = spellShoot?.isPlaying ? spellShoot : spellEnter;
                if (!shot || oneshotDone(shot)) {
                    halt(spellShoot);
                    halt(spellEnter);
                    state.castingShoot = false;
                }
            } else if (hold && spellLoop) {
                if (!state.channeling) {
                    beginChannel();
                }
            } else if (state.channeling) {
                endChannel();
            } else if (spellExit && spellExit.isPlaying && !oneshotDone(spellExit)) {
                // Exit plays additively over loco; do not freeze the legs.
            } else if (spellExit && (spellExit.isPlaying || spellExit.weight > 0)) {
                halt(spellExit);
            }
        }

        if (groups.length) {
            updateAnimationManager(manager, h * 1000);
        }
    };

    return {
        root,
        container,
        skeleton,
        animationGroups: groups,
        idle,
        idleArmed,
        walk,
        walkBack,
        strafeL,
        strafeR,
        sprint,
        samba,
        jumpStart,
        jumpLoop,
        jumpLand,
        spellShoot,
        spellLoop,
        hips,
        head,
        manager,
        update,
        getState: () => ({
            phase: state.phase,
            jump: state.jump,
            castingShoot: state.castingShoot,
            channeling: state.channeling,
            locoName: state.locoName,
            backing: state.backing,
            strafing: state.strafing,
        }),
        getClipLabel: () => {
            if (state.phase === "air") {
                if (state.jump === "start") {
                    return jumpStart?.name || "Jump_Start";
                }
                return jumpLoop?.name || "Jump_Loop";
            }
            if (state.phase === "land") {
                return jumpLand?.name || "Jump_Land";
            }
            const extras = [];
            if (state.castingShoot) {
                extras.push((spellShoot?.isPlaying ? spellShoot : spellEnter)?.name || "Spell_Simple_Shoot");
            } else if (state.channeling) {
                extras.push(spellLoop?.name || "Spell_Simple_Idle_Loop");
            } else if (spellExit?.isPlaying) {
                extras.push(spellExit.name);
            }
            let name = state.locoName || idle?.name || "Idle_Loop";
            if (state.backing && !walkBack) {
                name += " (no WalkingBackwards)";
            } else if (state.strafing && !strafeL && !strafeR) {
                name += " (no Strafe clip)";
            }
            if (extras.length) {
                return `${name} + ${extras.join(" + ")}`;
            }
            return name;
        },
        gaps: {
            walkBack: !walkBack,
            strafe: !strafeL && !strafeR,
        },
        getPlaying: () =>
            groups
                .filter((group) => group.isPlaying && group.weight > 0.02)
                .map((group) => ({
                    name: group.name,
                    t: group.currentTime,
                    w: group.weight,
                    loop: group.loopAnimation,
                })),
        boneCount: skeleton?.bones?.length ?? 0,
        groupNames: groups.map((g) => g.name),
    };
}
