/** Read the Blender-baked two-handed carry pose from the exported GLB and write
 * the runtime pose file. Blender's exporter performs the bone-space -> glTF node
 * conversion, so these node locals can be applied directly with setBonePoseDeferred. */
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import fs from 'node:fs/promises';

const GLB = process.env.TWO_HAND_GLB || '.cache/two-hand/two-hand-carry.glb';
const OUT = process.env.TWO_HAND_OUT || 'src/character/runtime/two-hand-carry-pose.json';
const NAMES = ['mixamorig:LeftShoulder', 'mixamorig:LeftArm', 'mixamorig:LeftForeArm', 'mixamorig:LeftHand',
    'mixamorig:RightShoulder', 'mixamorig:RightArm', 'mixamorig:RightForeArm', 'mixamorig:RightHand'];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(GLB);
const nodes = new Map(doc.getRoot().listNodes().map(n => [n.getName(), n]));
const armish = doc.getRoot().listNodes().map(n => n.getName()).filter(n => /Arm|Shoulder|Hand/.test(n));
const bones = NAMES.map(name => {
    const node = nodes.get(name);
    if (!node) return { name, missing: true };
    return {
        name,
        parent: node.getParentNode()?.getName() ?? null,
        translation: node.getTranslation().map(v => +v.toFixed(6)),
        rotation: node.getRotation().map(v => +v.toFixed(6)),
    };
});
const missing = bones.filter(b => b.missing);
await fs.writeFile(OUT, JSON.stringify({ source: 'Blender IK carry pose (blender-author-two-hand.py -> GLB export)', bones }, null, 2));
console.log(JSON.stringify({ armish, bones }, null, 2));
if (missing.length) { console.error('MISSING BONES', missing.map(b => b.name)); process.exit(1); }
