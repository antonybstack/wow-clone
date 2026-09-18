/** Copy any animation from the source body into the equipment pack by name.
 * Used when only a clip was added (no geometry/bind change), so the heavy
 * Blender/equipment composition does not need to re-run. The equipment test
 * asserts both documents carry identical animation curves. */
import fs from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';

const SOURCE = process.env.BODY_SOURCE || 'public/ashen-reach/wanderer.glb';
const TARGET = process.env.BODY_TARGET || 'public/ashen-reach/wanderer-equipment.glb';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const source = await io.read(SOURCE);
const target = await io.read(TARGET);
const targetRoot = target.getRoot();
const targetNodes = new Map(targetRoot.listNodes().map(n => [n.getName(), n]));
const buffer = targetRoot.listBuffers()[0];
const have = new Set(targetRoot.listAnimations().map(a => a.getName()));
const copied = [];
for (const animation of source.getRoot().listAnimations()) {
    const name = animation.getName();
    if (have.has(name)) continue;
    for (const old of targetRoot.listAnimations().filter(a => a.getName() === name)) old.dispose();
    const next = target.createAnimation(name);
    const accessors = new Map();
    const copyAccessor = original => {
        if (!accessors.has(original)) accessors.set(original, target.createAccessor()
            .setType(original.getType()).setArray(original.getArray().slice()).setBuffer(buffer));
        return accessors.get(original);
    };
    for (const channel of animation.listChannels()) {
        const node = targetNodes.get(channel.getTargetNode().getName());
        if (!node) throw Error(`Missing target joint: ${channel.getTargetNode().getName()}`);
        const sourceSampler = channel.getSampler();
        const sampler = target.createAnimationSampler().setInterpolation(sourceSampler.getInterpolation())
            .setInput(copyAccessor(sourceSampler.getInput())).setOutput(copyAccessor(sourceSampler.getOutput()));
        next.addSampler(sampler);
        next.addChannel(target.createAnimationChannel().setTargetNode(node)
            .setTargetPath(channel.getTargetPath()).setSampler(sampler));
    }
    copied.push({name, channels: next.listChannels().length});
}
if (copied.length) await fs.writeFile(TARGET, await io.writeBinary(target));
console.log(JSON.stringify({copied, sourceAnimations: source.getRoot().listAnimations().length, targetAnimations: targetRoot.listAnimations().length}));
