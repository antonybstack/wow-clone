/** Live V5 HUD and input smoke checks against the active Vite/Lite game. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));

async function visit(query, width, height) {
  await page.setViewportSize({width, height});
  await page.goto(`http://127.0.0.1:5173/ashen-reach.html${query}`, {waitUntil: 'commit'});
  await page.waitForFunction(() => globalThis.ASHEN?.ready, null, {timeout: 120000});
  await page.waitForTimeout(300);
}

const rect = selector => page.locator(selector).evaluate(el => {
  const r = el.getBoundingClientRect();
  return {left: r.left, right: r.right, top: r.top, bottom: r.bottom};
});
const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

await visit('?play&noEnemies', 1280, 720);
assert.equal(await page.locator('#metrics-overlay').isVisible(), false, 'ordinary play should hide diagnostics');
assert.equal(await page.locator('#help').isVisible(), true);
assert.equal(await page.locator('.help-dev').isVisible(), false);
await page.keyboard.press('Escape');
assert.equal(await page.locator('#game-menu').isVisible(), true);
assert.equal(await page.locator('[data-dev-only]').isVisible(), false);
await page.locator('[data-action="dev"]').click();
assert.equal(await page.evaluate(() => ASHEN.dev.enabled), true, 'menu enables running dev tools');
assert.equal(await page.locator('#dev-badge').isVisible(), true);
await page.locator('[data-action="keys"]').click();
assert.equal(await page.locator('[data-dev-only]').isVisible(), true);
await page.locator('[data-action="hub"]').click();
await page.locator('[data-action="resume"]').click();
await page.keyboard.press('KeyF');
assert.equal(await page.evaluate(() => ASHEN.player.isFlying()), true, 'F enters dev flight');
await page.keyboard.press('KeyF');
assert.equal(await page.evaluate(() => ASHEN.player.isFlying()), false, 'F exits dev flight');
await page.keyboard.press('Escape');
await page.locator('[data-action="dev"]').click();
assert.equal(await page.evaluate(() => ASHEN.dev.enabled), false, 'menu disables running dev tools');
assert.equal(await page.locator('#dev-badge').isVisible(), false);
await page.locator('[data-action="resume"]').click();

for (const [width, height] of [[390, 844], [375, 667], [320, 568]]) {
  await visit('?touch&noEnemies', width, height);
  assert.equal(await page.evaluate(() => ASHEN.scene.camera === ASHEN.camera), true, 'touch entry opens play view');
  assert.equal(await page.locator('.spell-bar span').first().isVisible(), true, 'spell name is visible');
  const [stick, spells, actions] = await Promise.all([
    rect('.touch-stick'), rect('.spell-bar'), rect('.touch-actions'),
  ]);
  assert.equal(overlaps(stick, spells), false, `${width}px stick/spells overlap`);
  assert.equal(overlaps(stick, actions), false, `${width}px stick/actions overlap`);
  assert.equal(overlaps(spells, actions), false, `${width}px spells/actions overlap`);
  assert.ok(stick.left >= 0 && actions.right <= width, `${width}px controls fit screen`);
  if (width === 390) {
    await page.locator('.touch-menu').click();
    assert.equal(await page.locator('#game-menu').isVisible(), true, 'touch menu opens');
    await page.locator('[data-action="keys"]').click();
    assert.equal(await page.locator('.touch-keys').isVisible(), true, 'touch help is shown');
    assert.equal(await page.locator('.desktop-keys').isVisible(), false, 'desktop keys are hidden on touch');
    await page.locator('[data-action="hub"]').click();
    await page.locator('[data-action="resume"]').click();
    await page.locator('.touch-target').click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => ASHEN.combat.snapshot().target), 'ashen-training-dummy');
    await page.locator('[data-spell="1"]').click();
    await page.waitForTimeout(700);
    assert.ok(await page.evaluate(() => ASHEN.combat.snapshot().dummy.hp < 2000), 'touch spell hits target');
  }
  console.log(`touch ${width}x${height}: controls fit`);
}

const touchOwnership = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const pointer = (type, pointerId, target) => target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, pointerType: 'touch', pointerId, button: 0, clientX: 160, clientY: 280,
  }));
  pointer('pointerdown', 81, canvas);
  const held = ASHEN.input.lmb;
  pointer('pointerup', 82, document.querySelector('.touch-target'));
  const afterOtherFinger = {held: ASHEN.input.lmb, clicked: ASHEN.input.clicked};
  pointer('pointercancel', 81, canvas);
  return {held, afterOtherFinger, released: !ASHEN.input.lmb, clicked: ASHEN.input.clicked};
});
assert.equal(touchOwnership.held, true);
assert.deepEqual(touchOwnership.afterOtherFinger, {held: true, clicked: false});
assert.equal(touchOwnership.released, true);
assert.equal(touchOwnership.clicked, false, 'cancelled world drag does not select');

async function clickDummy() {
  await page.keyboard.press('Tab');
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => ASHEN.combat.snapshot().target), 'ashen-training-dummy');
  const plate = await page.locator('.target-plate').boundingBox();
  await page.evaluate(() => ASHEN.combat.targeting.clear());
  await page.mouse.click(plate.x + plate.width / 2, plate.y + plate.height + 25);
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => ASHEN.combat.snapshot().target), 'ashen-training-dummy');
}

await visit('?play&noEnemies&dev', 1280, 720);
await clickDummy(); // Dev mode on, flight off, must leave clicks for combat.
await visit('?play&noEnemies', 1280, 720);
await clickDummy();
await page.evaluate(() => ASHEN.combat.targeting.clear());
const z0 = await page.evaluate(() => ASHEN.player.body.position.z);
await page.keyboard.down('KeyW');
await page.waitForTimeout(1100);
await page.keyboard.up('KeyW');
const z1 = await page.evaluate(() => ASHEN.player.body.position.z);
assert.ok(z1 > z0 + 3, 'normal forward movement advances the player');
await page.keyboard.press('Tab');
await page.keyboard.press('Digit1');
await page.waitForTimeout(700);
const afterCast = await page.evaluate(() => ASHEN.combat.snapshot().dummy.hp);
assert.ok(afterCast < 2000, 'normal spell damages the dummy');
await page.keyboard.press('KeyT');
await page.waitForTimeout(700);
assert.equal(await page.evaluate(() => ASHEN.combat.snapshot().auto.enabled), true);
await page.evaluate(() => document.exitPointerLock?.());
await page.waitForTimeout(250);
await page.keyboard.press('Escape');
assert.equal(await page.locator('#game-menu').isVisible(), true);
const hpPaused = await page.evaluate(() => ASHEN.combat.snapshot().dummy.hp);
await page.waitForTimeout(1100);
assert.equal(await page.evaluate(() => ASHEN.combat.snapshot().dummy.hp), hpPaused, 'menu pauses combat');
await page.locator('[data-action="resume"]').click();
await page.waitForTimeout(1200);
assert.ok(await page.evaluate(() => ASHEN.combat.snapshot().dummy.hp) < hpPaused, 'combat resumes');

assert.deepEqual(errors, [], 'no page errors');
console.log('V5 live HUD, dev, touch, targeting, and combat checks passed');
process.exit(0);
