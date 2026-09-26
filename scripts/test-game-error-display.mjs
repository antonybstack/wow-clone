import test from 'node:test';
import assert from 'node:assert/strict';
import {formatGameError} from '../src/ashen-reach/error-display.js';
import {failLoading} from '../src/ashen-reach/loading-screen.js';

test('ordinary network errors keep stack and cause without loading Lite decoder', async () => {
  const cause = new Error('connection reset');
  const error = new Error('world download failed', {cause});
  let imports = 0;
  const output = await formatGameError(error, async () => {imports++; throw Error('unexpected import');});
  assert.equal(imports, 0);
  assert.match(output, /world download failed/);
  assert.match(output, /Caused by: Error: connection reset/);
  assert.match(output, /error-display\.mjs/);
});

test('coded Lite errors decode on demand without replacing original stack or cause', async () => {
  const cause = new Error('source rejected');
  const error = new Error('#12', {cause});
  error.lite = ['mesh.glb'];
  let imports = 0;
  const output = await formatGameError(error, async () => {
    imports++;
    return {decodeError: () => 'Mesh load failed: mesh.glb'};
  });
  assert.equal(imports, 1);
  assert.match(output, /Error: #12/);
  assert.match(output, /Lite: Mesh load failed: mesh\.glb/);
  assert.match(output, /Caused by: Error: source rejected/);
});

test('failed decoder import and failed decoder call retain raw diagnostics', async () => {
  const error = new Error('#12');
  error.lite = ['mesh.glb'];
  const missing = await formatGameError(error, async () => {throw Error('chunk unavailable');});
  const broken = await formatGameError(error, async () => ({decodeError: () => {throw Error('bad table');}}));
  assert.match(missing, /Error: #12/);
  assert.match(broken, /Error: #12/);
  assert.doesNotMatch(missing, /chunk unavailable/);
  assert.doesNotMatch(broken, /bad table/);
});

test('production Lite decoder expands a coded error only on failure', async () => {
  const error = new Error('#12');
  error.lite = ['mesh.glb'];
  const output = await formatGameError(error);
  assert.match(output, /Lite: Animation track "mesh\.glb" requires at least one key/);
  assert.match(output, /Error: #12/);
});

test('loading failure displays diagnostics and preserves retry', () => {
  const pre = {textContent: ''};
  const elements = new Map([
    ['loading', {classList: {add() {}}, setAttribute() {}}],
    ['loading-line', {textContent: ''}],
    ['loading-note', {textContent: ''}],
    ['loading-error', {hidden: true, querySelector: () => pre}],
    ['loading-retry', {hidden: true, onclick: null}],
  ]);
  const oldDocument = globalThis.document;
  const oldLocation = globalThis.location;
  let retries = 0;
  globalThis.document = {body: {removeAttribute() {}}, getElementById: id => elements.get(id)};
  globalThis.location = {reload: () => retries++};
  try {
    assert.equal(failLoading(new Error('#12'), 'Error: #12\nLite: readable diagnosis'), true);
    assert.equal(pre.textContent, 'Error: #12\nLite: readable diagnosis');
    assert.equal(elements.get('loading-error').hidden, false);
    elements.get('loading-retry').onclick();
    assert.equal(retries, 1);
  } finally {
    globalThis.document = oldDocument;
    globalThis.location = oldLocation;
  }
});
