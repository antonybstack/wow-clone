/**
 * Skinned Mixamo humanoid parented to the Havok capsule.
 * enableBoneControl() must run in main.js before this loadGltf.
 * Core playground #92Y727#463 beginAnimation → Lite playAnimation on groups.
 */
import {
    getContainerMeshes,
    loadGltf,
    onSceneDispose,
    playAnimation,
    setAnimationWeight,
    stopAnimation,
    updateAnimationManager,
} from "@babylonjs/lite";

import { input } from "../input.js";
import {
    isAuthoredPlayable,
    resolvePlayableBody,
} from "./runtime/playable-body.js";
import {
    applyLocoOverlay,
    assembleBodyVisual,
    restoreVisualAnimation,
    retireVisual,
    setVisualVisible,
    snapshotVisualAnimation,
} from "./runtime/body-visual.js";
import { parseFitManifest } from "./runtime/garment-catalog.js";
import { createLoadoutClient } from "./runtime/loadout-client.js";
import {
    EMPTY_SKINNED_LOADOUT,
    LOADOUT_CODES,
    LOADOUT_STATUS,
    STARTER_SKINNED_LOADOUT,
    MAGE_SKINNED_LOADOUT,
    cloneLoadout,
    createLoadoutController,
    decorateOutfitManifest,
    loadoutError,
} from "./runtime/loadout-controller.js";
import { SLOT_BONES, resolveBone } from "./sockets.js";
import { shouldAnimateAirborne } from "./runtime/airborne.js";
import { applyArmedMage, armedMageGrip, armedMagePlayback } from "./runtime/armed-mage.js";
import { fileSha256 } from "./runtime/fit-contract.js";
import { advanceGaitPhase, gaitTime, landingWeight } from "./runtime/gait-phase.js";

import { createInspectionPreview } from './runtime/inspection-preview.js';

export const BODY_URL = "/characters/base.glb";
export const FIT_MANIFEST_URL = "/characters/garments/starter-fits.v1.json";

/** ThirdPersonTemplate character.ts animationBlendSpeed. */
const BLEND_SPEED = 4;
const WALK_RATIO = 1;
const BACK_RATIO = 0.85;
const RUN_RATIO = 1.4;
const JUMP_UP = 1.5;
const ONESHOT_SLACK = 0.03;
// Lite 1.28's mixer only selects weighted evaluation when a live clip has a
// non-unit JS weight. Two weight=1 masked clips otherwise reset each other's
// excluded bones to bind pose. A JS weight just below 1 selects the mixer while
// rounding to exactly 1 in its Float32 accumulators. A genuine fractional
// weight is NOT safe: this version does not normalize translation/scale sums.
const MASKED_CAST_WEIGHT = 1 - Number.EPSILON;

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

async function fetchBuffer(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`fetch ${url} failed ${response.status}`);
    }
    return response.arrayBuffer();
}

function assertRequiredHand(skeleton) {
    const bone = resolveBone(skeleton, SLOT_BONES.mainHand);
    if (!bone) {
        throw loadoutError(LOADOUT_CODES.MISSING_HAND, "MISSING_HAND: required mainHand bone missing");
    }
    return bone;
}

/**
 * @param {import("@babylonjs/lite").EngineContext} engine
 * @param {import("@babylonjs/lite").SceneContext} scene
 * @param {{ body: object, setOnPose?: Function, getMotion?: Function }} player
 * @param {number} capsuleHeight
 * @param {object} [definition]
 */
