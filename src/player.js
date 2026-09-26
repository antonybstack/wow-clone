/**
 * Facing-relative MMORPG movement using the Babylon Lite Havok controller.
 * World collision is authored explicitly: decorative meshes never become walls.
 */
import HavokPhysics from "@babylonjs/havok";
import {
    CharacterSupportedState, PhysicsMotionType, PhysicsShapeType, addToScene, createCapsule,
    createHavokWorld, createPbrMaterial, createPhysicsAggregate, disposePhysics,
    createPhysicsBody, createPhysicsCharacterController, createPhysicsShape, createSphere,
    createTransformNode, onPhysicsAfterStep, onSceneDispose, setParent, physicsRaycast, releasePhysicsShape, shapeCast,
    setPhysicsBodyShape, setPhysicsBodyTransform, removePhysicsBody,
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
export function hasGroundSupport(supported, verticalSpeed, jumpInFlight, slopeVy = 0) {
    if (!supported) return false;
    if (!jumpInFlight) return true;
    const leave = Math.max(0.15, (Number.isFinite(slopeVy) ? slopeVy : 0) + 0.15);
    return verticalSpeed <= leave;
}

export function surfaceVerticalSpeed(vx, vz, normal, surfaceVelocity) {
    if (!normal || normal.y <= 0.001) return 0;
    const sx = surfaceVelocity?.x || 0, sy = surfaceVelocity?.y || 0, sz = surfaceVelocity?.z || 0;
    return sy - (normal.x * (vx - sx) + normal.z * (vz - sz)) / normal.y;
}

/**
 * Lite leaves aggregate shapes and bodies with the caller. A controller owns its
 * own body, current capsule shape, and query collectors. Keep it outside these
 * sets, including after setShapeOptions replaces its capsule.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/42-physics.md
 */
export function createPhysicsOwnership(rig, operations = {
    removeBody: removePhysicsBody, releaseShape: releasePhysicsShape, disposeWorld: disposePhysics,
}) {
    let world = null;
    let controller = null;
    let cameraShape = null;
    let disposed = false;
    const bodies = new Set();
    const shapes = new Set();
    const safely = (label, action) => {
        try { action(); } catch (error) { console.warn(`Physics ${label} cleanup failed`, error); }
    };
    return {
        get disposed() { return disposed; },
        get world() { return world; },
        setWorld(value) {
            if (disposed) {
                operations.disposeWorld(value);
                throw new Error("Physics scene disposed during initialization");
            }
            world = value;
        },
        setController(value) { controller = value; },
        shape(value) { shapes.add(value); return value; },
        body(value) { bodies.add(value); return value; },
        setCameraShape(value) { cameraShape = value; shapes.add(value); return value; },
        releaseShape(value) {
            if (!world || !shapes.delete(value)) return;
            operations.releaseShape(world, value);
        },
        removeBody(value) {
            if (!world || !bodies.delete(value)) return;
            operations.removeBody(world, value);
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            // The rig may query while a render callback is still in flight.
            safely("camera sweep", () => rig.setCollisionSweep?.(null));
            if (!world) return;
            // Lite controller.dispose removes its body and releases the latest
            // capsule shape, even after a height change.
            if (controller) safely("controller", () => controller.dispose());
            controller = null;
            if (cameraShape) {
                safely("camera query shape", () => operations.releaseShape(world, cameraShape));
                shapes.delete(cameraShape);
                cameraShape = null;
            }
            for (const body of bodies) safely("body", () => operations.removeBody(world, body));
            for (const shape of shapes) safely("shape", () => operations.releaseShape(world, shape));
            bodies.clear();
            shapes.clear();
            safely("world", () => operations.disposeWorld(world));
            world = null;
        },
    };
}

/** A collision proxy is a transform only, with no GPU geometry or draw call. */
function addStaticColliders(world, descriptors, own) {
    const counts = { meshCount: 0, boxCount: 0, skipped: 0 };
    for (const entry of descriptors) {
        const mesh = entry.mesh || (entry._cpuPositions ? entry : null);
        const type = entry.type || mesh?.metadata?.collider || "box";
        let ownedShape = null;
        try {
            if (type === "mesh") {
                if (!mesh) throw new Error("Triangle collision requires a mesh");
                const shape = ownedShape = own.shape(createPhysicsShape(world, { type: PhysicsShapeType.MESH, mesh }));
                // Procedural terrain is authored in world space or has a root transform.
                own.body(createPhysicsAggregate(world, mesh, PhysicsShapeType.MESH,
                    { mass: 0, friction: 0.9, restitution: 0, shape }).body);
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
            const extents = { x: Math.max(0.02, size.x ?? size.width),
                y: Math.max(0.02, size.y ?? size.height),
                z: Math.max(0.02, size.z ?? size.depth) };
            const aggregate = createPhysicsAggregate(world, node, PhysicsShapeType.BOX, {
                mass: 0, friction: 0.8, restitution: 0,
                extents,
            });
            // The aggregate returns both caller-owned handles; body removal
            // does not release its shape in Lite's physics contract.
            ownedShape = own.shape(aggregate.shape);
            own.body(aggregate.body);
            counts.boxCount++;
        } catch (err) {
            if (ownedShape) own.releaseShape(ownedShape);
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
 * @param {{spawn?:{x:number,y:number,z:number},colliders?:object[],groundHeight?:(x:number,z:number)=>number,boundsRadius?:number,boundsRect?:{minX:number,maxX:number,minZ:number,maxZ:number},capsule?:{height:number,radius:number}}} options
 * Spawn is the capsule center. Explicit finite Y is kept unless it would embed the capsule.
 * `boundsRect`, when given, replaces the circular `boundsRadius` clamp with an axis-aligned
 * rectangle clamp (min/max X and Z) — for a world that is a corridor rather than a disc, a radius
 * clamp lets the player walk off the terrain edges that a rectangle catches. `boundsRadius` alone
 * (no `boundsRect`) behaves exactly as before, so existing callers are unaffected.
 */
export async function setupPlayer(engine, scene, rig, options = {}) {
    const spec = resolveCapsule(options.capsule);
    const { body, head } = createAvatar(engine, scene, spec);
    const groundHeight = options.groundHeight || (() => 0.125);
    const spawn = resolveSpawnCenter(options.spawn || { x: 0, y: 1.15, z: 2.15 }, spec, groundHeight);
    const boundsRadius = options.boundsRadius ?? 180;
    const boundsRect = options.boundsRect ?? null;
    const state = { facing: rig.yaw, grounded: false, vy: 0, support: -1,
        speed: 0, vx: 0, vz: 0, castBlend: 0, jumps: 0, landings: 0, recoveries: 0,
        jumpInFlight: false, airTime: 0 };
    const velocity = { x: 0, y: 0, z: 0 };
    const motion = {};
    const descriptors = options.colliders || (scene.meshes || [])
        .filter((mesh) => mesh.metadata?.collider)
        .map((mesh) => ({ mesh, type: mesh.metadata.collider }));
    let controller = null;
    let physicsWorld = null;
    let usingPhysics = false;
    let sceneDisposed = false;
    const own = createPhysicsOwnership(rig);
    const cleanupPhysics = () => {
        own.dispose();
        controller = null;
        physicsWorld = null;
        usingPhysics = false;
    };
    // Register before Havok's asynchronous WASM load: scene teardown may race it.
    onSceneDispose(scene, () => { sceneDisposed = true; cleanupPhysics(); });
    let heightScale = 1;
    let onPose = null;
    let jumpBuffer = 0;
    let coyote = 0;
    let previousJump = false;
    let flying = false;
    let moveScale = 1;
    let counts = { meshCount: 0, boxCount: 0, skipped: 0, animatedCount: 0 };
    const animatedColliders = new Map();
    const identityQuat = { x: 0, y: 0, z: 0, w: 1 };
    body.position.set(spawn.x, spawn.y, spawn.z);
    body.receiveShadows = true;

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
        if (sceneDisposed) return;
        const h = Math.min(Math.max(dt, 0), 0.05);
        if (h <= 0) return;
        pollInput();
        rig.applyLook();
        if (input.rmb || input.faceCamera) {
            state.facing = rig.yaw;
        } else if (input.turn) {
            const turn = input.turn * TURN_RATE * h;
            state.facing += turn;
            if (!input.lmb) rig.yaw += turn;
        }
        const flySpeed = input.walk ? 6 : 16;
        const speed = (flying ? flySpeed : input.walk ? WALK_SPEED : input.forward < 0 ? BACK_SPEED : RUN_SPEED) * (flying ? 1 : moveScale);
        const yaw = flying ? rig.yaw : state.facing;
        const sin = Math.sin(yaw);
        const cos = Math.cos(yaw);
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
        const slopeVy = surfaceVerticalSpeed(velocity.x, velocity.z,
            support?.averageSurfaceNormal, support?.averageSurfaceVelocity);
        if (state.jumpInFlight && state.vy <= 0.15) state.jumpInFlight = false;
        state.grounded = flying || hasGroundSupport(supported, state.vy, state.jumpInFlight, slopeVy);
        if (state.grounded) state.jumpInFlight = false;
        coyote = state.grounded ? COYOTE_TIME : Math.max(0, coyote - h);
        if (input.jumpPressed || (input.jump && !previousJump)) jumpBuffer = JUMP_BUFFER;
        else jumpBuffer = Math.max(0, jumpBuffer - h);
        previousJump = input.jump;
        if (flying) {
            let lift = 0;
            if (input.jump) lift += speed;
            if (input.walk) lift -= speed;
            state.vy = lift;
            state.jumpInFlight = false;
            jumpBuffer = coyote = 0;
        } else if (jumpBuffer > 0 && coyote > 0) {
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
        if (flying) {
            body.position.x += velocity.x * h;
            body.position.y += velocity.y * h;
            body.position.z += velocity.z * h;
            controller?.setPosition({ x: body.position.x, y: body.position.y, z: body.position.z });
            controller?.setVelocity({ x: 0, y: 0, z: 0 });
        } else if (controller) {
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
        // Havok's controller is kinematic and does not generate contacts against other
        // kinematic/static bodies added after setup. Resolve living enemy capsules in XZ
        // here so movement, jump and the bounds clamp below stay on the same path.
        for (const handle of animatedColliders.values()) {
            if (flying || !handle.enabled) continue;
            const other = handle.pose;
            const min = spec.radius * heightScale + handle.radius + 0.12;
            const dx = body.position.x - other.x;
            const dz = body.position.z - other.z;
            const dist = Math.hypot(dx, dz);
            const oldDz = oldZ - other.z;
            const crossed = dist >= min && (oldDz * dz) < 0 && Math.abs(dx) < min;
            if (dist >= min && !crossed) continue;
            if (crossed) {
                body.position.z = other.z + (oldDz < 0 ? -min : min);
            } else if (dist < 1e-5) {
                body.position.z = other.z - min;
            } else {
                const s = min / dist;
                body.position.x = other.x + dx * s;
                body.position.z = other.z + dz * s;
            }
            controller?.setPosition({ x: body.position.x, y: body.position.y, z: body.position.z });
        }
        if (!flying) {
            if (boundsRect) {
                const cx = Math.min(Math.max(body.position.x, boundsRect.minX), boundsRect.maxX);
                const cz = Math.min(Math.max(body.position.z, boundsRect.minZ), boundsRect.maxZ);
                if (cx !== body.position.x || cz !== body.position.z) {
                    body.position.x = cx;
                    body.position.z = cz;
                    controller?.setPosition(body.position);
                }
            } else {
                const radius = Math.hypot(body.position.x, body.position.z);
                if (Number.isFinite(boundsRadius) && radius > boundsRadius) {
                    body.position.x *= boundsRadius / radius;
                    body.position.z *= boundsRadius / radius;
                    controller?.setPosition(body.position);
                }
            }
        }
        const floor = groundHeight(body.position.x, body.position.z);
        if (!flying && (!Number.isFinite(body.position.y) || body.position.y < floor - 4 || body.position.y < -120)) {
            state.recoveries++;
            teleport(spawn.x, spawn.y, spawn.z);
        }
        state.airTime = state.grounded ? 0 : state.airTime + h;
        if (state.grounded) state.jumpInFlight = false;
        if (state.grounded && !wasGrounded) state.landings++;
        state.vx = (body.position.x - oldX) / h;
        state.vz = (body.position.z - oldZ) / h;
        state.speed = Math.hypot(state.vx, state.vz);
        if (flying) state.facing = rig.yaw;
        body.rotation.y = state.facing;
        rig.update(h, body.position);
        onPose?.(h);
        endFrame();
    };

    try {
        const hknp = await HavokPhysics({
      // A previous Pages deploy cached an HTML fallback at the old URL under
      // an immutable header. The versioned request bypasses that stale entry.
      locateFile: (file) => file.endsWith(".wasm") ? "/HavokPhysics.wasm?v=20260923-1" : file,
        });
        if (sceneDisposed) throw new Error("Physics scene disposed during initialization");
        const world = createHavokWorld(scene, hknp, GRAVITY);
        own.setWorld(world);
        physicsWorld = world;
        const staticCounts = addStaticColliders(world, descriptors, own);
        counts.meshCount = staticCounts.meshCount;
        counts.boxCount = staticCounts.boxCount;
        counts.skipped = staticCounts.skipped;
        // A missing collision asset is explicit in diagnostics; fallback still follows terrain.
        if (!counts.meshCount && !counts.boxCount) {
            cleanupPhysics();
            if (descriptors.length) throw new Error(`All ${descriptors.length} authored colliders failed to initialize`);
            console.warn("No authored colliders; using terrain locomotion");
        } else {
            controller = createPhysicsCharacterController(world, spawn, {
                capsuleHeight: spec.height, capsuleRadius: spec.radius,
            });
            own.setController(controller);
            controller.maxCharacterSpeedForSolver = 18;
            controller.maxSlopeCosine = Math.cos(Math.PI * 0.27);
            controller.keepDistance = 0.035;
            // Lite's shapeCast queries the existing Havok world. Its ignoreBody
            // option excludes the player's capsule; release the query shape with
            // the scene. See the official physics module documentation:
            // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/42-physics.md
            // This query-only sphere uses the same walls, ramps and terrain as movement.
            const cameraShape = own.setCameraShape(createPhysicsShape(world, {
                type: PhysicsShapeType.SPHERE, parameters: { radius: 0.22 },
            }));
            const cameraQuery = {
                shape: cameraShape, rotation: identityQuat, ignoreBody: controller.getBody(),
                shouldHitTriggers: false, startPosition: null, endPosition: null,
            };
            rig.setCollisionSweep?.((from, to) => {
                if (sceneDisposed || own.disposed) return null;
                cameraQuery.startPosition = from;
                cameraQuery.endPosition = to;
                return shapeCast(world, cameraQuery);
            });
            usingPhysics = true;
            onPhysicsAfterStep(world, (dt) => {
                if (!sceneDisposed && !own.disposed) step(dt);
            });
        }
    } catch (error) {
        cleanupPhysics();
        if (sceneDisposed || descriptors.length > 0) throw error;
        console.warn("Havok unavailable; using terrain locomotion", error);
    }
    console.info("physics colliders", counts);
    rig.update(0, body.position);

    return {
        body, get usingPhysics() { return usingPhysics; }, hp: 100, hpMax: 100,
        raycast: (from, to) => !sceneDisposed && usingPhysics && physicsWorld
            ? physicsRaycast(physicsWorld, from, to) : null,
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
        setMoveScale(scale) {
            moveScale = Number.isFinite(scale) ? Math.min(1, Math.max(0.2, scale)) : 1;
        },
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
            usingPhysics, colliders: { ...counts }, capsuleHeight: capsuleHeightOf(),
            animated: [...animatedColliders.values()].map((h) => ({
                id: h.id, enabled: h.enabled, radius: h.radius, pose: { ...h.pose },
            })),
        }),
        groundHeight,
        setWorldPos: teleport,
        isFlying: () => flying,
        setFlying(on) {
            flying = !!on;
            if (!flying) {
                const x = body.position.x;
                const z = body.position.z;
                const y = groundHeight(x, z) + capsuleHeightOf() * 0.5;
                teleport(x, y, z);
            }
        },
        setOnPose(cb) { onPose = cb; },
        kinematicStep(dt) { if (!usingPhysics && !sceneDisposed) step(dt); },
        addAnimatedCollider({ id, x, y, z, height, radius }) {
            if (sceneDisposed || own.disposed || !physicsWorld || !id) return null;
            const specH = Number(height);
            const specR = Number(radius);
            if (!Number.isFinite(specH) || specH < 2 * specR || !Number.isFinite(specR) || specR <= 0) {
                throw new Error(`Invalid animated collider ${id}: height=${height} radius=${radius}`);
            }
            const node = createTransformNode(`Collision_${id}`, x, y, z);
            node.metadata = { colliderId: id };
            addToScene(scene, node);
            const shape = own.shape(createPhysicsShape(physicsWorld, {
                type: PhysicsShapeType.CAPSULE,
                parameters: {
                    pointA: { x: 0, y: specH * 0.5 - specR, z: 0 },
                    pointB: { x: 0, y: -specH * 0.5 + specR, z: 0 },
                    radius: specR,
                },
            }));
            // STATIC so the character controller (itself ANIMATED/kinematic) collides;
            // Havok skips kinematic-vs-kinematic contacts. Pose is teleported each tick.
            let colliderBody = null;
            try {
                colliderBody = own.body(createPhysicsBody(physicsWorld, node, PhysicsMotionType.STATIC));
                setPhysicsBodyShape(physicsWorld, colliderBody, shape);
            } catch (error) {
                if (colliderBody) own.removeBody(colliderBody);
                own.releaseShape(shape);
                throw error;
            }
            const handle = {
                id, node, body: colliderBody, shape, height: specH, radius: specR, enabled: true,
                pose: { x, y, z },
            };
            animatedColliders.set(id, handle);
            counts.animatedCount++;
            return handle;
        },
        moveAnimatedCollider(id, x, y, z) {
            const handle = animatedColliders.get(id);
            if (!handle || !physicsWorld) return;
            handle.pose = { x, y, z };
            if (!handle.enabled) return;
            setPhysicsBodyTransform(physicsWorld, handle.body, { x, y, z }, identityQuat);
        },
        setAnimatedColliderEnabled(id, enabled) {
            const handle = animatedColliders.get(id);
            if (!handle || !physicsWorld) return;
            handle.enabled = !!enabled;
            const p = handle.pose;
            setPhysicsBodyTransform(physicsWorld, handle.body, {
                x: p.x, y: enabled ? p.y : -50, z: p.z,
            }, identityQuat);
        },
    };
}
