/**
 * Walkable character using Babylon Lite's Havok Physics V2 controller.
 * WoW locomotion: instant wish velocity, facing-relative WASD, Havok collide-and-slide.
 *
 *   createHavokWorld → static colliders → createPhysicsCharacterController
 *   onPhysicsAfterStep: checkSupport → setVelocity(wish) → integrate
 */
import HavokPhysics from "@babylonjs/havok";
import {
    CharacterSupportedState,
    PhysicsShapeType,
    addToScene,
    createBox,
    createCapsule,
    createHavokWorld,
    createPbrMaterial,
    createPhysicsAggregate,
    createPhysicsCharacterController,
    createPhysicsShape,
    createSphere,
    onPhysicsAfterStep,
    setParent,
} from "@babylonjs/lite";

import { input, pollInput, endFrame } from "./input.js";

const WALK_SPEED = 2.5;
const RUN_SPEED = 7.0;
const TURN_RATE = 2.55;
/**
 * 6.6 m/s against 20.8 m/s² is a 1.05 m apex (v²/2g, 0.63 s hang).
 * Havok can stay SUPPORTED for a frame after takeoff — gravity still owns Y
 * then, and jump is not re-applied until a real landing (`jumpLocked`).
 */
const JUMP_SPEED = 6.6;
const GRAVITY = { x: 0, y: -20.8, z: 0 };
const GRAVITY_Y = 20.8;
const DOWN = { x: 0, y: -1, z: 0 };
const CAPSULE = { height: 1.55, radius: 0.28 };
const FACE_DAMP = 9;
const KINEMATIC_GROUND_Y = 0.9;
const KINEMATIC_MAX_R = 10.4;

function angleDelta(a, b) {
    let d = b - a;
    while (d > Math.PI) {
        d -= Math.PI * 2;
    }
    while (d < -Math.PI) {
        d += Math.PI * 2;
    }
    return d;
}

function angleDamp(cur, target, rate, dt) {
    return cur + angleDelta(cur, target) * (1 - Math.exp(-rate * dt));
}

function localSize(mesh) {
    const a = mesh.boundMin;
    const b = mesh.boundMax;
    if (!a || !b) {
        return null;
    }
    const ax = a.x ?? a[0];
    const ay = a.y ?? a[1];
    const az = a.z ?? a[2];
    const bx = b.x ?? b[0];
    const by = b.y ?? b[1];
    const bz = b.z ?? b[2];
    if (![ax, ay, az, bx, by, bz].every(Number.isFinite)) {
        return null;
    }
    return { dx: Math.abs(bx - ax), dy: Math.abs(by - ay), dz: Math.abs(bz - az) };
}

function colliderKind(mesh) {
    const name = (mesh.name || "").toLowerCase();
    if (
        name.startsWith("player")
        || name.startsWith("walkslab")
        || name.startsWith("tree")
        || name.includes("island_tree")
        || name.startsWith("mesh.")
        || name.startsWith("firefly")
        || name.startsWith("shroom")
        || name === "moon"
        || name.includes("aim")
        || name.includes("windowglow")
        || name.includes("_flame")
        || name.startsWith("fencewall")
        || name.startsWith("fencepost")
        || name.startsWith("hamletkerb")
        || name.startsWith("hamletring")
        || name.startsWith("Spell")
        || name.startsWith("spell")
    ) {
        return null;
    }
    const size = localSize(mesh);
    if (!size) {
        return null;
    }
    const xz = Math.max(size.dx, size.dz);
    if (xz < 0.12 && size.dy < 0.15) {
        return null;
    }
    // Wide thin discs / paths — MESH so the AABB does not fill the courtyard.
    if (xz >= 1.5 && size.dy < 0.5) {
        return "mesh";
    }
    return "box";
}

function addGroundSlab(engine, scene, world) {
    const slab = createBox(engine, { width: 56, height: 0.4, depth: 56 });
    slab.name = "WalkSlab";
    slab.position.y = -0.2;
    slab.visible = false;
    addToScene(scene, slab);
    createPhysicsAggregate(world, slab, PhysicsShapeType.BOX, {
        mass: 0,
        friction: 0.9,
        restitution: 0,
    });
}

/** Invisible BOX ring at world positions — glTF-baked fence meshes sit at local origin. */
function addHamletRing(engine, scene, world) {
    const radius = 10.6;
    const count = 48;
    const size = 1.5;
    for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const wall = createBox(engine, { width: size, height: 1.7, depth: size });
        wall.name = "HamletRing";
        wall.position.x = Math.cos(a) * radius;
        wall.position.y = 0.85;
        wall.position.z = Math.sin(a) * radius;
        wall.visible = false;
        addToScene(scene, wall);
        createPhysicsAggregate(world, wall, PhysicsShapeType.BOX, {
            mass: 0,
            friction: 0.9,
            restitution: 0,
        });
    }
}

