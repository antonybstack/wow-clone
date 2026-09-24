// Run with Vite and an owned Chrome running (defaults: 5173 / CDP 9337):
// node --test scripts/test-loading-screen.mjs
// ASHEN_BASE_URL and ASHEN_CDP_PORT select an isolated harness slot.
import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import {chromium} from 'playwright';
import {CDP_URL} from './lib/cdp.mjs';

const baseURL = process.env.ASHEN_BASE_URL || 'http://127.0.0.1:5173';
const timeout = 120_000;
let browser;

before(async () => {
  browser = await chromium.connectOverCDP(CDP_URL);
});
after(async () => {
  // Disconnect from the owned CDP browser; do not close its existing tabs.
  await browser?.close();
});

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return {promise, resolve};
}

async function gateRequest(page, pathname) {
  const reached = deferred();
  const released = deferred();
  await page.route(url => url.pathname === pathname, async route => {
    reached.resolve();
    await released.promise;
    await route.continue();
  });
  return {reached: reached.promise, release: released.resolve};
}

async function fixture(options, run) {
  const context = await browser.newContext({
    viewport: {width: options.width, height: options.height},
    hasTouch: options.touch || false,
    isMobile: options.mobile || false,
    reducedMotion: options.reducedMotion || 'no-preference',
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  // Observe the production lifecycle without changing it. The module request is
  // held separately, so the initial assertions exercise server HTML and its CSS.
  await page.addInitScript(() => {
    window.__loadingTest = {values: [], statuses: [], removedAtStage: null};
    const record = () => {
      const state = window.__loadingTest;
      const meter = document.getElementById('loading-progress');
      if (meter) {
        const value = Number(meter.getAttribute('aria-valuenow'));
        if (state.values.at(-1) !== value) state.values.push(value);
      }
      const line = document.getElementById('loading-line')?.textContent.trim();
      if (line && state.statuses.at(-1) !== line) state.statuses.push(line);
      if (state.values.length && !document.getElementById('loading') && state.removedAtStage === null) {
        state.removedAtStage = state.values.at(-1);
      }
    };
    new MutationObserver(record).observe(document, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ['aria-valuenow'], characterData: true,
    });
  });
  const main = await gateRequest(page, '/src/ashen-reach/main.js');
  try {
    await run({page, errors, main});
  } finally {
    main.release();
    await context.close();
  }
}

async function openInitial(page, main, options) {
  // Do not use ?clean: it would hide the help panel independently of loading CSS
  // and make the original help-over-loader regression invisible to this test.
  const route = options.root ? '/?play' : '/ashen-reach.html?play';
  await page.goto(new URL(route, baseURL).href, {waitUntil: 'commit'});
  await page.waitForFunction(() => document.getElementById('loading-title'));
  await Promise.race([
    main.reached,
    page.waitForTimeout(15_000).then(() => { throw Error('Main module route gate was not reached'); }),
  ]);
  await page.waitForFunction(() => [...document.styleSheets].some(sheet => {
    if (!sheet.href || !new URL(sheet.href).pathname.endsWith('/loading-screen.css')) return false;
    try { return sheet.cssRules.length > 0; } catch { return false; }
  }));
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  assert.equal(await page.evaluate(() => Boolean(window.ASHEN)), false, 'main module is still held');
  assert.equal(await page.evaluate(() => document.body.classList.contains('is-loading')), true);
  assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), !!options.touch);
  assert.equal(await page.locator('#loading').isVisible(), true);
  assert.equal(await page.locator('#help').isVisible(), false, 'desktop help must be hidden before JS');
  assert.match(await page.locator('#loading-title').innerText(), /Ashen\s+Reach/i);
  const status = await page.locator('#loading-line').evaluate(element => ({
    text: element.textContent.trim(),
    live: element.getAttribute('aria-live') || element.closest('[aria-live]')?.getAttribute('aria-live'),
    role: element.getAttribute('role'),
  }));
  assert.ok(status.text, 'initial status is nonempty');
  assert.ok(['polite', 'assertive'].includes(status.live) || status.role === 'status', 'status is a live region');
  const meter = page.locator('#loading-progress');
  assert.equal(await meter.getAttribute('role'), 'progressbar');
  assert.equal(await meter.getAttribute('aria-valuemax'), '6');
  assert.equal(await meter.getAttribute('aria-valuenow'), '0');
  for (const selector of ['#loading-title', '#loading-line', '#loading-progress']) {
    await assertInsideViewport(page, selector);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true,
    'loading must not cause horizontal document overflow');
  const touchTip = page.locator('.loading-tip .touch-tip');
  const desktopTip = page.locator('.loading-tip .desktop-tip');
  assert.equal(await touchTip.isVisible(), !!options.touch, 'touch tips follow pointer capability');
  assert.equal(await desktopTip.isVisible(), !options.touch, 'desktop tips follow pointer capability');
  if (options.reducedMotion === 'reduce') {
    const moving = await page.locator('#loading').evaluate(element =>
      element.getAnimations({subtree: true}).filter(animation => {
        const timing = animation.effect.getComputedTiming();
        return animation.playState === 'running' && Number(timing.duration) > 1;
      }).length);
    assert.equal(moving, 0, 'reduced motion disables the decorative loader animations');
  }
}

