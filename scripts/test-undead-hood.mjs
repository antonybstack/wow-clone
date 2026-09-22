/** The Undead hood must not balloon behind the skull again. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

test('undead graveweaver hood stays within 5cm of the skull back', async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read('public/ashen-reach/equipment-undead/graveweaverHood.glb');
  const pos = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION').getArray();
  let rear = Infinity;
  let front = -Infinity;
  for (let i = 2; i < pos.length; i += 3) {
    rear = Math.min(rear, pos[i]);
    front = Math.max(front, pos[i]);
  }
  // Skull back is about z=-0.121. The tuck leaves ~3cm of cloth, not the old 10cm pack.
  assert.ok(rear > -0.17, `hood rear z ${rear}`);
  assert.ok(front > 0.1, `hood face opening z ${front}`);
});