function addStaticColliders(world, meshes) {
    let meshCount = 0;
    let boxCount = 0;
    for (const mesh of meshes) {
        const kind = colliderKind(mesh);
        if (!kind) {
            continue;
        }
        try {
            if (kind === "mesh") {
                const shape = createPhysicsShape(world, {
                    type: PhysicsShapeType.MESH,
                    mesh,
                });
                createPhysicsAggregate(world, mesh, PhysicsShapeType.MESH, {
                    mass: 0,
                    friction: 0.9,
                    restitution: 0,
                    shape,
                });
                meshCount += 1;
            } else {
                createPhysicsAggregate(world, mesh, PhysicsShapeType.BOX, {
                    mass: 0,
                    friction: 0.8,
                    restitution: 0,
                });
                boxCount += 1;
            }
        } catch (err) {
            console.warn("collider skipped", mesh.name, err);
        }
    }
    return { meshCount, boxCount };
}

function createAvatar(engine, scene) {
    const body = createCapsule(engine, {
        height: CAPSULE.height,
        radius: CAPSULE.radius,
        tessellation: 14,
        capSubdivisions: 6,
    });
    body.name = "Player";
    body.material = createPbrMaterial({
        baseColorFactor: [0.12, 0.38, 0.34, 1],
        metallicFactor: 0.08,
        roughnessFactor: 0.48,
    });
    if ("emissiveColor" in body.material) {
        body.material.emissiveColor = [0.05, 0.22, 0.18];
        body.material.emissiveIntensity = 0.35;
    }
    addToScene(scene, body);

    const head = createSphere(engine, { diameter: 0.34, segments: 12 });
    head.name = "PlayerHead";
    head.material = body.material;
    head.position.y = CAPSULE.height * 0.28;
    addToScene(scene, head);
    setParent(head, body);

    return body;
}

async function loadHavok() {
    return HavokPhysics({
        locateFile: (file) => (file.endsWith(".wasm") ? "/HavokPhysics.wasm" : file),
    });
}

/**
 * @param {import("./camera-rig.js").CameraRig} rig
 * @param {number} dt
 * @param {{ facing: number, grounded: boolean, vy: number }} state
 */
function applyLocomotion(rig, dt, state) {
    const h = Math.min(dt, 1 / 30);

    if (input.rmb) {
        state.facing += input.lookX;
        state.facing = angleDamp(state.facing, rig.yaw, FACE_DAMP, h);
    } else if (input.turn !== 0) {
        const d = input.turn * TURN_RATE * h;
        state.facing += d;
        if (!input.lmb) {
            rig.yaw += d;
        }
    }

    const maxSpeed = input.walk ? WALK_SPEED : RUN_SPEED;
    const fx = Math.sin(state.facing);
    const fz = Math.cos(state.facing);
    const rx = Math.cos(state.facing);
    const rz = -Math.sin(state.facing);
    const wx = fx * input.forward + rx * input.strafe;
    const wz = fz * input.forward + rz * input.strafe;
    const wishLen = Math.hypot(wx, wz);
    let vx = 0;
    let vz = 0;
    if (wishLen > 0.001) {
        vx = (wx / wishLen) * maxSpeed;
        vz = (wz / wishLen) * maxSpeed;
    }
    return { vx, vz, h };
}

