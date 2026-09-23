/**
 * Load the game and print any WGSL / pipeline errors the page reports.
 *
 * This exists because of the single most expensive failure mode in this project: a
 * WGSL compile error blacks out the *entire* scene while every CPU-side number stays
 * correct. `capture-vistas` prints its usual triangle and draw-batch counts, the HUD
 * draws normally, and the only symptom is a black frame -- so a stats block is never
 * proof that anything rendered. The world is submitted in one render bundle, so one
 * bad pipeline takes all of it down, including passes that compiled fine.
 *
 * It has now happened twice. See the comment in light-shafts.js about declaring the
 * `time` uniform, and ash-motes.js, which read `shaderSystem.time` when custom
 * uniforms live in `shaderUniforms` -- the two namespaces are easy to confuse and the
 * error message is the only thing that tells you which you wanted.
 *
 * Run this after touching any shader, before believing a capture.
 *
 * Usage:
 *   ASHEN_CDP_PORT=10137 ASHEN_URL='http://127.0.0.1:5973/ashen-reach.html?play&clean' \
 *     node scripts/ashen-reach/check-shader-errors.mjs
 *
 * Exits 1 if anything shader-related was reported, so it can gate a capture.
 */
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';

const url=process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean';
const seconds=Number(process.env.ASHEN_SECONDS||6);

const browser=await chromium.connectOverCDP(CDP_URL);
const page=await browser.contexts()[0].newPage();

const msgs=[];
page.on('console',m=>msgs.push(m.text()));
page.on('pageerror',e=>msgs.push(`pageerror: ${e.message}`));

await page.goto(url,{waitUntil:'load'});
await page.waitForTimeout(seconds*1000);
await page.close();
await browser.close();

// "Invalid ... is invalid due to a previous error" repeats once per frame, so the
// interesting line is almost always the first. Dedupe hard or the real message
// scrolls away under hundreds of copies of its own consequences.
const hits=[...new Set(msgs.filter(m=>/WGSL|ShaderModule|RenderPipeline|createShader|pageerror/i.test(m)))];

if(!hits.length){
 console.log('no shader or pipeline errors reported');
 process.exit(0);
}
for(const h of hits)console.log(h.slice(0,1600));
console.log(`\n${hits.length} distinct shader/pipeline error(s). The scene is very likely black.`);
process.exit(1);
