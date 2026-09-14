/**
 * WoW-style clip director for the hooded mage.
 * Drives glTF animation groups from locomotion state. Does not move the capsule.
 */
import {
    AnimationGroupMaskMode,
    addAnimationGroups,
    createAnimationGroupMask,
    createAnimationManager,
    enableAnimationBlending,
    playAnimation,
    setAnimationAdditive,
    setAnimationWeight,
    stopAnimation,
    updateAnimationManager,
} from "@babylonjs/lite";

const CLIP_NAMES = [
    "idle",
    "walk",
    "walkBack",
    "run",
    "strafeLeft",
    "strafeRight",
    "jumpStart",
    "jumpAir",
    "jumpLand",
    "castInstant",
    "castChannel",
];

const LOCO = new Set(["idle", "walk", "walkBack", "run", "strafeLeft", "strafeRight"]);
const ONESHOT = new Set(["jumpStart", "jumpLand", "castInstant"]);
const ARM_BONES = [
    "Spine",
    "Chest",
    "Neck",
    "Head",
    "Shoulder.L",
    "UpperArm.L",
    "ForeArm.L",
    "Hand.L",
    "Shoulder.R",
    "UpperArm.R",
    "ForeArm.R",
    "Hand.R",
    "Staff",
];

const STILL = 0.45;
const STRAFE_DOM = 0.28;
const JUMP_UP = 2.2;
const FALL_VY = -2.6;
const AIR_FRAMES = 10;
/** 16 frames @ 24 fps = 1.5 Hz. 7 m/s wants ~2.05 Hz (parent run cadence). */
const RUN_CADENCE = 1.37;

function byName(groups) {
    const map = new Map();
    for (const group of groups ?? []) {
        if (group?.name) {
            map.set(group.name, group);
        }
    }
    return map;
}

function oneshotDone(group) {
    if (!group) {
        return true;
    }
    const duration = group.duration || 0;
    if (duration <= 0) {
        return true;
    }
    return group.currentTime >= duration - 0.03;
}

function pickLoco(motion) {
    const speed = motion.speed ?? 0;
    const forward = motion.forward ?? 0;
    const strafe = motion.strafe ?? 0;
    if (speed < STILL) {
        return "idle";
    }
    const af = Math.abs(forward);
    const as = Math.abs(strafe);
    if (as > STRAFE_DOM && as >= af) {
        return strafe < 0 ? "strafeLeft" : "strafeRight";
    }
    if (forward < -0.2) {
        return "walkBack";
    }
    if (motion.walk || speed < 3.6) {
        return "walk";
    }
    return "run";
}

function startClip(group, { loop, speed = 1, time = 0 } = {}) {
    if (!group) {
        return;
    }
    stopAnimation(group);
    group.currentTime = time;
    group.loopAnimation = loop;
    group.speedRatio = speed;
    if (group.weight < 0.001) {
        group.weight = 1;
    }
    playAnimation(group);
}

/**
 * @param {import("@babylonjs/lite").AssetContainer} asset
 * @param {import("@babylonjs/lite").EngineContext} engine
 */
