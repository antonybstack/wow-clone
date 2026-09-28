/** M005 garment fit: the query surface, and what the built pack actually contains.
 *
 * Asset cases skip with an explicit message when the developer pack has not been built:
 *   node scripts/character-assets/build-garment-shape-family.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {
    HUMAN_GARMENT_FIT_MANIFEST,
    HUMAN_PLATED_ASSET,
    HUMAN_SHAPE_ASSET,
    HUMAN_SHAPE_CAPABILITIES,
    HUMAN_SHAPE_TARGETS,
    resolveHumanShape,
} from '../src/character/runtime/human-shape.js';

const REPORT = 'docs/baselines/character-mmo/m005/garment-shape-family.json';
const FIT = 'docs/baselines/character-mmo/m005/shape-garment-fit.json';
const RIGIDITY = 'docs/baselines/character-mmo/m005/plate-rigidity.json';
const PLATED = 'docs/baselines/character-mmo/m005/plated-body.json';

test('no garment control means the default route', () => {
    assert.equal(resolveHumanShape('?play&clean'), null);
    assert.equal(resolveHumanShape('?humanShape=stout').garmentFit, 'shipped');
    assert.equal(resolveHumanShape('?humanShape=stout').garmentManifestURL, null);
});

test('the refitted pack is requested only when a shape target is driven', () => {
    assert.equal(resolveHumanShape('?humanShape=stout&garmentFit=refit').garmentManifestURL, HUMAN_GARMENT_FIT_MANIFEST);
    // At weight 0 the refitted garments are the shipped garments, so there is nothing to serve.
    assert.equal(resolveHumanShape('?humanShape=neutral&garmentFit=refit').garmentManifestURL, null);
    assert.equal(resolveHumanShape('?garmentFit=refit').garmentManifestURL, null);
    assert.equal(resolveHumanShape('?garmentFit=refit').garmentFit, 'refit');
});

test('an unknown garmentFit is rejected rather than treated as shipped', () => {
    assert.throws(() => resolveHumanShape('?garmentFit=yes'), /Unknown garmentFit/);
    assert.throws(() => resolveHumanShape('?humanShape=stout&garmentFit=1'), /Unknown garmentFit/);
});

test('garment fit and the plate are advertised as candidates, not shipped behaviour', () => {
    assert.equal(HUMAN_SHAPE_CAPABILITIES.garmentsFollowShape, 'candidate');
    assert.equal(HUMAN_SHAPE_CAPABILITIES.rigidPlate, 'candidate');
});

test('the plate rides a body variant and only when a shape is driven', () => {
    // It has no catalogue slot, so it is not reachable through the equipment path at all.
    assert.equal(resolveHumanShape('?humanShape=stout&plate=1').assetURL, HUMAN_PLATED_ASSET);
    assert.equal(resolveHumanShape('?humanShape=stout').assetURL, HUMAN_SHAPE_ASSET);
    assert.equal(resolveHumanShape('?plate=1').assetURL, null);
    assert.equal(resolveHumanShape('?plate=1').plate, true);
    assert.equal(resolveHumanShape('?humanShape=stout').plate, false);
});

test('the plated body is the same skin carrying one more mesh', {skip: fs.existsSync(PLATED) ? false : 'build the plated body first'}, () => {
    const report = JSON.parse(fs.readFileSync(PLATED, 'utf8'));
    assert.equal(report.bind.jointsMatchedByName, 65);
    assert.ok(report.bind.worstRelativeDelta <= report.bind.relativeTolerance,
        `plate bind differs by ${report.bind.worstRelativeDelta}`);
    assert.equal(report.clips, 57, 'the plated body must keep every clip');
    const actual = createHash('sha256').update(fs.readFileSync(report.output.path)).digest('hex');
    assert.equal(actual, report.output.sha256);
});

const built = fs.existsSync(REPORT);
test('every garment carries the same targets in the same order as the body', {skip: built ? false : `build the pack first`}, () => {
    const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
    assert.deepEqual(report.targetNames, [...HUMAN_SHAPE_TARGETS]);
    assert.equal(report.mode, 'track');
    assert.ok(report.garments.length >= 8, `only ${report.garments.length} garments built`);
    for (const garment of report.garments) {
        assert.ok(garment.pieces.length >= 1, `${garment.item} has no pieces`);
        for (const piece of garment.pieces) {
            assert.ok(piece.neutralSha256, `${garment.item}/${piece.mesh} has no neutral identity hash`);
            for (const name of HUMAN_SHAPE_TARGETS) {
                assert.ok(piece.shapes[name], `${garment.item}/${piece.mesh} is missing ${name}`);
            }
        }
        const actual = createHash('sha256').update(fs.readFileSync(garment.output.path)).digest('hex');
        assert.equal(actual, garment.output.sha256, `${garment.item} on disk is not the file the report describes`);
    }
});

test('the refit reduces the coverage the shape takes away', {skip: fs.existsSync(FIT) ? false : 'measure the fit first'}, () => {
    const refit = JSON.parse(fs.readFileSync(FIT, 'utf8'));
    const shipped = JSON.parse(fs.readFileSync('docs/baselines/character-mmo/m004/shape-garment-fit.json', 'utf8'));
    const lost = rows => rows.filter(r => r.shape !== 'neutral').reduce((a, r) => a + r.newlyUncovered, 0);
    const before = lost(shipped.rows), after = lost(refit.rows);
    assert.equal(lost(shipped.rows.filter(r => r.shape === 'neutral')), 0, 'the neutral control must lose nothing');
    assert.equal(lost(refit.rows.filter(r => r.shape === 'neutral')), 0, 'the neutral control must lose nothing');
    // The refit plus the hem pass has to beat the shipped pack by a wide margin. It does
    // not reach zero: 23 body vertices at the shape extremes are past the end of their
    // garment, and reaching them needs authored geometry rather than a fit.
    assert.ok(after < before / 10, `refit left ${after} newly uncovered vertices against ${before} shipped`);
    assert.ok(after <= 30, `refit regressed to ${after} newly uncovered vertices`);
});

test('a rigid piece stays a similarity and cloth does not', {skip: fs.existsSync(RIGIDITY) ? false : 'measure rigidity first'}, () => {
    const report = JSON.parse(fs.readFileSync(RIGIDITY, 'utf8'));
    const plates = report.rows.filter(r => r.kind === 'plate');
    const cloth = report.rows.filter(r => r.kind === 'cloth');
    assert.ok(plates.length && cloth.length, 'need both a plate and a cloth control');
    for (const row of plates) {
        // One bone at full weight on every vertex is what makes the piece rigid through
        // every pose of every clip, without sampling frames.
        assert.equal(row.animation.fraction, 1, `${row.mesh} is not fully rigid-weighted`);
        assert.equal(row.animation.largestSecondaryWeight, 0);
        for (const groups of Object.values(row.shape)) {
            for (const group of groups) {
                assert.ok(group.worstDeviationMm < 0.01,
                    `${row.mesh} deviates ${group.worstDeviationMm} mm from a uniform scale`);
            }
        }
    }
    for (const row of cloth) {
        assert.ok(row.animation.fraction < 0.5, `${row.mesh} is rigid-weighted; it is not a cloth control`);
        const worst = Object.values(row.shape).flat().map(g => g.worstDeviationMm);
        assert.ok(Math.max(...worst) > 1,
            `${row.mesh} behaved like a similarity (${Math.max(...worst)} mm); the control is not exercising the measurement`);
    }
});
