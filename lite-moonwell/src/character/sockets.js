/**
 * WoW-style item sockets on a Lite skeleton.
 * Bone is pure data (name + runtime _nodeIndex). Joints are excludedNodeIndices
 * (https://doc.babylonjs.com/lite/architecture/13-skeleton/): SceneNodes stay at
 * rest, so setParent(mesh, boneSceneNode) does not follow the clip.
 *
 * Lite skin: boneMatrix = invMeshWorld_load * jointWorld * IBM.
 * mesh-local joint = boneMatrix * inv(IBM). Runtime mesh world already includes
 * BodyRoot.scaling.x = -1 (glTF RH→LH). Capsule-local = inv(bodyWorld) * meshWorld
 * * meshLocal. Multiplying capsule X by signed scale.x un-mirrors the wrist and
 * parks the shaft as a lamp post on the empty side.
 *
 * Gear is NOT a second skeleton — attachments live on these sockets.
 */
import {
    bakeSkeleton,
    createTransformNode,
    getBoneByName,
    mat4Decompose,
    mat4Invert,
    mat4Multiply,
    mat4Translation,
    setParent,
} from "@babylonjs/lite";

export const SLOT_BONES = {
    head: ["mixamorig:Head", "Head", "head"],
    back: ["mixamorig:Spine2", "Spine2"],
    torso: ["mixamorig:Spine1", "mixamorig:Spine", "Spine1", "Spine"],
    mainHand: ["mixamorig:RightHand", "RightHand", "hand.R", "Hand_R"],
    offHand: ["mixamorig:LeftHand", "LeftHand", "hand.L", "Hand_L"],
    leftArm: ["mixamorig:LeftArm", "LeftArm", "upperarm.L"],
    rightArm: ["mixamorig:RightArm", "RightArm", "upperarm.R"],
    leftForeArm: ["mixamorig:LeftForeArm", "LeftForeArm", "forearm.L"],
    rightForeArm: ["mixamorig:RightForeArm", "RightForeArm", "forearm.R"],
    leftFoot: ["mixamorig:LeftFoot", "LeftFoot", "foot.L"],
    rightFoot: ["mixamorig:RightFoot", "RightFoot", "foot.R"],
};

/** Finger joint used to push the grip from the wrist into the palm. */
const PALM_BONES = {
    mainHand: ["mixamorig:RightHandMiddle1", "mixamorig:RightHandIndex1", "RightHandMiddle1"],
    offHand: ["mixamorig:LeftHandMiddle1", "mixamorig:LeftHandIndex1", "LeftHandMiddle1"],
};

/**
 * helm / back cape / tunic inherit joint rotation.
 * mainHand / offHand are grips: palm translation + **wrist rotation**.
 * Weapons follow the Mixamo hand. Per-item shaft aim lives in catalog.local —
 * a world-up slerp here is a lamp post.
 */
const FOLLOW = {
    head: "pose",
    back: "pose",
    torso: "pose",
    mainHand: "grip",
    offHand: "grip",
    leftArm: "pose",
    rightArm: "pose",
    leftForeArm: "pose",
    rightForeArm: "pose",
    leftFoot: "pose",
    rightFoot: "pose",
};

/** Wrist → knuckle blend for grip position. 0 = wrist, 1 = Middle1. */
const PALM_BLEND = 0.5;

/** Tiny palm push in the wrist's local space after pose (meters). */
const GRIP_LOCAL = {
    mainHand: { x: 0, y: 0.03, z: 0.015 },
    offHand: { x: 0, y: 0.03, z: 0.015 },
};

function quatRotate(qx, qy, qz, qw, vx, vy, vz) {
    const ux = qy * vz - qz * vy;
    const uy = qz * vx - qx * vz;
    const uz = qx * vy - qy * vx;
    return {
        x: vx + 2 * (qw * ux + qy * uz - qz * uy),
        y: vy + 2 * (qw * uy + qz * ux - qx * uz),
        z: vz + 2 * (qw * uz + qx * uy - qy * ux),
    };
}

export function resolveBone(skeleton, names) {
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
        return lower.some((token) => name === token || name.endsWith(token));
    });
}

function skinBinding(groups) {
    for (const group of groups ?? []) {
        const skins = group._gltfMixer?.[2];
        if (skins?.[0]?.boneMatrices && skins[0].inverseBindMatrices) {
            return skins[0];
        }
    }
    return null;
}

function jointIndex(binding, nodeIndex) {
    const joints = binding?.jointNodes;
    if (!joints) {
        return -1;
    }
    for (let i = 0; i < joints.length; i++) {
        if (joints[i] === nodeIndex) {
            return i;
        }
    }
    return -1;
}

function findSkinnedMesh(root) {
    const stack = [root];
    while (stack.length) {
        const node = stack.pop();
        if (node?.skeleton?.boneMatrices && node.worldMatrix) {
            return node;
        }
        const kids = node?.children;
        if (kids) {
            for (let i = 0; i < kids.length; i++) {
                stack.push(kids[i]);
            }
        }
    }
    return null;
}

/** Mesh-local joint: boneMatrix * inv(IBM) = invMeshWorld_load * jointWorld. */
function jointMeshLocal(binding, bone) {
    const nodeIndex = bone?._nodeIndex;
    if (nodeIndex === undefined || !binding) {
        return null;
    }
    const bi = jointIndex(binding, nodeIndex);
    if (bi < 0) {
        return null;
    }
    const boneMat = binding.boneMatrices.subarray(bi * 16, bi * 16 + 16);
    const ibm = binding.inverseBindMatrices.subarray(bi * 16, bi * 16 + 16);
    const invIbm = mat4Invert(ibm);
    if (!invIbm) {
        return null;
    }
    return mat4Multiply(boneMat, invIbm);
}

