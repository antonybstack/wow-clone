import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import fs from 'node:fs/promises';

// M7a evidence: identical camera positions for before/after so frames are pixel-comparable.
// Tag via argv[2] ('before'|'after') selects the output directory only -- no scene/camera logic
// differs. Reuses M3c's exact camera positions (wide-town, street-lamp close-up, churchyard
// spawn reference) so this milestone's captures line up with the project's established evidence
// trail.
const tag = process.argv[2] || 'after';
const outDir = `ve-capture/ashen-reach/world-expansion-m7a/${tag}`;
await fs.mkdir(outDir, {recursive:true});

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
let page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
await page.setViewportSize({width:960,height:540});
await page.bringToFront();
await page.goto((process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean')+'&noEnemies', {waitUntil:'commit'});
await page.waitForFunction(() => window.ASHEN?.ready, null, {timeout: 60000});
await page.waitForTimeout(1500);

async function shootAt({name,x,z,yaw,pitch,dist}) {
 await page.evaluate(({x,z,yaw,pitch,dist}) => {
  const A = window.ASHEN;
  const y = A.world.groundHeight(x,z) + 1.7;
  A.player.setWorldPos(x, y, z);
  A.player.setFacing(yaw);
  A.rig.yaw = yaw;
  A.rig.pitch = pitch;
  A.rig.distance = A.rig.distanceTarget = dist;
  A.setView('play');
 }, {x,z,yaw,pitch,dist});
 await page.waitForTimeout(700);
 await page.screenshot({path: `${outDir}/${name}.png`});
}

// The wide shot -- the whole point of this milestone. M3c's "wide-town" camera, verbatim.
await shootAt({name:'wide-town', x:0, z:100, yaw:.35, pitch:.85, dist:24});
// A second, more horizontal wide shot down the corridor, for a street-level "does it read as
// pools while walking" check rather than only the overhead view.
await shootAt({name:'street-level-wide', x:0, z:70, yaw:0, pitch:.10, dist:3.5});

// Close shot of one lamp -- M3c's "street-lamp-z94" camera, verbatim.
await shootAt({name:'street-lamp-z94', x: Math.sin(94*.14)*1.25+3.4, z:90, yaw:.5, pitch:.55, dist:7});

// Well square / main street, for a look at buildings.js's unwindowed lights near the density
// centre of the town (out of this milestone's allowed paths, but worth an honest look).
await shootAt({name:'well-square', x:0, z:131, yaw:0, pitch:.10, dist:3.5});

// Churchyard reference frame, for the invariant pixel-diff -- same spawn position M3b/M3c used.
await page.evaluate(() => { window.ASHEN.reset(); });
await page.waitForTimeout(500);
await page.evaluate(() => { window.ASHEN.setView('play'); });
await page.waitForTimeout(1200);
await page.screenshot({path: `${outDir}/churchyard-spawn.png`});

console.log('done:', tag);
await browser.close();
