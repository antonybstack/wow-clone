/**
 * Facing-relative MMORPG movement using the Babylon Lite Havok controller.
 * World collision is authored explicitly: decorative meshes never become walls.
 */
import HavokPhysics from "@babylonjs/havok";
import {
    CharacterSupportedState, PhysicsShapeType, addToScene, createCapsule,
    createHavokWorld, createPbrMaterial, createPhysicsAggregate,
    createPhysicsCharacterController, createPhysicsShape, createSphere,
    createTransformNode, onPhysicsAfterStep, setParent, physicsRaycast,
} from "@babylonjs/lite";
import { input, pollInput, endFrame } from "./input.js";

const WALK_SPEED = 2.5;
const RUN_SPEED = 7;
const BACK_SPEED = 3.5;
const TURN_RATE = 2.55;
const JUMP_SPEED = 6.6;
const GRAVITY = { x: 0, y: -20.8, z: 0 };
const DOWN = { x: 0, y: -1, z: 0 };
/** Legacy Mixamo default. Never mutate; per-instance specs are copies. */
export const DEFAULT_CAPSULE = Object.freeze({ height: 1.55, radius: 0.28 });

/**
 * Lite Havok capsule uses pointA/B at ±(height/2 − radius). Height must be ≥ 2×radius.
 * @param {{ height?: number, radius?: number } | null | undefined} capsule
 */
export function resolveCapsule(capsule) {
    if (capsule == null) {
        return { height: DEFAULT_CAPSULE.height, radius: DEFAULT_CAPSULE.radius };
    }
    const height = Number(capsule.height);
    const radius = Number(capsule.radius);
    if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(radius) || radius <= 0) {
        throw new Error(`Invalid capsule dimensions: height=${capsule.height} radius=${capsule.radius}`);
    }
    if (height < 2 * radius) {
        throw new Error(`Invalid capsule dimensions: height ${height} < 2*radius ${2 * radius}`);
    }
    return { height, radius };
}

/**
 * Preserve an explicit finite spawn center. Clamp upward only if it would sit
 * below ground + half capsule (embedded). Floor+half only when Y is missing.
 * @param {{x?:number,y?:number,z?:number}|null|undefined} spawn
 * @param {{height:number,radius:number}} spec
 * @param {(x:number,z:number)=>number} [groundHeight]
 */
export function resolveSpawnCenter(spawn, spec, groundHeight) {
    const x = Number.isFinite(spawn?.x) ? spawn.x : 0;
    const z = Number.isFinite(spawn?.z) ? spawn.z : 2.15;
    const sampled = typeof groundHeight === "function" ? groundHeight(x, z) : 0.125;
    const ground = Number.isFinite(sampled) ? sampled : 0.125;
    const floorCenter = ground + spec.height * 0.5;
    const yIn = spawn?.y;
    if (!Number.isFinite(yIn)) {
        return { x, y: floorCenter, z, ground, floorCenter, clamped: true };
    }
    const y = yIn < floorCenter ? floorCenter : yIn;
    return { x, y, z, ground, floorCenter, clamped: y !== yIn };
}

/**
 * Starter-zone plant: this layout's spawn means "on the terrain", not a hover.
 * Does not change resolveSpawnCenter's elevated-Y contract.
 */
export function plantSpawnOnTerrain(spawn, spec, groundHeight) {
    const x = Number.isFinite(spawn?.x) ? spawn.x : 0;
    const z = Number.isFinite(spawn?.z) ? spawn.z : -6;
    const sampled = typeof groundHeight === "function" ? groundHeight(x, z) : 0;
    const ground = Number.isFinite(sampled) ? sampled : 0;
    return { x, y: ground + spec.height * 0.5, z, ground };
}
const JUMP_BUFFER = 0.12;
const COYOTE_TIME = 0.085;

// A supported capsule can have positive Y velocity while climbing a slope or
// resolving contact penetration. Only an actual jump impulse rejects support
// during ascent; ordinary uphill motion must remain grounded.
export function hasGroundSupport(supported, verticalSpeed, jumpInFlight) {
    return supported && !(jumpInFlight && verticalSpeed > 0.15);
}

export function surfaceVerticalSpeed(vx, vz, normal, surfaceVelocity) {
    if (!normal || normal.y <= 0.001) return 0;
    const sx = surfaceVelocity?.x || 0, sy = surfaceVelocity?.y || 0, sz = surfaceVelocity?.z || 0;
    return sy - (normal.x * (vx - sx) + normal.z * (vz - sz)) / normal.y;
}

