/** Correct the Orc forearm coverage at the glove/sleeve join.
 *
 * The registration fitter assigns a triangle by the majority label of its
 * vertices. At this wrist, that leaves forearm triangles in BodyExposed even
 * though the sleeve or glove owns the surface. Reassigning indices between
 * the existing geosets keeps every vertex, skin weight and draw material.
 * Babylon Lite's equipment visibility then hides the appropriate body region
 * using the catalogue's existing coverage contract.
 * See https://github.com/BabylonJS/Babylon-Lite/blob/master/docs/lite/architecture/11-scene-hierarchy-parenting.md
 * for Lite's mesh visibility traversal and https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 * for shared skinned vertex attributes.
 */
export function correctOrcWristCoverage(doc) {
    const names = ['BodyExposed', 'BodyUnderTunic', 'BodyHands'];
    const primitives = Object.fromEntries(names.map(name => {
        const node = doc.getRoot().listNodes().find(n => n.getName() === name);
        if (node?.getMesh()?.listPrimitives().length !== 1) throw Error(`Expected one ${name} primitive`);
        return [name, node.getMesh().listPrimitives()[0]];
    }));
    const position = primitives.BodyExposed.getAttribute('POSITION');
    for (const name of names.slice(1)) {
        if (primitives[name].getAttribute('POSITION') !== position) {
            throw Error(`${name} must share the Orc body vertex array`);
        }
    }
    const xyz = position.getArray();
    const source = primitives.BodyExposed.getIndices().getArray();
    const retained = [], hands = [], sleeve = [];
    for (let i = 0; i < source.length; i += 3) {
        const a = source[i], b = source[i + 1], c = source[i + 2];
        const x = (xyz[a * 3] + xyz[b * 3] + xyz[c * 3]) / 3;
        const y = (xyz[a * 3 + 1] + xyz[b * 3 + 1] + xyz[c * 3 + 1]) / 3;
        if (y > 1.48 && y < 1.72 && Math.abs(x) > 0.89) hands.push(a, b, c);
        else if (y > 1.48 && y < 1.72 && Math.abs(x) > 0.75) sleeve.push(a, b, c);
        else retained.push(a, b, c);
    }
    // The active pack and a fresh print-sculpt rebuild have different initial
    // majority-vote partitions (426/540 vs 580/539). Bound the anatomical
    // correction instead of freezing a derived triangle count to one pack.
    if (hands.length / 3 < 300 || hands.length / 3 > 700
        || sleeve.length / 3 < 400 || sleeve.length / 3 > 700) {
        throw Error(`Unexpected Orc wrist partition: ${hands.length / 3} hand, ${sleeve.length / 3} sleeve triangles`);
    }
    primitives.BodyExposed.getIndices().setArray(new Uint32Array(retained));
    for (const [name, added] of [['BodyHands', hands], ['BodyUnderTunic', sleeve]]) {
        const accessor = primitives[name].getIndices();
        const existing = accessor.getArray();
        const combined = new Uint32Array(existing.length + added.length);
        combined.set(existing);
        combined.set(added, existing.length);
        accessor.setArray(combined);
    }
    return {BodyHands: hands.length / 3, BodyUnderTunic: sleeve.length / 3};
}
