/**
 * Training dummy — unmoving hostile. Positions from Dummy* world translation.
 * DummyYard is the pad, not a unit. NpcGreeter is not collected (not hostile).
 */

const NAME = "Training Dummy";

function isDummyMeshName(name) {
    const n = name || "";
    return n === "Dummy" || n.startsWith("Dummy.") || n.startsWith("Dummy_");
}

function dummyId(name) {
    return (name || "Dummy").replace(/[._]primitive.*$/i, "").replace(/\.\d+$/, "") || "Dummy";
}

function writeTranslation(mesh, out) {
    const m = mesh?.worldMatrix;
    if (m && m.length >= 16) {
        out.x = m[12];
        out.y = m[13];
        out.z = m[14];
        return;
    }
    const p = mesh?.position;
    if (p) {
        out.x = p.x ?? 0;
        out.y = p.y ?? 0;
        out.z = p.z ?? 0;
    }
}

/** Straw/burlap sack — drop the picnic gingham if ClothSack is still on the dummy. */
function retintCloth(mesh) {
    const mat = mesh.material;
    if (!mat) {
        return;
    }
    const name = mat.name || "";
    if (name !== "ClothSack") {
        return;
    }
    mat.baseColorFactor = [0.62, 0.47, 0.26, 1];
    mat.baseColorTexture = undefined;
    mat.metallicFactor = 0;
    mat.roughnessFactor = 0.9;
}

/**
 * @param {{ meshes?: { name?: string, worldMatrix?: ArrayLike<number>, position?: { x:number, y:number, z:number }, material?: object }[] }} scene
 */
export function collectDummies(scene) {
    const groups = new Map();
    for (const mesh of scene.meshes ?? []) {
        if (!isDummyMeshName(mesh.name)) {
            continue;
        }
        retintCloth(mesh);
        const id = dummyId(mesh.name);
        let dummy = groups.get(id);
        if (!dummy) {
            dummy = {
                id,
                name: NAME,
                hostile: true,
                position: { x: 0, y: 0, z: 0 },
                hp: 10000,
                hpMax: 10000,
                hits: 0,
                mesh,
                meshes: [],
            };
            groups.set(id, dummy);
        }
        dummy.meshes.push(mesh);
        dummy.mesh = dummy.mesh || mesh;
    }
    const list = [...groups.values()];
    for (const dummy of list) {
        syncDummy(dummy);
    }
    return list;
}

export function syncDummy(dummy) {
    writeTranslation(dummy.mesh, dummy.position);
}

export function syncDummies(list) {
    for (let i = 0; i < list.length; i++) {
        syncDummy(list[i]);
    }
}