export async function attachBody(engine, scene, player, capsuleHeight, definition) {
    const def = definition || resolvePlayableBody();
    const assetURL = def?.assetURL || BODY_URL;
    const authored = isAuthoredPlayable(def);

    let loadoutClient = null;
    let armedPose = null;
    let armedGrip = null;
    const loadVisual = buffer => loadGltf(engine, armedPose ? applyArmedMage(buffer, armedPose) : buffer);
    let visual = null;
    let socketHost = null;
    let commitHook = null;
    let disposed = false;
    let inspection = null;
    const commitWaiters = [];

    const initialLoadout = authored
        ? cloneLoadout(def.outfit === 'mage' ? MAGE_SKINNED_LOADOUT : def.outfit === 'starter' ? STARTER_SKINNED_LOADOUT : EMPTY_SKINNED_LOADOUT)
        : null;

    let container = null;
    let bootManifest = null;
    try {
        if (authored) {
            const source = await fetchBuffer(assetURL);
            if (def.id === 'human-v1' && def.outfit === 'mage' && new URLSearchParams(globalThis.location?.search).get('armed') !== '0') {
                const response = await fetch('/characters/animations/human-mage-armed-v1.json');
                if (!response.ok) throw new Error('Unable to load Human armed poses');
                armedPose = await response.json();
                if (`sha256:${armedPose.sourceSha256}` !== await fileSha256(source)) throw new Error('Human armed pose source mismatch');
                armedGrip = armedMageGrip(armedPose, def.grip.rightHand.translation);
            }
            const catalog = parseFitManifest(await (await fetch(FIT_MANIFEST_URL)).json());
            loadoutClient = createLoadoutClient({
                canonicalBuffer: source,
                manifest: catalog,
                profileId: def.id,
            });
            const composed = await loadoutClient.compose(initialLoadout);
            bootManifest = decorateOutfitManifest(composed.manifest, initialLoadout);
            container = await loadVisual(composed.buffer);
        } else {
            container = await loadGltf(engine, assetURL);
        }

        hideCapsule(scene, player);
        visual = assembleBodyVisual({
            engine,
            scene,
            player,
            capsuleHeight,
            definition: def,
            container,
            mode: "boot",
            loadout: initialLoadout,
            manifest: bootManifest,
        });
    } catch (error) {
        try {
            if (visual) {
                retireVisual(scene, visual);
            } else if (container) {
                retireVisual(scene, {
                    container,
                    groups: container.animationGroups ?? [],
                    manager: container.manager,
                });
            }
        } catch {
            /* keep the original boot error */
        }
        try {
            loadoutClient?.dispose();
        } catch {
            /* keep the original boot error */
        }
        loadoutClient = null;
        visual = null;
        throw error;
    }

    const rest = visual.idleArmed || visual.idle;
    let previousFacing = player.getFacing?.() ?? 0;
    let turnRate = 0;
    let gaitPhase = 0;
    let gaitFrequency = 0;
    let landingElapsed = 0;
    let landingPeak = 0;
    let castElapsed = 0;
    let castLegWeight = 1;
    let castLegSuppressed = false;
    let activeCastShot = null, activeCastLower = null, activeCastProfile = def.castMotion;
    let castCancelTime = null;
    const state = {
        phase: "loco",
        jump: "",
        castingShoot: false,
        channeling: false,
        channelPhase: "",
        channelBlocked: false,
        locoName: rest?.name || visual.idle?.name || "Idle_Loop",
        backing: false,
        strafing: false,
    };

    const haltList = (list) => {
        for (const group of list) {
            halt(group);
        }
    };

    const setLocoOverlay = (on) => {
        applyLocoOverlay(visual, on);
    };

    let poseTransition = null;
    const finishPoseTransition = () => {
        if (!poseTransition) return;
        for (const { clip } of poseTransition.clips) {
            if (clip === poseTransition.target) setAnimationWeight(clip, 1);
            else halt(clip);
        }
        poseTransition = null;
    };
    const beginPoseTransition = (target, loop) => {
        if (!target) return;
        // Retain outgoing clips at their current times during the crossfade.
        // Stopping them first creates a one-frame bind-pose/limb snap.
        const clips = [...new Set([...visual.locoClips, ...visual.jumpClips])]
            .filter(clip => clip === target || (clip.isPlaying && clip.weight > 0))
            .map(clip => ({ clip, from: clip.isPlaying ? clip.weight : 0 }));
        const from = clips.find(entry => entry.clip === target)?.from || 0;
        if (loop) playLoop(target, from);
        else { playOneshot(target); setAnimationWeight(target, from); }
        poseTransition = { target, clips, elapsed: 0 };
    };
    const updatePoseTransition = (dt) => {
        if (!poseTransition) return;
        poseTransition.elapsed += dt;
        const t = Math.min(1, poseTransition.elapsed / 0.12);
        const eased = t * t * (3 - 2 * t);
        for (const { clip, from } of poseTransition.clips) {
            setAnimationWeight(clip, from + ((clip === poseTransition.target ? 1 : 0) - from) * eased);
        }
        if (t === 1) finishPoseTransition();
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

    const beginJumpStart = () => {
        const { jumpStart, jumpLoop, spellClips } = visual;
        setLocoOverlay(false);
        haltList(spellClips);
        state.castingShoot = false;
        state.channeling = false;
        state.channelPhase = "";
        if (jumpStart) {
            beginPoseTransition(jumpStart, false);
            state.jump = "start";
        } else if (jumpLoop) {
            beginPoseTransition(jumpLoop, true);
            state.jump = "loop";
        } else {
            state.jump = "";
        }
        state.phase = "air";
    };

    const beginJumpLoop = () => {
        const { jumpLoop } = visual;
        if (jumpLoop) {
            beginPoseTransition(jumpLoop, true);
            state.jump = "loop";
        }
        state.phase = "air";
    };

    const beginJumpLand = (motion) => {
        const { jumpLand, spellClips } = visual;
        setLocoOverlay(false);
        haltList(spellClips);
        state.castingShoot = false;
        state.channeling = false;
        state.channelPhase = "";
        if (def.landing && jumpLand) {
            // Retain travel and crossfade out of the air pose, then layer a
            // shallow authored impact over the moving or idle base pose.
            beginPoseTransition(updateLoco(0, motion), true);
            playOneshot(jumpLand);
            setAnimationWeight(jumpLand, 0);
            jumpLand.speedRatio = jumpLand.duration / def.landing.duration;
            landingElapsed = 0;
            landingPeak = (motion.speed ?? 0) > 0.55 ? def.landing.movingWeight : def.landing.standingWeight;
            state.jump = "land";
            state.phase = "land";
        } else if ((motion.speed ?? 0) > 0.55) {
            beginPoseTransition(updateLoco(0, motion), true);
            state.jump = "";
            state.phase = "loco";
        } else if (jumpLand) {
            beginPoseTransition(jumpLand, false);
            state.jump = "land";
            state.phase = "land";
            state.landAt = performance.now();
        } else {
            state.jump = "";
            state.phase = "loco";
        }
    };

    const beginShoot = () => {
        finishPoseTransition();
        const { jumpClips, spellLoop, spellEnter, spellExit, spellMask, additiveCast } = visual;
        const selected = visual.castMotions?.[input.castSpell];
        input.castSpell = null;
        const spellShoot = selected?.upper ?? visual.spellShoot;
        halt(activeCastShot);halt(activeCastLower);
        activeCastShot = spellShoot;
        activeCastLower = selected?.lower ?? visual.castLower;
        activeCastProfile = selected?.profile ?? def.castMotion;
        castCancelTime = null;
        haltList(jumpClips);
        halt(spellLoop);
        halt(spellEnter);
        halt(spellExit);
        state.jump = "";
        state.channeling = false;
        state.channelPhase = "";
        state.phase = "loco";
        if (spellShoot) {
            if (def.castMotion) {
                setLocoOverlay(false);
                spellShoot.mask = undefined;
                activeCastLower.mask = undefined;
                castElapsed = 0;
                // Combat aligns facing before this update. That one-frame turn
                // must not suppress the stationary stance for the entire cast.
                if (!input.turn) turnRate = 0;
                castLegSuppressed = (player.getMotion?.().speed ?? 0) > .5;
                castLegWeight = castLegSuppressed ? 0 : 1;
                playOneshot(activeCastLower);
            } else if (!additiveCast) {
                spellShoot.mask = spellMask;
                setLocoOverlay(true);
            }
            playOneshot(spellShoot);
            if (!additiveCast && !def.castMotion) setAnimationWeight(spellShoot, MASKED_CAST_WEIGHT);
            state.castingShoot = true;
        } else if (spellEnter) {
            playOneshot(spellEnter);
            state.castingShoot = true;
        } else {
            state.castingShoot = false;
        }
    };

    const playChannelClip = (clip, loop = false) => {
        if (!clip) return;
        setLocoOverlay(!visual.additiveCast);
        if (loop) playLoop(clip);
        else playOneshot(clip);
        if (!visual.additiveCast) setAnimationWeight(clip, MASKED_CAST_WEIGHT);
    };

    const beginChannel = () => {
        finishPoseTransition();
        const { jumpClips, spellShoot, spellEnter, spellExit, spellLoop } = visual;
        haltList(jumpClips);
        halt(spellShoot);
        halt(spellEnter);
        halt(spellExit);
        state.jump = "";
        state.castingShoot = false;
        state.channeling = true;
        state.phase = "loco";
        state.channelPhase = spellEnter ? "enter" : "loop";
        playChannelClip(spellEnter || spellLoop, !spellEnter);
    };

    const endChannel = () => {
        const { spellEnter, spellLoop, spellExit } = visual;
        halt(spellEnter);
        halt(spellLoop);
        state.channeling = false;
        state.channelPhase = spellExit ? "exit" : "";
        if (spellExit) {
            playChannelClip(spellExit);
        } else setLocoOverlay(false);
    };

    const updateLoco = (dt, motion) => {
        const { idle, idleArmed, walk, walkBack, strafeL, strafeR, turnL, turnR, sprint, samba } = visual;
        const forward = motion.forward ?? 0;
        const strafe = motion.strafe ?? 0;
        const wish = Math.abs(forward) > 0.01 || Math.abs(strafe) > 0.01;
        const walking = !!(motion.walk ?? input.walk);
        const backing = wish && forward < -0.01;
        const strafing = wish && Math.abs(strafe) > 0.01 && Math.abs(forward) <= 0.01;
        let target = idleArmed || idle;
        if (backing && walkBack) {
            target = walkBack;
        } else if (backing && walk) {
            target = walk;
        } else if (strafing && strafe < 0 && strafeL) {
            target = strafeL;
        } else if (strafing && strafe > 0 && strafeR) {
            target = strafeR;
        } else if (strafing && walk) {
            target = walk;
        } else if (wish && walking && walk) {
            target = walk;
        } else if (wish && !walking && sprint && forward > 0.01) {
            target = sprint;
        } else if (wish && walk) {
            target = walk;
        } else if (!wish) {
            target = idleArmed || idle;
            if (Math.abs(turnRate) > 0.15) target = (turnRate < 0 ? turnL : turnR) || target;
        }
        // On diagonals blend the authored forward/backward and lateral gaits.
        const lateral = strafe < 0 ? strafeL : strafeR;
        const diagonalWeight = wish && !strafing && lateral && Math.abs(strafe) > 0.01
            ? Math.abs(strafe) / (Math.abs(forward) + Math.abs(strafe)) : 0;
        state.backing = backing;
        state.strafing = strafing;
        state.locoName = target?.name || idle?.name || "Idle_Loop";
        if (walk) {
            walk.speedRatio = armedMagePlayback(armedPose, 'walk', motion.speed ?? 2.5) ?? (backing ? BACK_RATIO : walking ? WALK_RATIO : RUN_RATIO);
        }
        if (walkBack) {
            walkBack.speedRatio = def.directionalSpeed ? Math.max(0.25, (motion.speed ?? 3.5) / def.directionalSpeed) : BACK_RATIO;
        }
        if (def.directionalSpeed) for (const clip of [strafeL, strafeR]) {
            if (clip) clip.speedRatio = Math.max(0.25, (motion.speed ?? 3.5) / def.directionalSpeed);
        }
        for (const clip of [turnL, turnR]) {
            if (clip) clip.speedRatio = Math.max(0.25, Math.min(4, Math.abs(turnRate) * clip.duration / (Math.PI / 2)));
        }
        if (sprint) {
            sprint.speedRatio = armedMagePlayback(armedPose, 'run', motion.speed ?? 7) ?? 1;
        }
        const contacts = def.gaitContacts;
        if (contacts && wish && target?.duration > 0) {
            const primaryRate = target.speedRatio / target.duration;
            const secondaryRate = diagonalWeight ? lateral.speedRatio / lateral.duration : primaryRate;
            gaitFrequency = primaryRate * (1 - diagonalWeight) + secondaryRate * diagonalWeight;
        } else gaitFrequency = 0;
        if (poseTransition) return target;
        const stance = [...new Set([idle, idleArmed, walk, walkBack, sprint, strafeL, strafeR, turnL, turnR].filter(Boolean))];
        for (const clip of stance) {
            blendClip(clip, clip === target ? 1 - diagonalWeight : clip === lateral ? diagonalWeight : 0, dt);
        }
        // An interrupted run→idle→walk blend can otherwise sum below one.
        // Lite accumulates translation/scale without normalization, shrinking
        // every joint in the hierarchy when that happens.
        const total = stance.reduce((sum, clip) => sum + clip.weight, 0);
        if (total > 0 && Math.abs(total - 1) > 1e-10) {
            for (const clip of stance) setAnimationWeight(clip, clip.weight / total);
        }
        if (samba && samba.weight > 0) {
            blendClip(samba, 0, dt);
        }
        return target;
    };

    const flushCommitWaiters = () => {
        while (commitWaiters.length) {
            const job = commitWaiters.shift();
            try {
                job.resolve(job.fn());
            } catch (error) {
                job.reject(error);
            }
        }
    };

    const waitCommit = (fn) => new Promise((resolve, reject) => {
        commitWaiters.push({ fn, resolve, reject });
    });

    const update = (dt) => {
        if (disposed || !visual) {
            return;
        }
        flushCommitWaiters();
        if (disposed || !visual) {
            return;
        }
        if (inspection) { inspection.update(Math.max(0, dt)); return; }
        const h = dt > 0 ? dt : 1 / 60;
        const facing = player.getFacing?.() ?? previousFacing;
        turnRate = Math.atan2(Math.sin(facing - previousFacing), Math.cos(facing - previousFacing)) / h;
        previousFacing = facing;
        const {
            idle, walk, walkBack, strafeL, strafeR,
            jumpStart, jumpLoop, jumpLand,
            spellShoot, spellLoop, spellEnter, spellExit,
            jumpClips, groups, manager,
        } = visual;
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
        const hold = !!(input.castHold || input.spellHeld2);
        if (!hold) state.channelBlocked = false;

        if (input.castInstant) {
            input.castInstant = false;
            if (grounded && state.phase !== "air" && (spellShoot || spellEnter)) {
                beginShoot();
                state.channelBlocked = hold;
            }
        }

        if (shouldAnimateAirborne(motion)) {
            // A jump interrupts a held channel; require a fresh press after it.
            if (hold) state.channelBlocked = true;
            if (state.phase !== "air") {
                if (motion.jumpInFlight ?? (vy > JUMP_UP)) {
                    beginJumpStart();
                } else {
                    setLocoOverlay(false);
                    haltList(visual.spellClips);
                    state.castingShoot = false;
                    state.channeling = false;
                    state.channelPhase = "";
                    beginJumpLoop();
                }
            } else if (state.jump === "start" && (oneshotDone(jumpStart) || vy < 0.25)) {
                beginJumpLoop();
            }
        } else if (grounded && state.phase === "air") {
            beginJumpLand(motion);
        } else if (grounded && state.phase === "land") {
            if (def.landing) {
                landingElapsed += h;
                if (landingElapsed >= def.landing.duration) {
                    halt(jumpLand);
                    state.jump = "";
                    state.phase = "loco";
                }
            } else {
             const moving = (motion.speed ?? 0) > 0.55;
             const tooLong = performance.now() - (state.landAt || 0) > 450;
             if (!jumpLand || oneshotDone(jumpLand) || moving || tooLong) {
                beginPoseTransition(updateLoco(0, motion), true);
                state.jump = "";
                state.phase = "loco";
             }
            }
        }

        if (state.phase === "land" && def.landing) updateLoco(h, motion);
        if (state.phase === "loco") {
            if (!poseTransition) haltList(jumpClips);
            updateLoco(h, motion);
            if (state.castingShoot) {
                const shot = def.castMotion ? activeCastShot : (spellShoot?.isPlaying ? spellShoot : spellEnter);
                if (def.castMotion && shot) {
                    castElapsed += h;
                    const ease = x => { x = Math.max(0, Math.min(1, x)); return x*x*(3-2*x); };
                    if (castCancelTime !== null) castCancelTime = Math.max(0,castCancelTime-h);
                    const weight = ease(castElapsed/.09) * ease((shot.duration-castElapsed)/.18) * (castCancelTime===null?1:ease(castCancelTime/.16));
                    const travelling = (motion.speed ?? 0) > .5 || Math.abs(motion.forward ?? 0) > .01 || Math.abs(motion.strafe ?? 0) > .01 || Math.abs(turnRate) > .15;
                    // Once travel takes over, keep the feet on locomotion through recovery.
                    castLegSuppressed ||= travelling;
                    castLegWeight += ((castLegSuppressed ? 0 : 1)-castLegWeight)*(1-Math.exp(-18*h));
                    setAnimationWeight(shot, weight);
                    setAnimationWeight(activeCastLower, weight*castLegWeight);
                }
                if (!shot || oneshotDone(shot) || castCancelTime === 0) {
                    halt(shot);
                    halt(activeCastLower);
                    halt(spellEnter);
                    state.castingShoot = false;
                    setLocoOverlay(false);
                }
            } else if (hold && !state.channelBlocked && spellLoop) {
                if (!state.channeling) {
                    beginChannel();
                } else if (state.channelPhase === "enter" && oneshotDone(spellEnter)) {
                    halt(spellEnter);
                    state.channelPhase = "loop";
                    playChannelClip(spellLoop, true);
                }
            } else if (state.channeling) {
                endChannel();
            } else if (spellExit && spellExit.isPlaying && !oneshotDone(spellExit)) {
                // The exit keeps the same upper/lower-body split as the hold.
            } else if (state.channelPhase === "exit") {
                halt(spellExit);
                state.channelPhase = "";
                setLocoOverlay(false);
            }
        }

        updatePoseTransition(h);
        if (state.phase === "land" && def.landing) {
            const weight = landingWeight(landingElapsed, def.landing.duration, landingPeak);
            for (const clip of [...visual.locoClips, jumpStart, jumpLoop]) {
                if (clip?.isPlaying) setAnimationWeight(clip, clip.weight * (1 - weight));
            }
            setAnimationWeight(jumpLand, weight);
        }
        if (def.gaitContacts && state.phase !== "air") {
            gaitPhase = advanceGaitPhase(gaitPhase, h, gaitFrequency);
            for (const clip of visual.locoClips) {
                const contact = def.gaitContacts[clip.name];
                if (contact === undefined || !clip.isPlaying) continue;
                // Preposition before Lite advances each clip so all evaluated
                // poses share one contact phase despite different durations.
                clip.currentTime = gaitTime(gaitPhase, clip.duration, contact) - h * clip.speedRatio;
                if (clip.currentTime < 0) clip.currentTime += clip.duration;
            }
        }
        if (groups.length) {
            updateAnimationManager(manager, h * 1000);
        }
    };

    const disposeCandidate = (candidate) => {
        if (!candidate || candidate === visual) {
            return;
        }
        if (candidate.container) {
            retireVisual(scene, candidate);
            return;
        }
        retireVisual(scene, {
            container: candidate,
            groups: candidate.animationGroups ?? [],
            manager: candidate.manager,
        });
    };

    const commitVisual = (candidate, meta) => {
        finishPoseTransition();
        const snapshot = snapshotVisualAnimation(visual, state);
        assertRequiredHand(candidate.skeleton);
        const previous = visual;
        const previousMeshes = previous.meshes ?? getContainerMeshes(previous.container);
        const nextMeshes = candidate.meshes ?? getContainerMeshes(candidate.container);
        restoreVisualAnimation(candidate, snapshot, state);
        candidate.root.name = "BodyRoot";
        let rebound = false;
        let revertHook = null;
        let switchedVisibility = false;
        visual = candidate;
        try {
            if (socketHost?.rebind) {
                socketHost.rebind(facade);
                rebound = true;
            }
            const hookResult = commitHook?.({
                oldContainer: previous.container,
                newContainer: candidate.container,
                oldMeshes: previousMeshes,
                newMeshes: nextMeshes,
            });
            revertHook = typeof hookResult === "function" ? hookResult : null;
            setVisualVisible(candidate, true);
            if (previous && previous !== candidate) {
                previous.root.name = "BodyRootRetired";
                setVisualVisible(previous, false);
            }
            switchedVisibility = true;
        } catch (error) {
            visual = previous;
            if (switchedVisibility) {
                setVisualVisible(previous, true);
                setVisualVisible(candidate, false);
                if (previous?.root) previous.root.name = "BodyRoot";
                if (candidate?.root) candidate.root.name = "BodyRootStaged";
            }
            if (typeof revertHook === "function") {
                try { revertHook(); } catch { /* keep commit error */ }
            }
            if (rebound && socketHost?.rebind) {
                socketHost.rebind(facade);
            }
            restoreVisualAnimation(previous, snapshot, state);
            throw error;
        }
        if (previous && previous !== candidate) {
            retireVisual(scene, previous);
        }
        visual.loadout = cloneLoadout(meta.loadout);
        visual.manifest = decorateOutfitManifest(meta.manifest, meta.loadout);
    };

    const controller = authored
        ? createLoadoutController({
            compose: (loadout) => loadoutClient.compose(loadout),
            loadContainer: loadVisual,
            prepareCandidate: async (loaded, composed, loadout) => assembleBodyVisual({
                engine,
                scene,
                player,
                capsuleHeight,
                definition: def,
                container: loaded,
                mode: "stage",
                loadout,
                manifest: decorateOutfitManifest(composed.manifest, loadout),
            }),
            disposeCandidate,
            waitCommit,
            commit: commitVisual,
            getCurrentLoadout: () => visual?.loadout ?? null,
        })
        : null;

    const setLoadout = async (selection) => {
        if (disposed) {
            return {
                status: LOADOUT_STATUS.failed,
                requestId: 0,
                loadout: cloneLoadout(visual?.loadout || EMPTY_SKINNED_LOADOUT),
                error: { code: LOADOUT_CODES.DISPOSED, message: "Body disposed" },
            };
        }
        if (!authored || !controller) {
            return {
                status: LOADOUT_STATUS.failed,
                requestId: 0,
                loadout: cloneLoadout(EMPTY_SKINNED_LOADOUT),
                error: {
                    code: LOADOUT_CODES.UNSUPPORTED_BODY,
                    message: "UNSUPPORTED_BODY: independent skinned loadouts are not supported on this body",
                },
            };
        }
        const started = performance.now();
        const result = await controller.setLoadout(selection);
        result.timings = {
            ...(result.timings || {}),
            totalMs: performance.now() - started,
        };
        return result;
    };

    const dispose = () => {
        if (disposed) {
            return;
        }
        inspection?.dispose(); inspection = null;
        disposed = true;
        for (const job of commitWaiters.splice(0)) {
            job.reject(loadoutError(LOADOUT_CODES.DISPOSED, "Body disposed"));
        }
        controller?.dispose();
        loadoutClient?.dispose();
        retireVisual(scene, visual);
        visual = null;
    };

    onSceneDispose(scene, () => {
        dispose();
    });

    const facade = {
        definition: def,
        sourceURL: assetURL,
        get outfitManifest() { return visual?.manifest ?? null; },
        get loadout() { return visual?.loadout ? cloneLoadout(visual.loadout) : null; },
        get root() { return visual?.root; },
        get container() { return visual?.container; },
        get skeleton() { return visual?.skeleton; },
        get armedGrip() { return armedGrip; },
        get animationGroups() { return visual?.groups; },
        get idle() { return visual?.idle; },
        get idleArmed() { return visual?.idleArmed; },
        get walk() { return visual?.walk; },
        get walkBack() { return visual?.walkBack; },
        get strafeL() { return visual?.strafeL; },
        get strafeR() { return visual?.strafeR; },
        get sprint() { return visual?.sprint; },
        get samba() { return visual?.samba; },
        get jumpStart() { return visual?.jumpStart; },
        get jumpLoop() { return visual?.jumpLoop; },
        get jumpLand() { return visual?.jumpLand; },
        get spellShoot() { return visual?.spellShoot; },
        get spellLoop() { return visual?.spellLoop; },
        get hips() { return visual?.hips; },
        get head() { return visual?.head; },
        get manager() { return visual?.manager; },
        get boneCount() { return visual?.skeleton?.bones?.length ?? 0; },
        get groupNames() { return (visual?.groups ?? []).map((g) => g.name); },
        get gaps() {
            return {
                walkBack: !visual?.walkBack,
                strafe: !visual?.strafeL && !visual?.strafeR,
            };
        },
        update,
        get inspection() { return inspection; },
        beginInspection() {
            if (inspection) return inspection;
            inspection = createInspectionPreview(visual);
            return inspection;
        },
        endInspection() {
            if (!inspection) return;
            inspection.dispose(); inspection = null;
            poseTransition = null; landingPeak = landingElapsed = 0;
            castElapsed = 0; castCancelTime = null; activeCastShot = activeCastLower = null;
            state.phase = "loco"; state.jump = ""; state.castingShoot = false;
            state.channeling = false; state.channelPhase = ""; state.channelBlocked = false;
            setLocoOverlay(false);
            playLoop(visual.idle);
            updateAnimationManager(visual.manager, 0);
        },
        cancelCast() { if (def.castMotion && state.castingShoot) castCancelTime = .16; },
        setLoadout,
        dispose,
        bindSocketHost(host) {
            socketHost = host;
        },
        setCommitHook(hook) {
            commitHook = hook;
        },
        getState: () => ({
            phase: state.phase,
            jump: state.jump,
            castingShoot: state.castingShoot,
            castElapsed,
            castReleaseTime: activeCastProfile?.releaseTime ?? 0,
            castLegWeight,
            channeling: state.channeling,
            channelPhase: state.channelPhase,
            channelBlocked: state.channelBlocked,
            gaitPhase,
            gaitFrequency,
            locoName: state.locoName,
            backing: state.backing,
            strafing: state.strafing,
        }),
        getClipLabel: () => {
            const { jumpStart, jumpLoop, jumpLand, spellShoot, spellEnter, spellLoop, spellExit, idle, walkBack, strafeL, strafeR } = visual || {};
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
                extras.push((activeCastShot?.isPlaying ? activeCastShot : spellShoot?.isPlaying ? spellShoot : spellEnter)?.name || "Spell_Simple_Shoot");
            } else if (state.channeling) {
                extras.push((state.channelPhase === "enter" ? spellEnter : spellLoop)?.name || "Spell_Simple_Idle_Loop");
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
        getPlaying: () =>
            (visual?.groups ?? [])
                .filter((group) => group.isPlaying && group.weight > 0.02)
                .map((group) => ({
                    name: group.name,
                    t: group.currentTime,
                    w: group.weight,
                    loop: group.loopAnimation,
                })),
    };

    console.log(
        "body",
        def?.id || "legacy",
        assetURL,
        "bones",
        visual.skeleton?.bones?.length ?? 0,
        "groups",
        visual.groups.map((g) => g.name),
        "idle",
        visual.idle?.name,
        "idleArmed",
        visual.idleArmed?.name,
        "walk",
        visual.walk?.name,
        "walkBack",
        visual.walkBack?.name,
        "sprint",
        visual.sprint?.name,
        "strafe",
        [visual.strafeL?.name ?? null, visual.strafeR?.name ?? null],
        "jump",
        [visual.jumpStart?.name, visual.jumpLoop?.name, visual.jumpLand?.name],
        "spell",
        [visual.spellShoot?.name, visual.spellLoop?.name],
        "hips",
        visual.hips?.name,
        "head",
        visual.head?.name,
        "castAdditive",
        visual.additiveCast,
        "legMask",
        visual.legNames?.length ?? 0,
        "loadout",
        visual.loadout,
    );

    return facade;
}
