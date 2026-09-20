import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import fs from 'node:fs/promises';

// M3c defect 1 evidence: same camera positions as the M3b captures the review flagged (task1-after
// well-square/main-street/wide-town, gate-vista town-gate-vista-fixed, lamp-closeup lych-gate-lamp/
// street-lamp/well-topdown), so before/after frames are pixel-comparable. Tag via argv[2]
// ('before'|'after') selects the output directory only -- no scene/camera logic differs.
const tag = process.argv[2] || 'after';
const outDir = `ve-capture/ashen-reach/world-expansion-m3c/defect1-${tag}`;
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

// task1-after positions (well-square/main-street/wide-town), verbatim.
await shootAt({name:'tavern-smithy', x:0, z:91, yaw:0, pitch:.10, dist:3.5});
await shootAt({name:'main-street', x:0, z:80, yaw:0, pitch:.02, dist:3.5});
await shootAt({name:'well-square', x:0, z:131, yaw:0, pitch:.10, dist:3.5});
await shootAt({name:'wide-town', x:0, z:100, yaw:.35, pitch:.85, dist:24});

// gate-vista/town-gate-vista-fixed position, verbatim -- the exact shot the review called lime.
await shootAt({name:'town-gate', x:0, z:68, yaw:0, pitch:.25, dist:6});

// lamp-closeup positions, verbatim.
await shootAt({name:'street-lamp-z94', x: Math.sin(94*.14)*1.25+3.4, z:90, yaw:.5, pitch:.55, dist:7});
await shootAt({name:'lych-gate-lamp', x: Math.sin(58*.14)*1.25+2.8, z:54, yaw:.5, pitch:.5, dist:6});
await shootAt({name:'well-topdown', x:0, z:136, yaw:.2, pitch:.85, dist:12});

// horizon.js's own citadel-overlook / north-edge shots, for the "still reads correctly at range"
// side of defect 1's evidence requirement.
await shootAt({name:'citadel-overlook', x:0, z:110, yaw:.10, pitch:.28, dist:34});

console.log('done:', tag);
await browser.close();
