/** Live scan of the full Walk_Carry_Loop cycle: for each phase, measure real
 * skinned right/left hand world positions (via the raw 'carry' preview clip,
 * unmasked) plus torso/hip deviation from bind, to find phases with more
 * vertical hand separation than the current TWO_HAND_STILL_TIME while still
 * reading as a settled (not mid-stride-extreme) hold. Diagnostic; not imported
 * by the game. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9337');
const page = browser.contexts()[0].pages().find(p => p.url().includes('ashen-reach.html'));
await page.bringToFront();
await page.goto((process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean'), {waitUntil:'commit', timeout:60000});
await page.waitForFunction(() => globalThis.ASHEN?.ready, null, {timeout:60000});
await page.waitForTimeout(500);
await page.evaluate(async()=>{await ASHEN.equipment.equipPreset('warden');});
await page.waitForTimeout(300);
await page.keyboard.press('KeyC'); await page.waitForTimeout(300);
const dur = await page.evaluate(()=>ASHEN.body.inspection.select('carry')===undefined ? ASHEN.body.inspection.getState().duration : ASHEN.body.inspection.getState().duration);
const N = 60;
const samples = [];
for (let i=0;i<N;i++){
  const t = (dur * i / N);
  const d = await page.evaluate((t) => {
    const p = ASHEN.body.inspection;
    p.setPaused(true); p.seek(t);
    const s = ASHEN.combat.fx.sockets, bw = ASHEN.player.body.worldMatrix;
    const xf = (m,x,y,z)=>[m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14]];
    const hw = n => { const bone = ASHEN.body.skeleton.bones.find(x=>x.name===n); const c = s.toCapsule(bone); return xf(bw, c.x, c.y, c.z); };
    return { t, left: hw('mixamorig:LeftHand'), right: hw('mixamorig:RightHand'), hips: hw('mixamorig:Hips'), spine2: hw('mixamorig:Spine2') };
  }, t);
  samples.push(d);
}
await page.keyboard.press('Escape');
await fs.writeFile('.cache/armed-repair/probes/carry-scan.json', JSON.stringify({dur, samples}, null, 2));
console.log('duration', dur, 'samples', samples.length);
await browser.close();