/** A collision proxy is a transform only, with no GPU geometry or draw call. */
function addStaticColliders(world, descriptors) {
    const counts = { meshCount: 0, boxCount: 0, skipped: 0 };
    for (const entry of descriptors) {
        const mesh = entry.mesh || (entry._cpuPositions ? entry : null);
        const type = entry.type || mesh?.metadata?.collider || "box";
        try {
            if (type === "mesh") {
                if (!mesh) throw new Error("Triangle collision requires a mesh");
                const shape = createPhysicsShape(world, { type: PhysicsShapeType.MESH, mesh });
                // Procedural terrain is authored in world space or has a root transform.
                createPhysicsAggregate(world, mesh, PhysicsShapeType.MESH,
                    { mass: 0, friction: 0.9, restitution: 0, shape });
                counts.meshCount++;
                continue;
            }
            let position = entry.position;
            let size = entry.size;
            let rotation = entry.rotation;
            if (mesh) {
                const min = mesh.boundMin;
                const max = mesh.boundMax;
                const m = mesh.worldMatrix;
                if (!min || !max || !m) throw new Error("Box collider has no bounds");
                const value = (a, i, key) => a[key] ?? a[i];
                const cx = (value(min, 0, "x") + value(max, 0, "x")) * 0.5;
                const cy = (value(min, 1, "y") + value(max, 1, "y")) * 0.5;
                const cz = (value(min, 2, "z") + value(max, 2, "z")) * 0.5;
                position = { x: m[0] * cx + m[4] * cy + m[8] * cz + m[12],
                    y: m[1] * cx + m[5] * cy + m[9] * cz + m[13],
                    z: m[2] * cx + m[6] * cy + m[10] * cz + m[14] };
                const sx = Math.hypot(m[0], m[1], m[2]);
                const sy = Math.hypot(m[4], m[5], m[6]);
                const sz = Math.hypot(m[8], m[9], m[10]);
                size = { x: (value(max, 0, "x") - value(min, 0, "x")) * sx,
                    y: (value(max, 1, "y") - value(min, 1, "y")) * sy,
                    z: (value(max, 2, "z") - value(min, 2, "z")) * sz };
                // Architectural collision proxies are upright; yaw follows the world transform.
                rotation = { y: Math.atan2(m[8] / (sz || 1), m[10] / (sz || 1)) };
            }
            if (!position || !size) throw new Error("Box collider needs position and size");
            const node = createTransformNode(`Collision_${mesh?.name || counts.boxCount}`,
                position.x, position.y, position.z);
            node.metadata = { colliderId: entry.id ?? null };
            if (rotation?.w !== undefined) {
                node.rotationQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
            } else if (rotation) {
                node.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
            }
            createPhysicsAggregate(world, node, PhysicsShapeType.BOX, {
                mass: 0, friction: 0.8, restitution: 0,
                extents: { x: Math.max(0.02, size.x ?? size.width),
                    y: Math.max(0.02, size.y ?? size.height),
                    z: Math.max(0.02, size.z ?? size.depth) },
            });
            counts.boxCount++;
        } catch (err) {
            counts.skipped++;
            console.warn("Collision skipped", mesh?.name || entry, err);
        }
    }
    return counts;
}

function createAvatar(engine, scene, spec) {
    const body = createCapsule(engine, {
        height: spec.height, radius: spec.radius, tessellation: 12, capSubdivisions: 5,
    });
    body.name = "Player";
    body.material = createPbrMaterial({
        baseColorFactor: [0.12, 0.28, 0.3, 1], metallicFactor: 0.08, roughnessFactor: 0.6,
    });
    addToScene(scene, body);
    const head = createSphere(engine, { diameter: 0.34, segments: 10 });
    head.name = "PlayerHead";
    head.material = body.material;
    head.position.y = spec.height * 0.28;
    addToScene(scene, head);
    setParent(head, body);
    return { body, head };
}

/**
 * @param {object} engine
 * @param {object} scene
 * @param {import("./camera-rig.js").CameraRig} rig
 * @param {{spawn?:{x:number,y:number,z:number},colliders?:object[],groundHeight?:(x:number,z:number)=>number,boundsRadius?:number,capsule?:{height:number,radius:number}}} options
 * Spawn is the capsule center. Explicit finite Y is kept unless it would embed the capsule.
 */
