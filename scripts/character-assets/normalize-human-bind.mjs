/** Restore the accepted Human joint order and mesh/palette frame after Blender.
 * Reuses the M006 adapter; this does not retarget animation or invent a new rig.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/loader-gltf/gltf-animation.ts
 */
import {mat4} from 'gl-matrix';
export function normalizeHumanBind(root, base, meshName='HumanV1Body', baseMeshName='HumanV1Body', {exactReference=false}={}) {
const skin = root.listSkins()[0], baseSkin = base.listSkins()[0];
if (!skin || !baseSkin || skin.listJoints().length !== 65 || baseSkin.listJoints().length !== 65) {
    throw Error('Old/bald and active Human must share a 65-joint skin');
}
const from = skin.listJoints(), to = baseSkin.listJoints();
const toIndex = new Map(to.map((joint, i) => [joint.getName(), i]));
const remap = from.map(joint => toIndex.get(joint.getName()));
if (remap.some(index => index === undefined) || new Set(remap).size !== 65) {
    throw Error('Old/bald skin changed the named Human joint set');
}
const oldBind = skin.getInverseBindMatrices().getArray();
const baseBind = baseSkin.getInverseBindMatrices().getArray();
const newBind = new Float32Array(oldBind.length);
for (let old = 0; old < from.length; old++) {
    const target = remap[old];
    for (let k = 0; k < 16; k++) {
        const value = oldBind[old * 16 + k], expected = baseBind[target * 16 + k];
        if (Math.abs(value - expected) / Math.max(1, Math.abs(expected)) > .002) {
            throw Error(`Old/bald inverse bind changed at ${from[old].getName()}[${k}]`);
        }
        newBind[target * 16 + k] = exactReference ? expected : value;
    }
}
// The streamed equipment path borrows the live body's palette by joint *index*.
// Blender preserves the named bones but exports them in a different order. Restore
// the active Human order and rewrite JOINTS_0 on every candidate mesh before
// putting this variant under that loader.
// https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
        const joints = prim.getAttribute('JOINTS_0');
        const weights = prim.getAttribute('WEIGHTS_0');
        if (!joints || !weights) throw Error(`Unskinned old/bald mesh: ${mesh.getName()}`);
        joints.setArray(Uint16Array.from(joints.getArray(), (index, i) => {
            if (remap[index] === undefined && weights.getArray()[i] > 0) {
                throw Error(`Unmapped weighted joint ${index} in ${mesh.getName()}`);
            }
            return remap[index] ?? 0;
        }));
    }
}
for (const joint of from) skin.removeJoint(joint);
for (const joint of to) {
    const matching = from.find(candidate => candidate.getName() === joint.getName());
    skin.addJoint(matching);
}
skin.getInverseBindMatrices().setArray(newBind);
if(exactReference){
    // A tolerated Blender round trip is suitable for an audition, but published
    // clothing borrows this palette by index. Copy native reference TRS/IBMs,
    // retaining hierarchy, geometry and every animation accessor unchanged.
    // https://gltf-transform.dev/modules/core/classes/Node
    const reference=new Map(base.listNodes().map(node=>[node.getName(),node]));
    const rig=new Set();
    for(const joint of skin.listJoints())for(let node=joint;node;node=node.getParentNode())rig.add(node);
    for(const node of rig){
        const ref=reference.get(node.getName());
        if(!ref||node.getParentNode()?.getName()!==ref.getParentNode()?.getName())
            throw Error(`Canonical Human rest ancestry differs at ${node.getName()}`);
        node.setTranslation(ref.getTranslation()).setRotation(ref.getRotation()).setScale(ref.getScale());
    }
}
// Blender also nests exported skinned meshes under the armature's 0.01 scale
// node. The active Human keeps its mesh at the scene root and only the joints
// under that node. Lite computes inverse(meshWorld) * jointWorld * IBM for each
// palette entry; retaining Blender's extra mesh parent made that palette 100x
// larger and sent every borrowed garment offscreen. Match the active frame.
// https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
const scene = root.listScenes()[0];
for (const node of root.listNodes().filter(candidate => candidate.getMesh())) {
    scene.addChild(node);
}
// Match the actual rest palette, not just the bind accessor: a parent frame can
// multiply the whole palette while every named IBM still appears to match.
// Lite's loader uses inverse(meshWorld) * jointWorld * IBM for each entry.
// https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/loader-gltf/gltf-animation.ts
function restPalette(docRoot, meshName) {
    const meshNode = docRoot.listNodes().find(node => node.getMesh()?.getName() === meshName);
    const meshSkin = meshNode?.getSkin();
    if (!meshSkin) throw Error(`Missing skinned mesh ${meshName}`);
    const inverseMesh = mat4.invert(mat4.create(), meshNode.getWorldMatrix());
    if (!inverseMesh) throw Error(`Singular mesh frame for ${meshName}`);
    const bind = meshSkin.getInverseBindMatrices().getArray();
    return meshSkin.listJoints().map((joint, i) => {
        const value = mat4.multiply(mat4.create(), inverseMesh, joint.getWorldMatrix());
        return Array.from(mat4.multiply(value, value, bind.subarray(i * 16, i * 16 + 16)));
    });
}
const basePalette = restPalette(base, baseMeshName);
const candidatePalette = restPalette(root, meshName);
for (let joint = 0; joint < 65; joint++) {
    for (let k = 0; k < 16; k++) {
        if (Math.abs(candidatePalette[joint][k] - basePalette[joint][k]) > .002) {
            throw Error(`Old/bald rest palette differs at joint ${joint}[${k}]`);
        }
    }
}
return {jointNames:to.map(joint=>joint.getName()), remappedJoints:remap.filter((index,old)=>index!==old).length};
}
