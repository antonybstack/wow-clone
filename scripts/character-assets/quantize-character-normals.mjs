import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PropertyType} from '@gltf-transform/core';
import {prune, quantize} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';
import {identityAnimationHash,identityGeometryHash} from './human-identity-proof.mjs';
import {COMPACT_NORMAL_TOLERANCE} from './compact-normal-policy.mjs';

const normalSemantic = /^(NORMAL|TANGENT)$/;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const elements = accessor => Array.from({length: accessor.getCount()}, (_, i) => accessor.getElement(i, []));

/** Snapshot rendered triangles rather than unused accessor entries: native quantize
 * may compact a sparse coverage primitive even with cleanup:false. Source triangle
 * order stays fixed; meshopt may rotate the three corners during serialization.
 * https://gltf-transform.dev/modules/functions/functions/quantize
 * https://github.com/zeux/meshoptimizer/blob/v0.22/README.md#lossless-index-buffer-compression
 */
export function characterNormalProof(root, {animationNames = null} = {}) {
    const nodes = root.listNodes(), skins = root.listSkins();
    return {
        animation: identityAnimationHash(root, {names: animationNames}),
        rig: hash({
            nodes: nodes.map(node => ({name: node.getName(), matrix: node.getMatrix(),
                children: node.listChildren().map(child => nodes.indexOf(child)),
                skin: skins.indexOf(node.getSkin()), mesh: root.listMeshes().indexOf(node.getMesh())})),
            skins: skins.map(skin => ({name: skin.getName(), joints: skin.listJoints().map(node => nodes.indexOf(node)),
                binds: skin.getInverseBindMatrices() ? elements(skin.getInverseBindMatrices()) : null})),
        }),
        textures: root.listTextures().map(texture => hash([texture.getName(), texture.getMimeType(),
            createHash('sha256').update(texture.getImage() ?? new Uint8Array()).digest('hex')])),
        meshes: root.listMeshes().map(mesh => ({name: mesh.getName(), weights: [...mesh.getWeights()], extras: structuredClone(mesh.getExtras()),
            primitives: mesh.listPrimitives().map(primitive => {
                assert.equal(primitive.getMode(), 4, 'Normal packing currently requires triangle primitives');
                const attributes = [primitive, ...primitive.listTargets()];
                const count = primitive.getAttribute('POSITION').getCount();
                const vertices = Array.from({length: count}, (_, index) => {
                    const exact = [], normals = [];
                    for (const [target, owner] of attributes.entries()) for (const semantic of owner.listSemantics().sort()) {
                        const value = owner.getAttribute(semantic).getElement(index, []);
                        if (normalSemantic.test(semantic)) {
                            assert(value.every(Number.isFinite), `${mesh.getName()}/${target}/${semantic}: non-finite normal`);
                            normals.push([target, semantic, value]);
                        } else exact.push([target, semantic, value]);
                    }
                    return {exact: JSON.stringify(exact), normals};
                });
                const indices = primitive.getIndices() ? Array.from(primitive.getIndices().getArray()) : vertices.map((_, i) => i);
                assert.equal(indices.length % 3, 0);
                return {material: primitive.getMaterial()?.getName(), vertices, indices};
            }),
        })),
    };
}

/** Verify the complete rendered surface, including coverage pieces and morph
 * offsets, while allowing only bounded normal/tangent component rounding.
 */
export function assertCharacterNormalProof(before, after, maxError = 0.00002) {
    assert.equal(after.animation, before.animation, 'Normal packing changed animation samples');
    assert.equal(after.rig, before.rig, 'Normal packing changed rig/bind/node transforms');
    assert.deepEqual(after.textures, before.textures, 'Normal packing changed textures');
    assert.equal(after.meshes.length, before.meshes.length);
    let measuredMaxError = 0, renderedCorners = 0;
    for (let m = 0; m < before.meshes.length; m++) {
        const a = before.meshes[m], b = after.meshes[m];
        assert.deepEqual([b.name, b.weights, b.extras, b.primitives.length], [a.name, a.weights, a.extras, a.primitives.length]);
        for (let p = 0; p < a.primitives.length; p++) {
            const x = a.primitives[p], y = b.primitives[p];
            assert.equal(y.material, x.material);
            assert.equal(y.indices.length, x.indices.length, `${a.name}: triangle count changed`);
            for (let t = 0; t < x.indices.length; t += 3) {
                let matched = false;
                for (let rotation = 0; rotation < 3 && !matched; rotation++) {
                    let error = 0, exact = true;
                    for (let corner = 0; corner < 3 && exact; corner++) {
                        const u = x.vertices[x.indices[t + corner]], v = y.vertices[y.indices[t + (corner + rotation) % 3]];
                        if (!v || u.exact !== v.exact || u.normals.length !== v.normals.length) {exact = false; break;}
                        for (let n = 0; n < u.normals.length; n++) {
                            const [target, semantic, source] = u.normals[n], [otherTarget, otherSemantic, value] = v.normals[n];
                            if (target !== otherTarget || semantic !== otherSemantic || source.length !== value.length) {exact = false; break;}
                            for (let c = 0; c < source.length; c++) error = Math.max(error, Math.abs(source[c] - value[c]));
                        }
                    }
                    if (exact && error <= maxError) {matched = true; measuredMaxError = Math.max(measuredMaxError, error);}
                }
                assert(matched, `${a.name}/${p} triangle ${t / 3}: surface changed beyond normal tolerance`);
                renderedCorners += 3;
            }
        }
    }
    return {maxComponentError: measuredMaxError, renderedCorners};
}