export async function setupPlayer(engine, scene, rig, options = {}) {
    const spec = resolveCapsule(options.capsule);
    const { body, head } = createAvatar(engine, scene, spec);
    const groundHeight = options.groundHeight || (() => 0.125);
    const spawn = resolveSpawnCenter(options.spawn || { x: 0, y: 1.15, z: 2.15 }, spec, groundHeight);
    const boundsRadius = options.boundsRadius ?? 180;
    const state = { facing: rig.yaw, grounded: false, vy: 0, support: -1,
        speed: 0, vx: 0, vz: 0, castBlend: 0, jumps: 0, landings: 0, recoveries: 0,
        jumpInFlight: false, airTime: 0 };
    const velocity = { x: 0, y: 0, z: 0 };
    const motion = {};
    let controller = null;
    let physicsWorld = null;
    let usingPhysics = false;
    let heightScale = 1;
    let onPose = null;
    let jumpBuffer = 0;
    let coyote = 0;
    let previousJump = false;
    let counts = { meshCount: 0, boxCount: 0, skipped: 0 };
    body.position.set(spawn.x, spawn.y, spawn.z);
    body.receiveShadows = true;
    rig.setGroundHeight?.(groundHeight);

    const capsuleHeightOf = () => spec.height * heightScale;
    const teleport = (x, y, z) => {
        velocity.x = velocity.y = velocity.z = 0;
        controller?.setPosition({ x, y, z });
        controller?.setVelocity(velocity);
        body.position.set(x, y, z);
        state.vx = state.vy = state.vz = state.speed = 0;
        state.grounded = false;
        state.support = -1;
        state.jumpInFlight = false;
        state.airTime = 0;
        coyote = jumpBuffer = 0;
        rig.update(0, body.position);
    };

    const step = (dt) => {
        const h = Math.min(Math.max(dt, 0), 0.05);
        if (h <= 0) return;
        pollInput();
        rig.applyLook();
        if (input.rmb) {
            state.facing = rig.yaw;
        } else if (input.turn) {
            const turn = input.turn * TURN_RATE * h;
            state.facing += turn;
            if (!input.lmb) rig.yaw += turn;
        }
        const speed = input.walk ? WALK_SPEED : input.forward < 0 ? BACK_SPEED : RUN_SPEED;
        const sin = Math.sin(state.facing);
        const cos = Math.cos(state.facing);
        const wx = sin * input.forward + cos * input.strafe;
        const wz = cos * input.forward - sin * input.strafe;
        const length = Math.max(1, Math.hypot(wx, wz));
        velocity.x = wx * speed / length;
        velocity.z = wz * speed / length;
        const oldX = body.position.x;
        const oldY = body.position.y;
        const oldZ = body.position.z;
        const wasGrounded = state.grounded;
        let support = null;
        let supported;
        if (controller) {
            support = controller.checkSupport(h, DOWN);
            state.support = support.supportedState;
            supported = support.supportedState === CharacterSupportedState.SUPPORTED;
            state.vy = controller.getVelocity().y;
        } else {
            const floor = groundHeight(oldX, oldZ) + capsuleHeightOf() * 0.5;
            supported = oldY <= floor + 0.06 && state.vy <= 0;
            state.support = supported ? CharacterSupportedState.SUPPORTED : CharacterSupportedState.UNSUPPORTED;
        }
        state.grounded = hasGroundSupport(supported, state.vy, state.jumpInFlight);
        if (state.grounded) state.jumpInFlight = false;
        coyote = state.grounded ? COYOTE_TIME : Math.max(0, coyote - h);
        if (input.jumpPressed || (input.jump && !previousJump)) jumpBuffer = JUMP_BUFFER;
        else jumpBuffer = Math.max(0, jumpBuffer - h);
        previousJump = input.jump;
        if (jumpBuffer > 0 && coyote > 0) {
            state.vy = JUMP_SPEED;
            state.grounded = false;
            jumpBuffer = coyote = 0;
            state.jumps++;
            state.jumpInFlight = true;
        } else if (state.grounded) {
            // Follow the walkable support plane in both directions. Zeroing Y
            // every frame repeatedly launched the capsule off downhill terrain.
            state.vy = surfaceVerticalSpeed(velocity.x, velocity.z,
                support?.averageSurfaceNormal, support?.averageSurfaceVelocity);
        } else {
            state.vy += GRAVITY.y * h;
        }
        velocity.y = state.vy;
        if (controller) {
            controller.setVelocity(velocity);
            controller.integrate(h, support, GRAVITY);
            const p = controller.getPosition();
            body.position.set(p.x, p.y, p.z);
        } else {
            body.position.x += velocity.x * h;
            body.position.y += velocity.y * h;
            body.position.z += velocity.z * h;
            const floor = groundHeight(body.position.x, body.position.z) + capsuleHeightOf() * 0.5;
            if (body.position.y <= floor && state.vy <= 0) {
                body.position.y = floor;
                state.vy = 0;
                state.grounded = true;
            }
        }
        const radius = Math.hypot(body.position.x, body.position.z);
        if (Number.isFinite(boundsRadius) && radius > boundsRadius) {
            body.position.x *= boundsRadius / radius;
            body.position.z *= boundsRadius / radius;
            controller?.setPosition(body.position);
        }
        const floor = groundHeight(body.position.x, body.position.z);
        if (!Number.isFinite(body.position.y) || body.position.y < floor - 4 || body.position.y < -120) {
            state.recoveries++;
            teleport(spawn.x, spawn.y, spawn.z);
        }
        state.airTime = state.grounded ? 0 : state.airTime + h;
        if (state.grounded) state.jumpInFlight = false;
        if (state.grounded && !wasGrounded) state.landings++;
        state.vx = (body.position.x - oldX) / h;
        state.vz = (body.position.z - oldZ) / h;
        state.speed = Math.hypot(state.vx, state.vz);
        body.rotation.y = state.facing;
        rig.update(h, body.position);
        onPose?.(h);
        endFrame();
    };

    try {
        const hknp = await HavokPhysics({
            locateFile: (file) => file.endsWith(".wasm") ? "/HavokPhysics.wasm" : file,
        });
        const world = createHavokWorld(scene, hknp, GRAVITY);
        physicsWorld = world;
        const descriptors = options.colliders || (scene.meshes || [])
            .filter((mesh) => mesh.metadata?.collider)
            .map((mesh) => ({ mesh, type: mesh.metadata.collider }));
        counts = addStaticColliders(world, descriptors);
        // A missing collision asset is explicit in diagnostics; fallback still follows terrain.
        if (!counts.meshCount && !counts.boxCount) {
            world._stopStep?.();
            console.warn("No authored colliders; using terrain locomotion");
        } else {
            controller = createPhysicsCharacterController(world, spawn, {
                capsuleHeight: spec.height, capsuleRadius: spec.radius,
            });
            controller.maxCharacterSpeedForSolver = 18;
            controller.maxSlopeCosine = Math.cos(Math.PI * 0.27);
            controller.keepDistance = 0.035;
            usingPhysics = true;
            onPhysicsAfterStep(world, step);
        }
    } catch (error) {
        console.warn("Havok unavailable; using terrain locomotion", error);
    }
    console.info("physics colliders", counts);
    rig.update(0, body.position);

    return {
        body, usingPhysics, hp: 100, hpMax: 100,
        raycast: (from, to) => usingPhysics && physicsWorld ? physicsRaycast(physicsWorld, from, to) : null,
        get capsuleHeight() { return capsuleHeightOf(); },
        get heightScale() { return heightScale; },
        setHeightScale(scale) {
            const next = Math.min(1.15, Math.max(0.9, scale));
            if (!Number.isFinite(next) || Math.abs(next - heightScale) < 1e-4) return capsuleHeightOf();
            const oldHeight = capsuleHeightOf();
            heightScale = next;
            const height = capsuleHeightOf();
            if (controller) {
                controller.setShapeOptions({ capsuleHeight: height, capsuleRadius: spec.radius * heightScale }, true);
                const p = controller.getPosition();
                body.position.set(p.x, p.y, p.z);
            } else body.position.y += (height - oldHeight) * 0.5;
            head.position.y = height * 0.28;
            return height;
        },
        getFacing: () => state.facing,
        setFacing(yaw) { if (Number.isFinite(yaw)) body.rotation.y = state.facing = yaw; },
        setCastBlend(value) { state.castBlend = value; },
        getGrounded: () => state.grounded,
        getSupport: () => state.support,
        getVy: () => state.vy,
        getMotion() {
            motion.speed = state.speed; motion.forward = input.forward; motion.strafe = input.strafe;
            motion.grounded = state.grounded; motion.vy = state.vy; motion.walk = input.walk;
            motion.castBlend = state.castBlend;
            motion.jumpInFlight = state.jumpInFlight; motion.airTime = state.airTime;
            return motion;
        },
        getDebugState: () => ({ ...state, position: { x: body.position.x, y: body.position.y, z: body.position.z },
            usingPhysics, colliders: { ...counts }, capsuleHeight: capsuleHeightOf() }),
        groundHeight,
        setWorldPos: teleport,
        setOnPose(cb) { onPose = cb; },
        kinematicStep(dt) { if (!usingPhysics) step(dt); },
    };
}
