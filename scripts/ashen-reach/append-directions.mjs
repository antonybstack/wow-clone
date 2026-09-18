/** Offline adapter around the MIT BJS retargeter; never imported by the game. */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {mat4, vec3} from 'gl-matrix';
import {mergeGLBs} from '../vendor/bjs-retarget/merge_api.mjs';

const SOURCE_URL = 'https://cdn.tosijs.net/quaternius/UAL1_core.glb';
const SOURCE_SHA = '8cfeaffa72992985e7104140e1f9eaf330fb419a025fdcb2cc376a4e5b825005';
const SOURCE_PATH = '.cache/animation-research/UAL1_core.glb';
const NAMES = ['Jog_Bwd_Loop', 'Jog_Left_Loop', 'Jog_Right_Loop', 'Turn90_L', 'Turn90_R'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export async function appendDirections(bodyPath = 'public/ashen-reach/wanderer.glb') {
    await fs.mkdir('.cache/animation-research', {recursive: true});
    try { await fs.access(SOURCE_PATH); } catch {
        execFileSync('curl', ['--fail', '--location', '--silent', '--show-error', '--max-time', '60', SOURCE_URL, '-o', SOURCE_PATH]);
    }
    const bytes = await fs.readFile(SOURCE_PATH);
    if (sha(bytes) !== SOURCE_SHA) throw Error('Directional source changed; audit it before updating its pinned hash.');
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const source = await io.readBinary(bytes);
    for (const animation of source.getRoot().listAnimations()) {
        if (!NAMES.includes(animation.getName()) && animation.getName() !== 'A_TPose') {
            animation.dispose(); continue;
        }
        // In-place gameplay: root displacement/yaw belongs to Havok. Keep
        // the coordinate parent rest transform for the upstream retargeter.
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
    const sourcePelvis = source.getRoot().listNodes().find(n => n.getName() === 'pelvis');
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
        if (!original || original.listChannels().length !== 53) throw Error(`Incomplete retarget: ${name}`);
        for (const old of root.listAnimations().filter(a => a.getName() === name)) old.dispose();
        const animation = body.createAnimation(name);
        for (const channel of original.listChannels()) {
            const node = nodes.get(channel.getTargetNode().getName());
            if (!node) throw Error(`Missing target joint: ${channel.getTargetNode().getName()}`);
            const sourceSampler = channel.getSampler();
            const sampler = body.createAnimationSampler().setInterpolation(sourceSampler.getInterpolation())
                .setInput(copyAccessor(sourceSampler.getInput())).setOutput(copyAccessor(sourceSampler.getOutput()));
            if (node === targetPelvis && channel.getTargetPath() === 'translation') {
                // The upstream utility normalizes its output hierarchy. We
                // preserve ours (.01 parent / centimetre joints), so convert
                // source pelvis displacement through the ORIGINAL parent
                // matrices rather than copying normalized translation values.
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
    const provenance = {
        sourceURL: SOURCE_URL, sourceSha256: SOURCE_SHA,
        assetAuthor: 'Quaternius', assetLicense: 'CC0-1.0',
        licenseSource: 'https://quaternius.itch.io/universal-animation-library',
        distributionReference: 'https://3d.tosijs.net/CHANGELOG/',
        retargeter: 'https://github.com/crazyramirez/BJS_Character_Controller_V2',
        retargeterCommit: '869170ff94380b44b6f76753feee77c17c468819',
        retargeterLicense: 'MIT', outputSha256: sha(output), inventory,
        scope: 'Ashen Reach source-compatible Human only. Original geometry, bind and 45 clips retained.',
    };
    await fs.writeFile('public/ashen-reach/animation-provenance.json', JSON.stringify(provenance, null, 2) + '\n');
    console.log(`Imported ${inventory.length} authored directional/turn clips into ${bodyPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await appendDirections();
