/** Intentional WebGPU loss: run alone in an owned browser slot after a game build starts. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';

const dir = process.env.ASHEN_CAPTURE_DIR || 've-capture/ashen-reach/lite1311/f1-device-loss';
const url = process.env.ASHEN_TEST_URL || 'http://127.0.0.1:5173/ashen-reach.html?play&clean';
await fs.mkdir(dir, {recursive: true});
const browser = await chromium.connectOverCDP(CDP_URL);
const context = await browser.newContext({viewport: {width: 1280, height: 720}});
const page = await context.newPage();
const report = {checks: [], pageErrors: [], consoleErrors: []};
page.on('pageerror', error => report.pageErrors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') report.consoleErrors.push(message.text());
});
const check = (name, value) => {
  assert.equal(value, true, name);
  report.checks.push(name);
};

try {
  await page.goto(url);
  await page.waitForFunction(() => window.ASHEN?.ready === true, null, {timeout: 120000});
  check('Loss dialog is hidden before device loss', !(await page.locator('#device-loss').isVisible()));
  await page.keyboard.down('w');
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => ASHEN.renderLoop.state.rendered);
  await page.evaluate(() => ASHEN.engine._device.destroy());
  await page.getByRole('alertdialog', {name: 'The lantern has gone out'}).waitFor();
  await page.screenshot({path: `${dir}/device-loss.png`});
  const button = page.getByRole('button', {name: 'Reload game'});
  check('Reload game action is visible', await button.isVisible());
  check('Reload game action has keyboard focus', await button.evaluate(element => document.activeElement === element));
  const lost = await page.evaluate(async () => {
    const rendered = ASHEN.renderLoop.state.rendered;
    const input = {forward: ASHEN.input.forward, rmb: ASHEN.input.rmb};
    const terminal = await ASHEN.renderLoop.start().then(() => false, () => true);
    return {rendered, input, terminal};
  });
  check('Scheduler is terminal', lost.terminal);
  check('Held movement is cleared', lost.input.forward === 0 && lost.input.rmb === false);
  await page.waitForTimeout(250);
  check('No new frames submit after loss', await page.evaluate(value => ASHEN.renderLoop.state.rendered === value, lost.rendered));
  check('Game rendered before loss', before > 0);
  await page.keyboard.up('w');
  await Promise.all([page.waitForEvent('domcontentloaded'), button.click()]);
  await page.waitForFunction(() => window.ASHEN?.ready === true, null, {timeout: 120000});
  check('Reload returns to a ready game', !(await page.locator('#device-loss').isVisible()));
  check('No uncaught page error', report.pageErrors.length === 0);
  report.passed = true;
  console.log(JSON.stringify({passed: true, checks: report.checks.length, expectedConsoleErrors: report.consoleErrors.length}));
} finally {
  await fs.writeFile(`${dir}/checks.json`, JSON.stringify(report, null, 2));
  await context.close();
  await browser.close();
}
