/** The root URL and the direct game URL must reach the same playable state, once each.
 *
 * Example:
 *   ASHEN_CDP_PORT=10137 ASHEN_VITE_ORIGIN=http://127.0.0.1:5973 \
 *     node scripts/ashen-reach/check-startup-entry.mjs
 *
 * Three regressions this catches, all of which are silent in ordinary play:
 *  - `/` no longer redirects, so it has to serve the game itself and still imply the
 *    `?play&clean` the old stub page appended.
 *  - a query on `/` must be taken at its word, exactly as the stub forwarded it.
 *  - Havok's WASM is now requested during boot instead of inside setupPlayer. If the
 *    memoisation in loadHavok() ever breaks, the only symptom is a second 650 KB
 *    download -- invisible on a warm cache, expensive on a cold one.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';

const origin = process.env.ASHEN_VITE_ORIGIN || `http://127.0.0.1:${process.env.ASHEN_VITE_PORT || 5173}`;
const browser = await chromium.connectOverCDP(CDP_URL);
const results = [];

async function visit(label, pathAndQuery) {
  const context = await browser.newContext({viewport: {width: 1280, height: 720}, deviceScaleFactor: 1});
  const page = await context.newPage();
  const requests = [];
  const redirects = [];
  page.on('request', request => requests.push(request.url()));
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) redirects.push(frame.url()); });
  try {
    await page.goto(`${origin}${pathAndQuery}`, {waitUntil: 'domcontentloaded', timeout: 120000});
    await page.waitForFunction(() => globalThis.ASHEN?.whenPlayable, null, {timeout: 120000});
    const playableMs = await page.evaluate(() => globalThis.ASHEN.whenPlayable);
    const state = await page.evaluate(() => ({
      clean: document.body.classList.contains('clean'),
      // `?play` is what puts the third-person camera behind the character; the reference
      // free camera is the other view, and a root URL that landed there would look
      // plausible in a screenshot while being the wrong entry point entirely.
      camera: globalThis.ASHEN.scene.camera === globalThis.ASHEN.camera ? 'play' : 'reference',
      usingPhysics: globalThis.ASHEN.player?.usingPhysics ?? null,
      url: location.pathname + location.search,
    }));
    results.push({
      label, requested: pathAndQuery, playableMs: Math.round(playableMs), ...state,
      navigations: redirects.length,
      havokWasmRequests: requests.filter(url => /HavokPhysics(?:-[a-f0-9]{12})?\.wasm/.test(url)).length,
      documentRequests: requests.filter(url => /\.html(\?|$)|\/(\?|$)/.test(new URL(url).pathname + (new URL(url).search ? '?' : ''))).length,
    });
  } finally {
    await context.close();
  }
}

await visit('root-bare', '/');
await visit('root-with-query', '/?play&clean&noEnemies');
await visit('direct-game', '/ashen-reach.html?play&clean');
await browser.close();

console.log(JSON.stringify(results, null, 1));

for (const row of results) {
  assert.equal(row.usingPhysics, true, `${row.label}: Havok did not take over the player`);
  assert.equal(row.havokWasmRequests, 1, `${row.label}: Havok WASM was requested ${row.havokWasmRequests} times, expected exactly 1`);
  // One navigation is the initial commit. Two means something redirected.
  assert.equal(row.navigations, 1, `${row.label}: ${row.navigations} main-frame navigations, expected 1 (no redirect hop)`);
}
assert.equal(results[0].camera, 'play', 'a bare root URL must start in the play view');
assert.equal(results[0].clean, true, 'a bare root URL must start with the clean HUD');
assert.equal(results[2].camera, 'play', 'the direct game URL must still start in the play view');
console.log('entry points OK');
