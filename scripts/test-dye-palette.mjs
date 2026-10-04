import test from 'node:test';
import assert from 'node:assert/strict';
import { DYE_IDS, DYE_PALETTE, DYE_PALETTE_VERSION, MIN_PAIRWISE_FACTOR_DISTANCE, dyeFactor, isDyeId }
    from '../src/ashen-reach/dye-palette.js';

test('every dye is expressible as a multiply over an authored texture', () => {
    // baseColorFactor multiplies, so a channel above 1 is not a brighter dye -- it is a value
    // the renderer cannot honour. The palette is tints of a light base by construction.
    assert.equal(DYE_PALETTE_VERSION, 'ashen-dye-v2');
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
    assert.deepEqual(dyeFactor('oxblood'), [0.591, 0.1, 0.1, 1]);
});

test('no two entries are closer than the separation the palette was designed for', () => {
    // This is the fault v2 exists to fix, so it is asserted rather than left to the module's own
    // load-time guard: v1's eight dyes sat 8-11 units from undyed but only 1.7-3.6 from each
    // other, which read as "undyed, or one of eight darker things". Pairwise distance between
    // factors is the right measure because the rendered mean is linear in the factor.
    assert.ok(MIN_PAIRWISE_FACTOR_DISTANCE >= 0.4, String(MIN_PAIRWISE_FACTOR_DISTANCE));
    let closest = Infinity, pair = null;
    for (let i = 0; i < DYE_IDS.length; i++) {
        for (let j = i + 1; j < DYE_IDS.length; j++) {
            const a = DYE_PALETTE[DYE_IDS[i]].factor, b = DYE_PALETTE[DYE_IDS[j]].factor;
            const gap = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
            if (gap < closest) { closest = gap; pair = `${DYE_IDS[i]}/${DYE_IDS[j]}`; }
        }
    }
    assert.ok(closest >= MIN_PAIRWISE_FACTOR_DISTANCE - 1e-6, `${pair} only ${closest.toFixed(3)} apart`);
});

test('every hue family is represented, so the palette is not spent on lightness alone', () => {
    // v1 was already saturated; what it lacked was spread. A palette whose entries all sit at
    // one lightness or in one hue sector is the failure this replaces, so both are asserted.
    const chroma = f => { const m = (f[0] + f[1] + f[2]) / 3;
        return Math.hypot(f[0] - m, f[1] - m, f[2] - m); };
    const sectors = new Set(), lightness = [];
    for (const id of DYE_IDS) {
        const f = DYE_PALETTE[id].factor;
        lightness.push((f[0] + f[1] + f[2]) / 3);
        if (chroma(f) < 0.06) continue;   // the neutrals carry no hue by design
        const angle = Math.atan2(Math.sqrt(3) * (f[1] - f[2]), 2 * f[0] - f[1] - f[2]);
        sectors.add(Math.floor(((angle * 180 / Math.PI) + 360) % 360 / 60));
    }
    assert.ok(sectors.size >= 5, `only ${sectors.size} hue sectors: ${[...sectors].sort()}`);
    assert.ok(Math.max(...lightness) - Math.min(...lightness) > 0.7, 'lightness is not spread');
});
