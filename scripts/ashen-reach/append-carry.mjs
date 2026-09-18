/** Retarget Quaternius UAL2 `Walk_Carry_Loop` (CC0) onto the Ashen source rig with
 * the vendored MIT retargeter. Offline adapter; never imported by the game.
 *
 * This reuses the existing animation pipeline instead of authoring a carry pose
 * by hand. See docs/ashen-equipment-authoring.md and the animation provenance.
 */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {mat4, vec3} from 'gl-matrix';
import {mergeGLBs} from '../vendor/bjs-retarget/merge_api.mjs';

const SOURCE_URL = 'https://opengameart.org/sites/default/files/universal_animation_library_2standard.zip';
const SOURCE_SHA = '0815dd05531cae9bc313fc9c0ba81330bc72f8e19ec45f73738e74ddc5796a43';
const SOURCE_PATH = '.cache/animation-research/ual2/UAL2_Standard.glb';
const NAMES = ['Walk_Carry_Loop'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export async function appendCarry(bodyPath = 'public/ashen-reach/wanderer.glb') {
    try { await fs.access(SOURCE_PATH); } catch {
        throw Error(`Missing ${SOURCE_PATH}. Download ${SOURCE_URL} and extract Unreal-Godot/UAL2_Standard.glb there.`);
    }
    const bytes = await fs.readFile(SOURCE_PATH);
    if (sha(bytes) !== SOURCE_SHA) throw Error('UAL2 source changed; audit it before updating its pinned hash.');
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const source = await io.readBinary(bytes);
    for (const animation of source.getRoot().listAnimations()) {
        if (!NAMES.includes(animation.getName()) && animation.getName() !== 'A_TPose') {
            animation.dispose(); continue;
        }
        // In-place gameplay: root displacement/yaw belongs to Havok. Keep the
        // coordinate parent rest transform for the upstream retargeter.
        for (const channel of animation.listChannels()) {
            if (channel.getTargetNode().getName() === 'root') channel.dispose();
        }
    }
    const coordinateRoot = source.getRoot().listNodes().find(n => n.getName() === 'root');
    if (!coordinateRoot) throw Error('Missing source coordinate parent');
    coordinateRoot.setName('SourceCoordinateFrame'); // Do not alias root to pelvis.
    const bodyBytes = await fs.readFile(bodyPath);
    const result = await io.readBinary(await mergeGLBs(bodyBytes, await io.writeBinary(source), {
        removeExistingAnimations: true, COMPRESS_OUTPUT: false, AUTO_APOSE_CORRECTION: false,
    }));
    // Retain the original mesh, bind, materials and all existing animation
    // curves. Import only the retargeted channels into the untouched document.
    const body = await io.readBinary(bodyBytes), root = body.getRoot();
    const nodes = new Map(root.listNodes().map(n => [n.getName(), n]));
    const sourcePelvis = source.getRoot().listNodes().find(n => n.getName() === 'pelvis') || source.getRoot().listNodes().find(n => n.getName() === 'SourceCoordinateFrame').listChildren()[0];
    const targetPelvis = nodes.get('mixamorig:Hips');
    const sourceFrame = sourcePelvis.getParentNode().getWorldMatrix();
    const targetFrameInverse = mat4.invert(mat4.create(), targetPelvis.getParentNode().getWorldMatrix());
    const sourceRestWorld = sourcePelvis.getWorldTranslation();
    const targetRestWorld = targetPelvis.getWorldTranslation();
    const accessors = new Map();
    const copyAccessor = original => {
        if (!accessors.has(original)) accessors.set(original, body.createAccessor()
            .setType(original.getType()).setArray(original.getArray().slice()).setBuffer(root.listBuffers()[0]));
        return accessors.get(original);
    };
    const inventory = [];
    for (const name of NAMES) {
        const original = result.getRoot().listAnimations().find(a => a.getName() === name);
        if (!original) throw Error(`Missing retarget: ${name}`);
        for (const old of root.listAnimations().filter(a => a.getName() === name)) old.dispose();
        const animation = body.createAnimation(name);
        for (const channel of original.listChannels()) {
            const node = nodes.get(channel.getTargetNode().getName());
            if (!node) throw Error(`Missing target joint: ${channel.getTargetNode().getName()}`);
            const sourceSampler = channel.getSampler();
            const sampler = body.createAnimationSampler().setInterpolation(sourceSampler.getInterpolation())
                .setInput(copyAccessor(sourceSampler.getInput())).setOutput(copyAccessor(sourceSampler.getOutput()));
            if (node === targetPelvis && channel.getTargetPath() === 'translation') {
                const originalTrack = source.getRoot().listAnimations().find(a => a.getName() === name)
                    .listChannels().find(c => c.getTargetNode() === sourcePelvis && c.getTargetPath() === 'translation');
                if (!originalTrack) throw Error(`Missing source pelvis displacement: ${name}`);
                const track = originalTrack.getSampler(), data = track.getOutput().getArray();
                const converted = new Float32Array(data.length), point = vec3.create();
                for (let i = 0; i < data.length; i += 3) {
                    vec3.transformMat4(point, data.subarray(i, i + 3), sourceFrame);
                    vec3.sub(point, point, sourceRestWorld);
                    vec3.add(point, point, targetRestWorld);
                    vec3.transformMat4(point, point, targetFrameInverse);
                    converted.set(point, i);
                }
                sampler.setInput(copyAccessor(track.getInput())).setInterpolation(track.getInterpolation());
                sampler.setOutput(body.createAccessor().setType('VEC3').setArray(converted).setBuffer(root.listBuffers()[0]));
            }
            animation.addSampler(sampler);
            animation.addChannel(body.createAnimationChannel().setTargetNode(node)
                .setTargetPath(channel.getTargetPath()).setSampler(sampler));
        }
        inventory.push({name, channels: animation.listChannels().length});
    }
    const output = await io.writeBinary(body);
    await fs.writeFile(bodyPath, output);
    let provenance = {};
    try { provenance = JSON.parse(await fs.readFile('public/ashen-reach/animation-provenance.json', 'utf8')); } catch { /* first run */ }
    provenance.carry = {
        sourceURL: SOURCE_URL, sourceSha256: SOURCE_SHA, clip: NAMES[0],
        assetAuthor: 'Quaternius', assetLicense: 'CC0-1.0',
        licenseSource: 'https://quaternius.com/packs/universalanimationlibrary2.html',
        retargeter: 'https://github.com/crazyramirez/BJS_Character_Controller_V2',
        retargeterCommit: '869170ff94380b44b6f76753feee77c17c468819',
        retargeterLicense: 'MIT', outputSha256: sha(output), inventory,
        scope: 'Ashen Reach source-compatible Human only. Original geometry, bind and clips retained.',
    };
    await fs.writeFile('public/ashen-reach/animation-provenance.json', JSON.stringify(provenance, null, 2) + '\n');
    console.log(`Imported ${JSON.stringify(inventory)} into ${bodyPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await appendCarry();
