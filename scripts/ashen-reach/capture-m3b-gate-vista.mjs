import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import fs from 'node:fs/promises';

// M3b defect-3 evidence: "the vista from the town gate" (M3's stated gate).
//
// Finding: at the ORIGINAL M3 town-gate-vista camera (x=0, z=68, pitch=.14, dist=6), the citadel
// is only visible as a near-invisible sliver through a gap in bare tree branches, well below what
// reads as a genuine vista at normal viewing scale (see gate-sweep/gate-z68-p14-original.png).
// The reason: at pitch=.14 the frame is centred on the gate's open archway BELOW its stone
// lintel, which looks straight down the lamp-lit street -- the citadel sits above the lintel, in
// the strip of night sky visible over the gate roof, which that framing barely includes.
//
// A camera-sweep across x/z/pitch (ve-capture/.../world-expansion-m3b/gate-sweep/) found that
// standing at the SAME spot south of the gate and pitching up modestly, to .25, reframes the shot
// to include that sky strip above the lintel -- and the citadel (multiple towers, several lit
// windows) reads clearly through the gaps in the bare tree canopy. This is a pure "gate sightline"
// adjustment (camera pitch only, +.11 rad from the original town-gate-vista framing) -- no scene
// geometry changed to produce this result; the citadel, gate, and trees are exactly the M3
// geometry (plus M3b's defect-1/2 fixes elsewhere in the scene, neither of which touches this
// sightline). Position/distance are unchanged from the original town-gate-vista camera.
const outDir = 've-capture/ashen-reach/world-expansion-m3b/gate-vista';
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

// Single "best" still: the fixed gate-vista framing.
await shootAt({name:'town-gate-vista-fixed', x:0, z:68, yaw:0, pitch:.25, dist:6});

// This harness has no video/screencast capability (see scripts/lib/cdp.mjs), so per the task's
// fallback clause the "clip" is delivered as a sequence of stills along a pan, explicitly noted as
// such: same position/pitch/distance, yaw sweeping left-to-right across the gate opening.
const panYaws = [-0.24, -0.16, -0.08, 0, 0.08, 0.16, 0.24];
for (let i = 0; i < panYaws.length; i++) {
 await shootAt({name:`gate-vista-pan-${String(i).padStart(2,'0')}`, x:0, z:68, yaw:panYaws[i], pitch:.25, dist:6});
}

console.log('done');
await fs.writeFile(`${outDir}/shots.json`, JSON.stringify({
 fixed:{x:0,z:68,yaw:0,pitch:.25,dist:6},
 pan:panYaws.map((yaw,i)=>({name:`gate-vista-pan-${String(i).padStart(2,'0')}`,x:0,z:68,yaw,pitch:.25,dist:6})),
 note:'No CDP video/screencast capability available in this harness (scripts/lib/cdp.mjs) -- this is a stills-along-a-pan sequence, not a recorded clip.'
}, null, 2));
await browser.close();
