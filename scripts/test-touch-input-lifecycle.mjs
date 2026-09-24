import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const inputSource = await readFile(new URL('../src/input.js', import.meta.url), 'utf8');
const touchSource = await readFile(new URL('../src/ashen-reach/touch-controls.js', import.meta.url), 'utf8');
let instance = 0;

// Small DOM event tree: window capture listeners run before control handlers.
// Each fixture imports fresh copies of the actual modules, with no browser.
async function fixture(t) {
  const captures = new Map();
  class Element {
    handlers = new Map();
    style = {};
    children = [];
    classes = new Set();
    classList = { add: name => this.classes.add(name), contains: name => this.classes.has(name) };
    constructor(parent = null) { this.parent = parent; }
    addEventListener(type, fn, options) {
      const handlers = this.handlers.get(type) || [];
      handlers.push({ fn, capture: options === true || options?.capture === true });
      this.handlers.set(type, handlers);
    }
    append(child) { child.parent = this; this.children.push(child); }
    closest(selector) {
      for (let el = this; el; el = el.parent) {
        if (el.id && selector.split(',').some(s => s.trim() === `#${el.id}`)) return el;
      }
      return null;
    }
    getBoundingClientRect() { return { left: 0, top: 0, width: 118, height: 118 }; }
    setPointerCapture(id) {
      if (this.failCapture) throw new Error('Pointer is no longer active');
      captures.set(id, this);
    }
    hasPointerCapture(id) { return captures.get(id) === this; }
    releasePointerCapture(id) {
      if (!this.hasPointerCapture(id)) return;
      captures.delete(id);
      this.emit('lostpointercapture', { pointerId: id, button: -1 });
    }
    emit(type, details = {}) {
      const event = { type, target: this, pointerType: 'touch', pointerId: 1,
        button: 0, buttons: 1, clientX: 59, clientY: 17, preventDefault() {}, ...details };
      const path = [];
      for (let el = this; el; el = el.parent) path.push(el);
      for (const el of [...path].reverse()) {
        for (const h of el.handlers.get(type) || []) if (h.capture) h.fn(event);
      }
      for (const el of path) {
        for (const h of el.handlers.get(type) || []) if (!h.capture) h.fn(event);
      }
      if (type === 'pointerup' || type === 'pointercancel') {
        captures.get(event.pointerId)?.releasePointerCapture(event.pointerId);
      }
    }
  }
  const win = new Element();
  win.matchMedia = () => ({ matches: true });
  const doc = new Element(win);
  doc.hidden = false;
  doc.body = new Element(doc);
  doc.head = new Element(doc);
  doc.documentElement = doc.body;
  doc.getElementById = id => doc.body.children.find(el => el.id === id) || null;
  const root = new Element();
  const controls = Object.fromEntries(['stick', 'knob', 'jump', 'target', 'menu'].map(name => [name, new Element(root)]));
  root.querySelector = selector => controls[selector.slice('.touch-'.length)];
  doc.createElement = tag => tag === 'div' ? root : new Element();
  const canvas = new Element(doc.body);
  canvas.requestPointerLock = () => {};
  const globals = { window: win, document: doc, location: { search: '?touch' } };
  const old = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, globals);
  t.after(() => { for (const [key, descriptor] of old) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  } });
  const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const inputUrl = moduleUrl(`${inputSource}\n// fixture ${++instance}`);
  const api = await import(inputUrl);
  const touch = await import(moduleUrl(touchSource.replace('"../input.js"', JSON.stringify(inputUrl))));
  api.initInput(canvas);
  touch.installTouchControls();
  return { ...api, ...controls, win, doc, canvas, captures };
}

function moving(f) { f.pollInput(); assert.ok(f.input.forward > .9); assert.equal(f.input.faceCamera, true); }
function stopped(f) {
  f.pollInput();
  assert.equal(f.input.forward, 0);
  assert.equal(f.input.strafe, 0);
  assert.equal(f.input.faceCamera, false);
  assert.equal(f.input.jump, false);
}

test('ordinary stick release permits the next finger and clears movement', async t => {
  const f = await fixture(t);
  f.stick.emit('pointerdown'); moving(f);
  f.stick.emit('pointerup'); stopped(f);
  f.stick.emit('pointerdown', { pointerId: 2 }); moving(f);
});

for (const reason of ['blur', 'modal', 'visibility']) {
  test(`${reason} releases stick/jump ownership, capture, and pending look; fresh input recovers`, async t => {
    const f = await fixture(t);
    f.stick.emit('pointerdown');
    f.jump.emit('pointerdown', { pointerId: 2 });
    f.canvas.emit('pointerdown', { pointerId: 3 });
    f.canvas.emit('pointermove', { pointerId: 3, clientX: 99 });
    moving(f); assert.equal(f.input.jump, true);
    if (reason === 'blur') f.win.emit('blur');
    if (reason === 'modal') f.setInputEnabled(false);
    if (reason === 'visibility') { f.doc.hidden = true; f.doc.emit('visibilitychange'); }
    assert.equal(f.input.forward, 0, 'reset is immediate, even before the next poll');
    stopped(f);
    assert.equal(f.input.looking, false);
    assert.equal(f.input.lookX, 0);
    assert.equal(f.knob.style.transform, '');
    assert.equal(f.captures.size, 0);
    if (reason === 'blur') f.win.emit('focus');
    if (reason === 'modal') f.setInputEnabled(true);
    if (reason === 'visibility') { f.doc.hidden = false; f.doc.emit('visibilitychange'); }
    f.stick.emit('pointerdown', { pointerId: 4 }); moving(f);
    f.jump.emit('pointerdown', { pointerId: 5 }); f.pollInput(); assert.equal(f.input.jump, true);
    f.stick.emit('pointercancel', { pointerId: 1 });
    f.jump.emit('pointerup', { pointerId: 2 });
    moving(f); assert.equal(f.input.jump, true, 'late old events cannot release new owners');
  });
}

