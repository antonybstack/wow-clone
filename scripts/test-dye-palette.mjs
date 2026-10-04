import test from 'node:test';
import assert from 'node:assert/strict';
import { DYE_IDS, DYE_PALETTE, DYE_PALETTE_VERSION, dyeFactor, isDyeId } from '../src/ashen-reach/dye-palette.js';

test('every dye is expressible as a multiply over an authored texture', () => {
    // baseColorFactor multiplies, so a channel above 1 is not a brighter dye -- it is a value
    // the renderer cannot honour. The palette is tints of a light base by construction.
    assert.equal(DYE_PALETTE_VERSION, 'ashen-dye-v1');
    assert.ok(DYE_IDS.length >= 8);
    for (const id of DYE_IDS) {
        const entry = DYE_PALETTE[id];
        assert.equal(entry.factor.length, 3, id);
        for (const channel of entry.factor) {
            assert.ok(Number.isFinite(channel) && channel >= 0 && channel <= 1, `${id} channel ${channel}`);
        }
        assert.equal(typeof entry.name, 'string');
        assert.ok(Object.isFrozen(entry) && Object.isFrozen(entry.factor), `${id} is mutable`);
    }
});

test('undyed is the neutral factor, so it is a palette entry rather than a special case', () => {
    assert.deepEqual(dyeFactor('undyed'), [1, 1, 1, 1]);
});

test('an unknown dye resolves to null rather than silently falling back to neutral', () => {
    // A silent neutral fallback would turn a typo into "the dye did not apply", which is the
    // hardest kind of content bug to see.
    for (const bad of ['neon', '', 'UNDYED', 'oxblood ', null, undefined, 0, {}]) {
        assert.equal(dyeFactor(bad), null, JSON.stringify(bad));
        if (typeof bad !== 'undefined') assert.equal(isDyeId(bad), false, JSON.stringify(bad));
    }
});

test('a known dye resolves to its factor with an opaque alpha', () => {
    for (const id of DYE_IDS) {
        const factor = dyeFactor(id);
        assert.equal(factor.length, 4, id);
        assert.equal(factor[3], 1, `${id} alpha`);
        assert.deepEqual(factor.slice(0, 3), [...DYE_PALETTE[id].factor], id);
        assert.ok(isDyeId(id));
    }
});

test('the palette is not mutable through what it exports', () => {
    assert.ok(Object.isFrozen(DYE_PALETTE));
    assert.ok(Object.isFrozen(DYE_IDS));
    // dyeFactor hands back a fresh array, so a caller cannot edit the palette through it.
    const a = dyeFactor('oxblood');
    a[0] = 0;
    assert.deepEqual(dyeFactor('oxblood'), [0.62, 0.14, 0.12, 1]);
});