export function createClipDirector(asset, engine) {
    const groups = asset?.animationGroups ?? [];
    const clips = byName(groups);
    const manager = createAnimationManager({ engine });
    if (groups.length) {
        addAnimationGroups(manager, groups);
        enableAnimationBlending(manager);
    }
    for (const name of CLIP_NAMES) {
        const group = clips.get(name);
        if (!group) {
            continue;
        }
        group.loopAnimation = !ONESHOT.has(name);
        group.speedRatio = 1;
        group.weight = 1;
        stopAnimation(group);
    }
    const instant = clips.get("castInstant");
    const channel = clips.get("castChannel");
    if (instant) {
        setAnimationAdditive(instant);
        instant.mask = createAnimationGroupMask(ARM_BONES, AnimationGroupMaskMode.Include);
        instant.weight = 0;
    }
    if (channel) {
        setAnimationAdditive(channel);
        channel.mask = createAnimationGroupMask(ARM_BONES, AnimationGroupMaskMode.Include);
        channel.weight = 0;
    }

    const state = {
        loco: "idle",
        jump: "",
        airborne: false,
        airFrames: 0,
        landUntil: 0,
        castingInstant: false,
        names: groups.map((g) => g.name),
    };

    const idle = clips.get("idle");
    if (idle) {
        startClip(idle, { loop: true });
        if (groups.length) {
            updateAnimationManager(manager, 0);
        }
    }

    const setLoco = (name, speed) => {
        if (!clips.get(name)) {
            name = clips.has("idle") ? "idle" : name;
        }
        if (state.loco !== name) {
            const prev = clips.get(state.loco);
            if (prev && LOCO.has(state.loco)) {
                stopAnimation(prev);
            }
            state.loco = name;
            const group = clips.get(name);
            if (group) {
                const loop = true;
                let ratio = 1;
                if (name === "walk" || name === "walkBack" || name === "strafeLeft" || name === "strafeRight") {
                    ratio = Math.min(1.45, Math.max(0.75, (speed || 2.5) / 2.5));
                } else if (name === "run") {
                    ratio = Math.min(1.5, Math.max(0.85, (speed || 7) / 7 * RUN_CADENCE));
                }
                startClip(group, { loop, speed: ratio });
            }
        } else {
            const group = clips.get(name);
            if (group) {
                if (name === "walk" || name === "walkBack" || name === "strafeLeft" || name === "strafeRight") {
                    group.speedRatio = Math.min(1.45, Math.max(0.75, (speed || 2.5) / 2.5));
                } else if (name === "run") {
                    group.speedRatio = Math.min(1.5, Math.max(0.85, (speed || 7) / 7 * RUN_CADENCE));
                }
            }
        }
    };

    const stopJump = () => {
        for (const name of ["jumpStart", "jumpAir", "jumpLand"]) {
            const group = clips.get(name);
            if (group) {
                stopAnimation(group);
            }
        }
        state.jump = "";
    };

    const stopLocoClips = () => {
        for (const name of LOCO) {
            const group = clips.get(name);
            if (group?.isPlaying) {
                stopAnimation(group);
            }
        }
        state.loco = "";
    };

    const playJump = (name, loop) => {
        stopLocoClips();
        for (const jumpName of ["jumpStart", "jumpAir", "jumpLand"]) {
            if (jumpName === name) {
                continue;
            }
            const group = clips.get(jumpName);
            if (group) {
                stopAnimation(group);
            }
        }
        state.jump = name;
        const group = clips.get(name);
        if (group && !group.isPlaying) {
            startClip(group, { loop });
        }
    };

    /**
     * @param {{ speed: number, forward: number, strafe: number, grounded: boolean, vy: number, walk: boolean, castBlend?: number }} motion
     * @param {{ castInstant?: boolean, castHold?: boolean, spellHeld2?: boolean }} [input]
     * @param {number} [deltaMs]
     */
    const update = (motion = {}, input = {}, deltaMs = 16.6) => {
        const grounded = !!motion.grounded;
        const vy = motion.vy ?? 0;
        const speed = motion.speed ?? 0;
        const now = performance.now();

        if (input.castInstant && instant) {
            state.castingInstant = true;
            instant.weight = 1;
            startClip(instant, { loop: false, speed: 1 });
            input.castInstant = false;
        }
        if (state.castingInstant && instant && oneshotDone(instant)) {
            state.castingInstant = false;
            stopAnimation(instant);
            instant.weight = 0;
        }
        const hold = !!(input.castHold || input.spellHeld2 || (motion.castBlend ?? 0) > 0.5);
        if (channel) {
            if (hold && !state.castingInstant) {
                if (!channel.isPlaying) {
                    channel.weight = 1;
                    startClip(channel, { loop: true, speed: 1 });
                }
                setAnimationWeight(channel, 1);
            } else if (channel.isPlaying && !hold) {
                stopAnimation(channel);
                channel.weight = 0;
            }
        }

        if (!grounded) {
            state.airFrames += 1;
        } else {
            state.airFrames = 0;
        }
        const reallyAir = !grounded && (
            vy > JUMP_UP
            || vy < FALL_VY
            || state.airFrames > AIR_FRAMES
            || (state.airborne && !grounded)
        );

        if (reallyAir) {
            state.landUntil = 0;
            if (!state.airborne && vy > JUMP_UP) {
                state.airborne = true;
                playJump("jumpStart", false);
            } else {
                state.airborne = true;
                const start = clips.get("jumpStart");
                if (state.jump === "jumpStart" && start && !oneshotDone(start)) {
                    // hold start until it finishes
                } else if (state.jump !== "jumpAir") {
                    playJump("jumpAir", true);
                }
            }
        } else if (state.airborne && grounded) {
            state.airborne = false;
            playJump("jumpLand", false);
            const land = clips.get("jumpLand");
            state.landUntil = now + (land?.duration || 0.4) * 1000;
        } else if (state.jump === "jumpLand") {
            const land = clips.get("jumpLand");
            if (!land || oneshotDone(land) || now >= state.landUntil || speed > 0.55) {
                stopJump();
                setLoco(pickLoco(motion), speed);
            }
        } else {
            if (state.jump) {
                stopJump();
            }
            setLoco(pickLoco(motion), speed);
        }

        if (groups.length) {
            updateAnimationManager(manager, deltaMs);
        }
    };

    return {
        clips,
        names: state.names,
        update,
        getState: () => ({
            loco: state.loco,
            jump: state.jump,
            airborne: state.airborne,
            castingInstant: state.castingInstant,
            playing: CLIP_NAMES.filter((name) => clips.get(name)?.isPlaying),
        }),
    };
}
