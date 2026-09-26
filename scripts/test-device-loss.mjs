import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderLoop} from '../src/ashen-reach/render-loop.js';
import {showDeviceLoss} from '../src/ashen-reach/loading-screen.js';
import {input, isInputEnabled, lockInputUntilReload, setInputEnabled} from '../src/input.js';

function lostRig() {
  let resolveLost;
  const listeners = new Set();
  const device = {lost: new Promise(resolve => { resolveLost = resolve; })};
  const scene = {_disposables: []};
  const errors = [], losses = [];
  const previousDocument = globalThis.document;
  globalThis.document = {
    hidden: false,
    pointerLockElement: null,
    addEventListener: type => listeners.add(type),
    removeEventListener: type => listeners.delete(type),
  };
  const loop = createRenderLoop({_device: device}, scene, {
    onError: error => errors.push(error),
    onDeviceLost: (error, info) => losses.push({error, info}),
  });
  return {
    loop, scene, listeners, errors, losses,
    lose: async info => { resolveLost(info); await Promise.resolve(); },
    restore: () => { globalThis.document = previousDocument; },
  };
}

test('active GPU loss stops the loop and reports destroyed devices once', async () => {
  const rig = lostRig();
  try {
    assert.equal(rig.listeners.has('visibilitychange'), true);
    const info = {reason: 'destroyed', message: 'intentional test loss'};
    await rig.lose(info);
    assert.equal(rig.listeners.size, 0);
    assert.equal(rig.losses.length, 1);
    assert.equal(rig.losses[0].info, info);
    assert.equal(rig.losses[0].error.cause, info);
    assert.match(rig.losses[0].error.message, /intentional test loss/);
    assert.deepEqual(rig.errors, []);
    await assert.rejects(rig.loop.start(), /terminal/);
    rig.scene._disposables[0]();
    assert.equal(rig.losses.length, 1);
  } finally {
    rig.restore();
  }
});

test('normal prior scene disposal does not display a device-loss warning', async () => {
  const rig = lostRig();
  try {
    rig.scene._disposables[0]();
    await rig.lose({reason: 'destroyed', message: 'ordinary teardown'});
    assert.deepEqual(rig.losses, []);
    assert.equal(rig.listeners.size, 0);
  } finally {
    rig.restore();
  }
});

test('device-loss dialog is accessible, idempotent, and reloads the page', () => {
  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  const pre = {textContent: ''};
  const button = {focused: false, focus() { this.focused = true; }};
  const panel = {hidden: true, querySelector: selector => selector === 'pre' ? pre : button};
  const canvas = {inert: false};
  const errorPanel = {style: {display: 'block'}};
  const removedClasses = [], removedAttributes = [];
  const elements = {'device-loss': panel, renderCanvas: canvas, error: errorPanel};
  globalThis.document = {
    body: {
      classList: {remove: name => removedClasses.push(name)},
      removeAttribute: name => removedAttributes.push(name),
      children: [canvas, errorPanel, panel],
    },
    getElementById: name => elements[name],
  };
  let reloads = 0;
  globalThis.location = {reload: () => { reloads++; }};
  try {
    const failure = new Error('device lost');
    assert.equal(showDeviceLoss(failure), true);
    assert.equal(panel.hidden, false);
    assert.equal(button.focused, true);
    assert.match(pre.textContent, /device lost/);
    assert.equal(canvas.inert, true);
    assert.equal(errorPanel.inert, true);
    assert.equal(panel.inert, undefined);
    assert.equal(errorPanel.style.display, 'none');
    assert.deepEqual(removedClasses, ['is-loading']);
    assert.deepEqual(removedAttributes, ['aria-busy']);
    assert.equal(showDeviceLoss(failure), false);
    button.onclick();
    assert.equal(reloads, 1);
  } finally {
    globalThis.document = previousDocument;
    globalThis.location = previousLocation;
  }
});

test('device-loss input lock clears held movement and ignores later modal restores', () => {
  const previousDocument = globalThis.document;
  globalThis.document = {hidden: false, pointerLockElement: null};
  try {
    setInputEnabled(true);
    input.forward = 1;
    lockInputUntilReload();
    assert.equal(input.forward, 0);
    assert.equal(isInputEnabled(), false);
    setInputEnabled(true);
    assert.equal(isInputEnabled(), false);
  } finally {
    globalThis.document = previousDocument;
  }
});
