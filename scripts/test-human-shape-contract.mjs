/** M004 Human shape family: contract behaviour and the candidate asset's structure.
 *
 * The asset cases are skipped with an explicit message when the candidate has not been
 * built, because it is a developer artifact under .cache/ and is deliberately not committed.
 * Build it with `node scripts/character-assets/build-human-shape-family.mjs`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {
    HUMAN_HEIGHT,
    HUMAN_SHAPE_ASSET,
    HUMAN_SHAPE_CAPABILITIES,
    HUMAN_SHAPE_FIT,
    HUMAN_SHAPE_NAMES,
    HUMAN_SHAPE_TARGETS,
    clampHeightScale,
    humanCapsuleHeightM,
    humanShapeWeights,
    humanVisualHeightM,
    resolveHumanShape,
} from '../src/character/runtime/human-shape.js';

const CANDIDATE = '.cache/character-mmo/m004/human-shape-family-v1.glb';
const REPORT = 'docs/baselines/character-mmo/m004/shape-family.json';

test('the default route asks for no shape at all', () => {
    assert.equal(resolveHumanShape(''), null);
    assert.equal(resolveHumanShape('?play&clean'), null);
    assert.equal(resolveHumanShape('?play&clean&noEnemies&pixelRatio=1'), null);
});

test('named shapes resolve to the target order the GLB declares', () => {
    assert.deepEqual(HUMAN_SHAPE_TARGETS, ['slender', 'stout']);
    assert.deepEqual(HUMAN_SHAPE_NAMES, ['neutral', 'slender', 'stout']);
    assert.deepEqual(humanShapeWeights('neutral'), [0, 0]);
    assert.deepEqual(humanShapeWeights('slender'), [1, 0]);
    assert.deepEqual(humanShapeWeights('stout'), [0, 1]);
    assert.deepEqual(humanShapeWeights({stout: 0.25}), [0, 0.25]);
});

test('neutral needs no candidate asset, a driven target does', () => {
    assert.equal(resolveHumanShape('?humanShape=neutral').assetURL, null);
    assert.equal(resolveHumanShape('?humanHeight=1.1').assetURL, null);
    assert.equal(resolveHumanShape('?humanShape=stout').assetURL, HUMAN_SHAPE_ASSET);
    assert.equal(resolveHumanShape('?humanShape=slender:0.2').assetURL, HUMAN_SHAPE_ASSET);
    assert.equal(resolveHumanShape('?humanShape=slender:0').assetURL, null);
});

test('unknown shapes and out-of-range controls are rejected, not coerced', () => {
    assert.throws(() => resolveHumanShape('?humanShape=huge'), /Unknown Human shape/);
    assert.throws(() => resolveHumanShape('?humanShape=muscle:1'), /Unknown Human shape control/);
    assert.throws(() => resolveHumanShape('?humanShape=stout:1.5'), /within 0\.\.1/);
    assert.throws(() => resolveHumanShape('?humanShape=stout:-1'), /within 0\.\.1/);
    assert.throws(() => resolveHumanShape('?humanShape=stout:abc'), /within 0\.\.1/);
});

test('height is clamped to the range the gameplay capsule already accepts', () => {
    // player.setHeightScale clamps to the same [0.9, 1.15]; a request outside it is
    // reported as clamped rather than silently honoured by one system and not the other.
    assert.equal(clampHeightScale(2), HUMAN_HEIGHT.max);
    assert.equal(clampHeightScale(0.1), HUMAN_HEIGHT.min);
    assert.equal(clampHeightScale('nonsense'), HUMAN_HEIGHT.default);
    const tall = resolveHumanShape('?humanHeight=3');
    assert.equal(tall.heightScale, HUMAN_HEIGHT.max);
    assert.equal(tall.heightClamped, true);
    assert.equal(resolveHumanShape('?humanHeight=1.1').heightClamped, false);
    assert.equal(Number(humanVisualHeightM(1).toFixed(3)), 1.76);
    assert.equal(Number(humanVisualHeightM(HUMAN_HEIGHT.min).toFixed(3)), 1.584);
    assert.equal(Number(humanVisualHeightM(HUMAN_HEIGHT.max).toFixed(3)), 2.024);
    assert.equal(Number(humanCapsuleHeightM(HUMAN_HEIGHT.min).toFixed(4)), 1.5732);
    assert.equal(Number(humanCapsuleHeightM(HUMAN_HEIGHT.max).toFixed(4)), 2.0102);
});

test('capabilities advertise only what M004 actually delivered', () => {
    assert.equal(HUMAN_SHAPE_CAPABILITIES.fit, HUMAN_SHAPE_FIT);
    assert.deepEqual(HUMAN_SHAPE_CAPABILITIES.bodyShapes, HUMAN_SHAPE_NAMES);
    // Everything below is unproven and must stay false until its own milestone. Garment
    // fit is the exception: M005 built it as a developer candidate, so it advertises
    // 'candidate' rather than true, which no shipped route may read as a supported control.
    assert.equal(HUMAN_SHAPE_CAPABILITIES.garmentsFollowShape, 'candidate');
    assert.equal(HUMAN_SHAPE_CAPABILITIES.faceOrAge, false);
    assert.equal(HUMAN_SHAPE_CAPABILITIES.hair, false);
    assert.equal(HUMAN_SHAPE_CAPABILITIES.dyes, false);
    assert.equal(HUMAN_SHAPE_CAPABILITIES.crowdTiers, false);
    assert.equal(HUMAN_SHAPE_CAPABILITIES.appearanceRecipeField, null);
});

test('the historical M002 schema retains its empty shape capability', async () => {
    const {APPEARANCE_V1_REGISTRY:APPEARANCE_REGISTRY} = await import('../src/character/appearance/contract.js');
    // M004 is a candidate, not a shipped control. Extending schema 1 needs the migration
    // fixtures M006 owns; a silent new field would break every stored recipe's meaning.
    for (const profile of Object.values(APPEARANCE_REGISTRY.profiles ?? APPEARANCE_REGISTRY)) {
        if (!profile || typeof profile !== 'object' || !profile.capabilities) continue;
        assert.deepEqual([...profile.capabilities.shape], [],
            `${profile.race ?? '?'} must not advertise a shape capability before M006 migrates the schema`);
    }
});

const built = fs.existsSync(CANDIDATE) && fs.existsSync(REPORT);
test('the built candidate keeps the shipped body identical at weight zero', {skip: built ? false : `build ${CANDIDATE} first`}, () => {
    const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
    assert.equal(report.fitProfile, HUMAN_SHAPE_FIT);
    assert.deepEqual(report.targetNames, [...HUMAN_SHAPE_TARGETS]);
    assert.equal(report.neutralIdentity.matchesShippedBody, true);
    assert.equal(report.base.vertices, 3274);
    assert.equal(report.base.joints, 65);
    assert.equal(report.clips, 57);
    const shipped = createHash('sha256').update(fs.readFileSync(report.base.path)).digest('hex');
    assert.equal(shipped, report.base.sha256, 'the shipped body changed since the candidate was built');
    const actual = createHash('sha256').update(fs.readFileSync(CANDIDATE)).digest('hex');
    assert.equal(actual, report.output.sha256, 'the candidate on disk is not the one the report describes');
});

test('both shapes keep stature and limb span', {skip: built ? false : `build ${CANDIDATE} first`}, () => {
    const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
    for (const name of HUMAN_SHAPE_TARGETS) {
        const shape = report.shapes[name];
        // Girth only: scaling perpendicular to each bone axis must not move stature or reach,
        // because height is a separate control and the rig's joint centres must not move.
        assert.ok(Math.abs(shape.shapedHeightM - 1.76) < 0.002, `${name} stature ${shape.shapedHeightM}`);
        assert.ok(Math.abs(shape.shapedSpanXM - 1.8056) < 0.002, `${name} span ${shape.shapedSpanXM}`);
        assert.ok(shape.movedVertices > 2000 && shape.movedVertices < 3274, `${name} moved ${shape.movedVertices}`);
        assert.ok(shape.maxDisplacementM > 0.01 && shape.maxDisplacementM < 0.06, `${name} max ${shape.maxDisplacementM}`);
    }
});

test('morph accessors are not interleaved', {skip: built ? false : `build ${CANDIDATE} first`}, () => {
    // Lite's glTF morph feature resolves each target accessor as a tightly packed array and
    // ignores bufferView.byteStride, so an interleaved target renders as shattered geometry.
    const bytes = fs.readFileSync(CANDIDATE);
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
    const prim = json.meshes.find(m => m.name === 'HumanV1Body').primitives[0];
    assert.equal(prim.targets.length, HUMAN_SHAPE_TARGETS.length);
    for (const target of prim.targets) {
        for (const index of Object.values(target)) {
            const accessor = json.accessors[index];
            const view = json.bufferViews[accessor.bufferView];
            assert.equal(accessor.byteOffset ?? 0, 0, 'morph accessor must start at its buffer view');
            assert.ok(view.byteStride === undefined || view.byteStride === 12,
                `morph accessor buffer view is interleaved (stride ${view.byteStride})`);
        }
    }
    assert.ok(!(json.extensionsRequired || []).includes('EXT_meshopt_compression'));
});
