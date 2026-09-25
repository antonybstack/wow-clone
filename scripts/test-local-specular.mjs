import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCAL_SPECULAR_WGSL, localSpecularBRDF } from '../src/ashen-reach/local-specular.js';

const up = [0, 1, 0], dielectric = [.04, .04, .04];
const response = (roughness, f0 = dielectric, view = up, light = up) => localSpecularBRDF(up, view, light, roughness, f0);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);

test('GGX normal-incidence reference and roughness floor', () => {
 for (const roughness of [.22, .4, .7, 1]) {
  close(response(roughness)[0], .04 / (4 * Math.PI * roughness ** 4));
 }
 assert.deepEqual(response(0), response(.22));
 assert.deepEqual(response(-1), response(.22));
 assert.deepEqual(response(2), response(1));
 assert.ok(response(.22)[0] > response(.8)[0]);
});

test('metal F0 colors specular; dielectrics remain neutral and fully rough metal still responds', () => {
 const metal = [.8, .4, .1], value = response(.5, metal);
 close(value[0] / value[1], 2);
 close(value[1] / value[2], 4);
 assert.ok(value[0] > response(.5)[0]);
 assert.ok(response(1, metal)[0] > 0);
 assert.equal(new Set(response(.5)).size, 1);
 assert.deepEqual(response(.5, [0, 0, 0]), [0, 0, 0]);
});

test('back-facing lights, back-facing views and degenerate vectors contribute zero', () => {
 for (const v of [[0, -1, 0], [1, 0, 0], [0, 0, 0]]) {
  assert.deepEqual(response(.3, dielectric, v), [0, 0, 0]);
  assert.deepEqual(response(.3, dielectric, up, v), [0, 0, 0]);
 }
 assert.deepEqual(localSpecularBRDF([0, 0, 0], up, up, .3, dielectric), [0, 0, 0]);
 assert.deepEqual(response(.3, dielectric, [1, 1e-8, 0], [-1, 1e-8, 0]), [0, 0, 0]);
});

test('grazing configurations are finite, nonnegative and bounded', () => {
 for (const roughness of [0, .22, .6, 1]) for (const elevation of [1e-5, .001, .1, 1]) {
  for (const light of [[1, elevation, 0], [-1, elevation, 0], [0, elevation, 1]]) {
   const value = response(roughness, [1, .04, .2], [1, elevation, 0], light);
   assert.ok(value.every(x => Number.isFinite(x) && x >= 0 && x <= 16));
  }
 }
 assert.equal(response(0, [1, 1, 1])[0], 16);
});

test('view changes move the highlight; input vector length does not change its strength', () => {
 const offAxis = [1, 1, 0];
 assert.ok(response(.3)[0] > response(.3, dielectric, offAxis)[0]);
 assert.deepEqual(response(.3, dielectric, [0, 10, 0], [0, 2, 0]), response(.3));
});

test('response preserves HDR and remains linear in shadowed incident radiance', () => {
 const brdf = response(.22)[0], incident = 8;
 const lit = brdf * incident;
 assert.ok(lit > 1);
 close(brdf * (incident * .25), lit * .25);
 assert.equal(brdf * 0, 0);
 assert.ok(LOCAL_SPECULAR_WGSL.includes('localRadiance0(p,normal)*response'));
 assert.ok(LOCAL_SPECULAR_WGSL.includes('localRadiance1(p,normal)*response'));
 assert.ok(!/textureSample|toneMap|srgb|localSpecularStrength/.test(LOCAL_SPECULAR_WGSL));
});