/**
 * Animation-space joint (RH_TO_LH already applied). Used only if the skinned
 * mesh world is missing.
 */
export function jointWorldMatrix(groups, bone) {
    const nodeIndex = bone?._nodeIndex;
    if (nodeIndex === undefined) {
        return null;
    }
    const binding = skinBinding(groups);
    const meshLocal = jointMeshLocal(binding, bone);
    if (meshLocal && binding?.invMeshWorld) {
        const meshWorldLoad = mat4Invert(binding.invMeshWorld);
        if (meshWorldLoad) {
            return mat4Multiply(meshWorldLoad, meshLocal);
        }
    }
    for (const group of groups ?? []) {
        if (!group.isPlaying || group.weight < 0.95) {
            continue;
        }
        const wm = group._ctrl?._debugWorldMat;
        if (wm && wm.length >= (nodeIndex + 1) * 16) {
            return wm.subarray(nodeIndex * 16, nodeIndex * 16 + 16);
        }
    }
    return null;
}

/**
 * @param {import("@babylonjs/lite").EngineContext} engine
 * @param {import("@babylonjs/lite").SceneContext} scene
 * @param {{ body: object, capsuleHeight: number }} player
 * @param {{ skeleton?: object, root?: object, animationGroups?: object[] }} body
 */
export function attachSockets(engine, scene, player, body) {
    const skeleton = body?.skeleton;
    const groups = body?.animationGroups ?? [];
    if (skeleton) {
        bakeSkeleton(skeleton);
    }

    const feet = mat4Translation(0, -(player.capsuleHeight ?? 1.55) * 0.5, 0);
    const skinned = findSkinnedMesh(body.root);
    const sockets = {};

    for (const [slot, names] of Object.entries(SLOT_BONES)) {
        const bone = resolveBone(skeleton, names);
        const palm = PALM_BONES[slot] ? resolveBone(skeleton, PALM_BONES[slot]) : undefined;
        const node = createTransformNode(`${slot}Socket`);
        setParent(node, player.body);
        sockets[slot] = {
            slot,
            bone,
            palm,
            node,
            follow: FOLLOW[slot] || "pose",
        };
    }

    const toCapsule = (bone) => {
        const binding = skinBinding(groups);
        const meshLocal = jointMeshLocal(binding, bone);
        const meshWorld = skinned?.worldMatrix;
        const bodyWorld = player.body?.worldMatrix;
        const invBody = bodyWorld ? mat4Invert(bodyWorld) : null;
        if (meshLocal && meshWorld && invBody) {
            const world = mat4Multiply(meshWorld, meshLocal);
            const local = mat4Multiply(invBody, world);
            const d = mat4Decompose(local);
            return { x: d.translation.x, y: d.translation.y, z: d.translation.z, r: d.rotation };
        }
        const joint = jointWorldMatrix(groups, bone);
        if (!joint) {
            return null;
        }
        // Fallback: animation joint already has RH_TO_LH. Scale by |root|, never signed x.
        const h = Math.abs(body.root?.scaling?.y ?? 1);
        const feetY = -(player.capsuleHeight ?? 1.55) * 0.5;
        const d = mat4Decompose(mat4Multiply(feet, joint));
        return {
            x: d.translation.x * h,
            y: feetY + (d.translation.y - feetY) * h,
            z: d.translation.z * h,
            r: d.rotation,
        };
    };

    const sync = () => {
        const h = Math.abs(body.root?.scaling?.y ?? 1);
        for (const sock of Object.values(sockets)) {
            const wrist = toCapsule(sock.bone);
            if (!wrist) {
                continue;
            }
            let px = wrist.x;
            let py = wrist.y;
            let pz = wrist.z;
            let rx = wrist.r.x;
            let ry = wrist.r.y;
            let rz = wrist.r.z;
            let rw = wrist.r.w;
            if (sock.follow === "grip") {
                if (sock.palm) {
                    const finger = toCapsule(sock.palm);
                    if (finger) {
                        const t = PALM_BLEND;
                        px = wrist.x + (finger.x - wrist.x) * t;
                        py = wrist.y + (finger.y - wrist.y) * t;
                        pz = wrist.z + (finger.z - wrist.z) * t;
                    }
                }
                const local = GRIP_LOCAL[sock.slot];
                if (local) {
                    const d = quatRotate(rx, ry, rz, rw, local.x, local.y, local.z);
                    px += d.x;
                    py += d.y;
                    pz += d.z;
                }
            }
            sock.node.position.set(px, py, pz);
            sock.node.rotationQuaternion.set(rx, ry, rz, rw);
            sock.node.scaling.set(h, h, h);
        }
    };
    sync();

    console.log("sockets", Object.fromEntries(
        Object.entries(sockets).map(([slot, sock]) => [slot, sock.bone?.name ?? null]),
    ), "skinned", skinned?.name ?? null);

    return {
        skeleton,
        sockets,
        head: sockets.head?.bone,
        rightHand: sockets.mainHand?.bone,
        bind: "mesh-local * runtime mesh world (BodyRoot.scaling.x = -1)",
        skinned,
        sync,
        toCapsule,
    };
}