async function assertInsideViewport(page, selector) {
  assert.equal(await page.locator(selector).isVisible(), true, `${selector} is visible`);
  const dimensions = await page.locator(selector).evaluate(element => {
    const rect = element.getBoundingClientRect();
    return {left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: innerWidth, height: innerHeight};
  });
  assert.ok(dimensions.left >= -1 && dimensions.top >= -1 && dimensions.right <= dimensions.width + 1 &&
    dimensions.bottom <= dimensions.height + 1, `${selector} fits viewport: ${JSON.stringify(dimensions)}`);
}

async function assertReady(page, errors) {
  await page.waitForFunction(() => window.ASHEN?.ready === true, null, {timeout});
  await page.locator('#loading').waitFor({state: 'detached', timeout: 5000});
  assert.equal(await page.evaluate(() => document.body.classList.contains('is-loading')), false);
  assert.notEqual(await page.locator('body').getAttribute('aria-busy'), 'true');
  assert.equal(await page.locator('#renderCanvas').getAttribute('inert'), null);
  const lifecycle = await page.evaluate(() => window.__loadingTest);
  assert.equal(lifecycle.removedAtStage, 6, 'loader must stay until all startup stages finish');
  assert.equal(lifecycle.values[0], 0);
  assert.equal(lifecycle.values.at(-1), 6, 'all six stages complete before removal');
  assert.ok(lifecycle.values.length >= 3, 'startup reports intermediate progress');
  assert.ok(lifecycle.statuses.length >= 3, 'startup updates the live status');
  for (let index = 1; index < lifecycle.values.length; index++) {
    assert.ok(lifecycle.values[index] >= lifecycle.values[index - 1] && lifecycle.values[index] <= 6,
      `stage values remain monotonic: ${lifecycle.values}`);
  }
  const spell = page.locator('#combat button[data-spell="1"]');
  await spell.waitFor({state: 'visible'});
  assert.equal(await spell.isEnabled(), true, 'HUD spell control is enabled after loading');
  await spell.focus();
  assert.equal(await spell.evaluate(element => document.activeElement === element), true, 'HUD accepts keyboard focus');
  // Real input proves that the loading/inert layer no longer traps gameplay UI.
  await page.keyboard.press('Escape');
  await page.locator('#game-menu').waitFor({state: 'visible'});
  await page.getByRole('button', {name: /^Resume/}).click();
  await page.locator('#game-menu').waitFor({state: 'hidden'});
  const gpuErrors = await page.evaluate(() => window.ASHEN?.gpu?.errors || []);
  assert.deepEqual(gpuErrors, [], 'no GPU validation errors');
  assert.deepEqual(errors, [], 'no uncaught exceptions or console errors');
}