export async function setupPlayer(engine, scene, rig) {
    const body = createAvatar(engine, scene);
    body.position.x = 0;
    body.position.y = 1.1;
    body.position.z = 2.15;
    body.receiveShadows = true;

    const spawn = { x: 0, y: 1.15, z: 2.15 };
    const state = {
        facing: rig.yaw,
        grounded: true,
        vy: 0,
        support: -1,
        speed: 0,
        vx: 0,
        vz: 0,
        castBlend: 0,
        jumpLocked: false,
        wasAirborne: false,
    };
    let controller = null;
    let usingPhysics = false;
    let onPose = null;

    const poseBody = (x, y, z, dt) => {
        body.position.x = x;
        body.position.y = y;
        body.position.z = z;
        body.rotation.y = state.facing;
        rig.update(dt, body.position);
        onPose?.(dt);
    };

    try {
        const hknp = await loadHavok();
        const world = createHavokWorld(scene, hknp, GRAVITY);
        addGroundSlab(engine, scene, world);
        addHamletRing(engine, scene, world);
        const counts = addStaticColliders(world, scene.meshes ?? []);
        console.log("physics colliders", counts);
        controller = createPhysicsCharacterController(world, spawn, {
            capsuleHeight: CAPSULE.height,
            capsuleRadius: CAPSULE.radius,
        });
        controller.maxCharacterSpeedForSolver = 16;
        usingPhysics = true;
        const p0 = controller.getPosition();
        body.position.x = p0.x;
        body.position.y = p0.y;
        body.position.z = p0.z;

        onPhysicsAfterStep(world, (dt) => {
            pollInput();
            rig.applyLook();
            const { vx, vz } = applyLocomotion(rig, dt, state);
            state.vx = vx;
            state.vz = vz;
            state.speed = Math.hypot(vx, vz);
            const support = controller.checkSupport(dt, DOWN);
            const supported = support.supportedState === CharacterSupportedState.SUPPORTED;
            state.support = support.supportedState;
            state.grounded = supported;
            const vel = controller.getVelocity();
            let vy = vel.y;
            const h = Math.min(dt, 1 / 30);
            if (!supported) {
                // Lite integrate() does not add gravity to the character; it only
                // uses the gravity vector when pushing dynamic bodies.
                state.wasAirborne = true;
                vy += GRAVITY.y * h;
                state.grounded = false;
            } else if (vy > 0.15) {
                // Lingering SUPPORTED on the way up: gravity owns Y, do not re-apply.
                vy += GRAVITY.y * h;
                state.grounded = false;
            } else if (state.jumpLocked && !state.wasAirborne) {
                vy = 0;
                if (!input.jump) {
                    state.jumpLocked = false;
                }
            } else if (input.jump) {
                vy = JUMP_SPEED;
                state.jumpLocked = true;
                state.wasAirborne = false;
                state.grounded = false;
            } else {
                vy = 0;
                state.jumpLocked = false;
                state.wasAirborne = false;
            }
            state.vy = vy;
            controller.setVelocity({ x: vx, y: vy, z: vz });
            controller.integrate(dt, support, GRAVITY);
            const p = controller.getPosition();
            poseBody(p.x, p.y, p.z, dt);
            endFrame();
        });
    } catch (err) {
        console.warn("Havok unavailable, using kinematic walk", err);
        usingPhysics = false;
    }

    body.rotation.y = state.facing;
    rig.update(0, body.position);

    return {
        body,
        usingPhysics,
        capsuleHeight: CAPSULE.height,
        hp: 100,
        hpMax: 100,
        getFacing: () => state.facing,
        setFacing: (yaw) => {
            state.facing = yaw;
            body.rotation.y = yaw;
        },
        setCastBlend: (value) => {
            state.castBlend = value;
        },
        getGrounded: () => state.grounded,
        getSupport: () => state.support,
        getMotion: () => ({
            speed: state.speed,
            forward: input.forward,
            strafe: input.strafe,
            grounded: state.grounded,
            vy: state.vy,
            walk: input.walk,
            castBlend: state.castBlend,
        }),
        setOnPose: (cb) => {
            onPose = cb;
        },
        kinematicStep: (dt) => {
            if (usingPhysics) {
                return;
            }
            pollInput();
            rig.applyLook();
            const { vx, vz, h } = applyLocomotion(rig, dt, state);
            state.vx = vx;
            state.vz = vz;
            state.speed = Math.hypot(vx, vz);
            if (!state.grounded) {
                state.wasAirborne = true;
                state.vy -= GRAVITY_Y * h;
                body.position.y += state.vy * h;
                if (body.position.y <= KINEMATIC_GROUND_Y && state.vy <= 0) {
                    body.position.y = KINEMATIC_GROUND_Y;
                    state.vy = 0;
                    state.grounded = true;
                }
            } else if (state.vy > 0.15) {
                state.vy -= GRAVITY_Y * h;
                body.position.y += state.vy * h;
            } else if (state.jumpLocked && !state.wasAirborne) {
                state.vy = 0;
                body.position.y = KINEMATIC_GROUND_Y;
                if (!input.jump) {
                    state.jumpLocked = false;
                }
            } else if (input.jump) {
                state.vy = JUMP_SPEED;
                state.jumpLocked = true;
                state.wasAirborne = false;
                state.grounded = false;
            } else {
                state.vy = 0;
                state.jumpLocked = false;
                state.wasAirborne = false;
                body.position.y = KINEMATIC_GROUND_Y;
            }
            body.position.x += vx * h;
            body.position.z += vz * h;
            const r = Math.hypot(body.position.x, body.position.z);
            if (r > KINEMATIC_MAX_R) {
                body.position.x *= KINEMATIC_MAX_R / r;
                body.position.z *= KINEMATIC_MAX_R / r;
            }
            body.rotation.y = state.facing;
            rig.update(h, body.position);
            onPose?.(h);
            endFrame();
        },
    };
}