test('modal entry and exit clear ownership even without a termination event', async t => {
  const f = await fixture(t);
  f.stick.emit('pointerdown'); moving(f);
  f.setInputEnabled(false); f.setInputEnabled(true);
  f.stick.emit('pointerdown', { pointerId: 2 }); moving(f);
});

test('disabled controls cannot acquire pointers, queue movement, or queue target actions', async t => {
  const f = await fixture(t);
  f.setInputEnabled(false);
  f.stick.emit('pointerdown'); f.jump.emit('pointerdown', { pointerId: 2 });
  f.target.emit('pointerup', { pointerId: 3 });
  assert.equal(f.captures.size, 0);
  assert.equal(f.input.tabPressed, false);
  f.setInputEnabled(true);
  f.stick.emit('pointermove'); f.jump.emit('pointermove', { pointerId: 2 }); stopped(f);
  f.stick.emit('pointerdown', { pointerId: 4 }); moving(f);
});

test('visibility/focus return does not re-enable input disabled by a modal', async t => {
  const f = await fixture(t);
  f.setInputEnabled(false);
  f.win.emit('blur'); f.doc.hidden = true; f.doc.emit('visibilitychange');
  f.doc.hidden = false; f.doc.emit('visibilitychange'); f.win.emit('focus');
  f.stick.emit('pointerdown'); f.canvas.emit('pointerdown', { pointerId: 2 });
  stopped(f); assert.equal(f.input.looking, false); assert.equal(f.captures.size, 0);
});

for (const control of ['stick', 'jump']) {
  test(`${control} capture loss releases only its owner and permits a new press`, async t => {
    const f = await fixture(t);
    f.stick.emit('pointerdown'); f.jump.emit('pointerdown', { pointerId: 2 });
    const id = control === 'stick' ? 1 : 2;
    f[control].releasePointerCapture(id);
    f.pollInput();
    assert.equal(f.input.forward > .9, control !== 'stick');
    assert.equal(f.input.jump, control !== 'jump');
    f[control].emit('pointerdown', { pointerId: 3 }); moving(f);
    assert.equal(f.input.jump, true);
  });
}

test('other fingers cannot move or release a held stick or jump', async t => {
  const f = await fixture(t);
  f.stick.emit('pointerdown'); f.jump.emit('pointerdown', { pointerId: 2 });
  f.stick.emit('pointerdown', { pointerId: 3, clientY: 100 });
  f.stick.emit('pointermove', { pointerId: 3, clientY: 100 });
  f.jump.emit('pointerdown', { pointerId: 4 });
  f.jump.emit('pointerup', { pointerId: 4 });
  f.stick.emit('pointercancel', { pointerId: 3 });
  moving(f); assert.equal(f.input.jump, true);
});

test('unrelated control cancellation preserves world look and subsequent drag deltas', async t => {
  const f = await fixture(t);
  f.canvas.emit('pointerdown', { pointerId: 10 });
  f.stick.emit('pointerdown');
  f.stick.emit('pointercancel');
  assert.equal(f.input.lmb, true);
  f.canvas.emit('pointermove', { pointerId: 10, clientX: 100 });
  assert.ok(f.input.lookX > 0); assert.equal(f.input.clicked, false);
});

test('secondary world finger cancellation preserves primary look', async t => {
  const f = await fixture(t);
  f.canvas.emit('pointerdown'); f.canvas.emit('pointerdown', { pointerId: 2 });
  f.canvas.emit('pointercancel', { pointerId: 2, button: -1 });
  assert.equal(f.input.lmb, true);
  f.canvas.emit('pointermove', { clientX: 100 }); assert.ok(f.input.lookX > 0);
});

for (const type of ['pointercancel', 'lostpointercapture']) {
  test(`primary world ${type} with button -1 releases look without selecting`, async t => {
    const f = await fixture(t);
    f.canvas.emit('pointerdown');
    f.canvas.emit(type, { button: -1 });
    assert.equal(f.input.lmb, false); assert.equal(f.input.looking, false);
    assert.equal(f.input.clicked, false);
    f.canvas.emit('pointerdown', { pointerId: 2 });
    f.canvas.emit('pointermove', { pointerId: 2, clientX: 100 }); assert.ok(f.input.lookX > 0);
  });
}

test('mouse capture loss respects the world pointer owner', async t => {
  const f = await fixture(t);
  f.canvas.emit('pointerdown', { pointerType: 'mouse', pointerId: 7, button: 2 });
  f.stick.emit('lostpointercapture', { pointerType: 'mouse', pointerId: 8, button: -1 });
  assert.equal(f.input.rmb, true);
  f.canvas.emit('lostpointercapture', { pointerType: 'mouse', pointerId: 7, button: -1 });
  assert.equal(f.input.rmb, false); assert.equal(f.input.clicked, false);
});

test('capture failure leaves controls neutral and able to accept another finger', async t => {
  const f = await fixture(t);
  for (const control of [f.stick, f.jump]) {
    control.failCapture = true;
    assert.doesNotThrow(() => control.emit('pointerdown'));
    stopped(f);
    control.failCapture = false;
  }
  f.stick.emit('pointerdown', { pointerId: 3 }); f.jump.emit('pointerdown', { pointerId: 4 });
  moving(f); assert.equal(f.input.jump, true);
});