/** Native 16-bit packing, with no position/UV/weight quantization or curve edits.
 * Explicitly disable weight normalization: quantize otherwise sorts/renormalizes
 * weights even when they are excluded by the attribute pattern. Keep named body
 * coverage pieces and let the existing loader dequantize after meshopt.
 * https://gltf-transform.dev/modules/functions/functions/quantize
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/loader-gltf/gltf-ext-quantization.ts
 */
export async function quantizeCharacterNormals(document, {method = 'fixed16'} = {}) {
    assert(['fixed16', 'exp16'].includes(method), 'Unknown normal packing method');
    const before = characterNormalProof(document.getRoot());
    const sourceGeometrySha256 = identityGeometryHash(document.getRoot());
    const maxError = method === 'fixed16' ? 0.00002 : COMPACT_NORMAL_TOLERANCE;
    if (method === 'fixed16') {
        for (const mesh of before.meshes) for (const primitive of mesh.primitives) for (const vertex of primitive.vertices)
            for (const [target, semantic, value] of vertex.normals)
                assert(value.every(v => v >= -1 && v <= 1), `${mesh.name}/${target}/${semantic}: values outside quantized range`);
        await document.transform(quantize({pattern: normalSemantic, patternTargets: normalSemantic,
            quantizeNormal: 16, normalizeWeights: false, cleanup: false}));
    } else {
        // Morph normal deltas can exceed [-1,1]. Meshopt's exponential filter
        // rounds floating vectors without clamping or normalizing them. Decode
        // offline back to Float32, so the existing lossless GLB pack/runtime
        // path stays unchanged. Never apply this filter to animation or binds.
        // https://github.com/zeux/meshoptimizer/blob/v0.22/js/README.md#encoder
        await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
        const packed = new Map();
        for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives())
            for (const owner of [primitive, ...primitive.listTargets()]) for (const semantic of owner.listSemantics()) {
                if (!normalSemantic.test(semantic)) continue;
                const source = owner.getAttribute(semantic);
                if (!packed.has(source)) {
                    assert(source.getArray() instanceof Float32Array && !source.getNormalized(), 'Expected source Float32 normals');
                    const count = source.getCount(), stride = source.getElementSize() * 4;
                    const filtered = MeshoptEncoder.encodeFilterExp(source.getArray(), count, stride, 16, 'SharedVector');
                    const encoded = MeshoptEncoder.encodeGltfBuffer(filtered, count, stride, 'ATTRIBUTES');
                    const decoded = new Uint8Array(count * stride);
                    MeshoptDecoder.decodeGltfBuffer(decoded, count, stride, encoded, 'ATTRIBUTES', 'EXPONENTIAL');
                    // Clone: an accessor shared with a non-normal semantic or a
                    // sampler must retain its original values and ownership.
                    packed.set(source, source.clone().setArray(new Float32Array(decoded.buffer)));
                }
                owner.setAttribute(semantic, packed.get(source));
            }
    }
    // Authoring can leave detached morph targets holding the replaced normals.
    // Native tree-shaking must visit those targets before their accessors, or the
    // writer serializes both old and rounded buffers. Keep every live attribute.
    // https://gltf-transform.dev/modules/functions/functions/prune
    await document.transform(prune({propertyTypes: [PropertyType.PRIMITIVE, PropertyType.PRIMITIVE_TARGET, PropertyType.ACCESSOR, PropertyType.BUFFER],
        keepAttributes: true, keepExtras: true}));
    const measured = assertCharacterNormalProof(before, characterNormalProof(document.getRoot()), maxError);
    return {before, measured, maxError, method, sourceGeometrySha256};
}