const layouts = [
  {name: '320px phone', width: 320, height: 568, touch: true, mobile: true},
  {name: '430px phone through root route', width: 430, height: 932, touch: true, mobile: true, root: true},
  {name: '1280px desktop', width: 1280, height: 720},
  {name: '844×390 landscape phone', width: 844, height: 390, touch: true, mobile: true},
  {name: 'coarse-pointer desktop', width: 1280, height: 720, touch: true},
  {name: 'reduced motion phone', width: 430, height: 932, touch: true, mobile: true, reducedMotion: 'reduce'},
];

for (const options of layouts) {
  test(`${options.name}: initial HTML loader and ready HUD`, {timeout: timeout + 30_000}, async () => {
    await fixture(options, async ({page, errors, main}) => {
      await openInitial(page, main, options);
      // A deliberately delayed main-module response must leave the SSR shell usable.
      await page.waitForTimeout(750);
      assert.equal(await page.locator('#loading').isVisible(), true);
      assert.equal(await page.locator('#help').isVisible(), false);
      main.release();
      await assertReady(page, errors);
    });
  });
}

test('held body download hides controls, blocks game keys, and recovers', {timeout: timeout + 30_000}, async () => {
  const options = {width: 430, height: 932, touch: true, mobile: true};
  await fixture(options, async ({page, errors, main}) => {
    const body = await gateRequest(page, '/ashen-reach/equipment/body.glb');
    try {
      await openInitial(page, main, options);
      main.release();
      await page.waitForFunction(() => Boolean(window.ASHEN), null, {timeout});
      await page.keyboard.press('Escape');
      await page.keyboard.press('Space');
      await page.keyboard.press('KeyC');
      assert.equal(await page.evaluate(() => window.ASHEN.menu.isOpen), false,
        'game keys cannot open a menu behind the loader');
      assert.equal(await page.locator('#loading').isVisible(), true);
      assert.equal(await page.evaluate(() => Boolean(window.ASHEN?.ready)), false);
      assert.equal(await page.locator('#help').isVisible(), false);
      await assertInsideViewport(page, '#loading-line');
      const controls = page.locator('#combat, #touch-controls, #game-menu');
      for (const control of await controls.all()) assert.equal(await control.isVisible(), false);
      body.release();
      await assertReady(page, errors);
    } finally {
      body.release();
    }
  });
});

test('failed body download shows readable recovery and retry boots successfully', {timeout: timeout + 45_000}, async () => {
  const options = {width: 320, height: 568, touch: true, mobile: true};
  await fixture(options, async ({page, errors, main}) => {
    const bodyURL = url => url.pathname === '/ashen-reach/equipment/body.glb';
    await page.route(bodyURL, route => route.fulfill({
      status: 503, contentType: 'text/plain', body: 'Injected loading-screen regression failure',
    }));
    await openInitial(page, main, options);
    main.release();
    await page.locator('#loading.failed').waitFor({state: 'visible', timeout});
    assert.equal(await page.evaluate(() => Boolean(window.ASHEN?.ready)), false);
    assert.equal(await page.locator('#help').isVisible(), false);
    await assertInsideViewport(page, '#loading-line');
    assert.match(await page.locator('#loading-line').innerText(), /could not|failed|unable/i);
    assert.match(await page.locator('#loading-note').innerText(), /connection|try again/i);
    const retry = page.locator('#loading-retry');
    assert.equal(await retry.isVisible(), true);
    assert.equal(await retry.isEnabled(), true);
    await assertInsideViewport(page, '#loading-retry');
    const failureErrors = [...errors];
    assert.ok(failureErrors.some(error => /503/.test(error)), 'the injected failure reaches startup error handling');
    assert.deepEqual(failureErrors.filter(error => !/503|equipment\/body\.glb/.test(error)), [],
      'failure handling introduces no unrelated browser errors');
    await page.unroute(bodyURL);
    errors.length = 0;
    await Promise.all([page.waitForEvent('domcontentloaded'), retry.click()]);
    await assertReady(page, errors);
  });
});
