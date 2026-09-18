/**
 * Live M1 character-lab validator.
 * Connects to headed Chrome CDP :9222, drives CHARACTER_LAB, writes unique-frame GIFs.
 *
 *   node scripts/validate-character-lab.mjs
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "ve-capture");
const frameDir = path.join(outDir, "m1-val");
const LAB = "http://127.0.0.1:5180/character-lab.html?validate=1";
const PY = path.join(outDir, ".venv/bin/python");

function sha(buf) {
  return createHash("sha256").update(buf).digest("hex").slice(0, 16);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`${cmd} ${args.join(" ")} failed (${code}): ${stderr || stdout}`));
    });
  });
}

async function makeGif(frames, dest, duration = 90) {
  const script = `
from PIL import Image
paths = ${JSON.stringify(frames)}
out = ${JSON.stringify(dest)}
imgs = [Image.open(p).convert("RGBA") for p in paths]
# adaptive palette from the first frame keeps wool/skin readable
base = imgs[0].convert("P", palette=Image.ADAPTIVE, colors=192)
rest = [im.convert("P", palette=Image.ADAPTIVE, colors=192) for im in imgs[1:]]
base.save(out, save_all=True, append_images=rest, duration=${duration}, loop=0, optimize=True, disposal=2)
print(out)
`;
  await writeFile(path.join(frameDir, "make_gif.py"), script);
  return run(PY, [path.join(frameDir, "make_gif.py")]);
}

async function grabFrames(page, prefix, count, intervalMs, prepare) {
  if (prepare) await page.evaluate(prepare);
  await page.waitForTimeout(80);
  const files = [];
  const hashes = [];
  for (let i = 0; i < count; i++) {
    const file = path.join(frameDir, `${prefix}-${String(i).padStart(2, "0")}.png`);
    await page.screenshot({ path: file });
    const buf = await readFile(file);
    hashes.push(sha(buf));
    files.push(file);
    if (i < count - 1) await page.waitForTimeout(intervalMs);
  }
  const unique = new Set(hashes).size;
  return { files, hashes, unique, identical: unique === 1 };
}

async function main() {
  await mkdir(frameDir, { recursive: true });
  const report = {
    ok: true,
    errors: [],
    tests: {},
    gifs: {},
    diagnostics: null,
  };

  try {
    report.tests.unit = await run("node", ["--test", path.join(root, "scripts/test-character-fixture.mjs")]);
  } catch (err) {
    report.ok = false;
    report.errors.push(String(err.message || err));
  }

  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const context = browser.contexts()[0];
  if (!context) throw new Error("No Chrome CDP context on :9222");
  let page = context.pages().find((p) => p.url().includes("character-lab")) || context.pages()[0];
  if (!page) page = await context.newPage();
  page.setDefaultTimeout(90000);
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.bringToFront();
  await page.goto(LAB, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => globalThis.CHARACTER_LAB?.ready === true, null, { timeout: 90000 });
  await page.evaluate(() => {
    const ui = document.getElementById("lab-ui");
    if (ui) ui.style.display = "";
    CHARACTER_LAB.view("front");
    CHARACTER_LAB.left.setPaused(false);
    CHARACTER_LAB.right.setPaused(false);
  });
  await page.waitForTimeout(400);

  const overlay = await page.evaluate(() => {
    const el = document.getElementById("error");
    return el && !el.hidden ? el.textContent : null;
  });
  if (overlay) {
    report.ok = false;
    report.errors.push(`#error overlay: ${overlay.slice(0, 500)}`);
  }

  report.diagnostics = await page.evaluate(() => CHARACTER_LAB.diagnostics());
  const left = report.diagnostics.left;
  const right = report.diagnostics.right;
  const checks = {
    ready: true,
    leftManagers: left.animationManagers === 1,
    rightManagers: right.animationManagers === 1,
    leftStaff: left.staffMeshes >= 1 && left.staffSocket === "mixamorig:RightHand",
    rightStaff: right.staffMeshes >= 1,
    independentClips: left.clip !== right.clip || Math.abs((left.time || 0) - (right.time || 0)) > 0.05,
    independentShape: left.fullness !== right.fullness,
    noLeakBefore: left.retiredMeshesStillInScene === 0 && right.retiredMeshesStillInScene === 0,
    joints: left.joints === 65,
  };

  const swap = await page.evaluate(async () => {
    const before = CHARACTER_LAB.left.diagnostics().time;
    const body = await CHARACTER_LAB.outfit("body");
    const mid = CHARACTER_LAB.left.diagnostics();
    const full = await CHARACTER_LAB.outfit("full");
    const after = CHARACTER_LAB.left.diagnostics();
    return {
      before,
      body,
      full,
      midOutfit: mid.outfit,
      afterOutfit: after.outfit,
      afterTime: after.time,
      retired: after.retiredMeshesStillInScene,
      sceneMeshes: CHARACTER_LAB.diagnostics().sceneMeshes,
      swaps: after.swaps.slice(-2),
    };
  });
  checks.swapBody = swap.midOutfit === "body" && swap.body?.meshes === 2;
  checks.swapFull = swap.afterOutfit === "full" && swap.full?.meshes === 5;
  checks.swapNoLeak = swap.retired === 0;
  checks.swapKeepsTime = Number.isFinite(swap.afterTime);
  report.swap = swap;
  report.checks = checks;
  if (Object.values(checks).some((v) => v !== true)) {
    report.ok = false;
    report.errors.push(`failed checks: ${Object.entries(checks).filter(([, v]) => v !== true).map(([k]) => k).join(", ")}`);
  }

  const clips = [
    {
      id: "walk",
      frames: 12,
      interval: 90,
      duration: 90,
      prepare: () => {
        CHARACTER_LAB.view("front");
        CHARACTER_LAB.left.setPose("Walk_Loop", 0, false);
        CHARACTER_LAB.right.setPose("Walk_Loop", 0.4, false);
        CHARACTER_LAB.left.setPaused(false);
        CHARACTER_LAB.right.setPaused(false);
      },
    },
    {
      id: "jump",
      frames: 12,
      interval: 80,
      duration: 80,
      prepare: () => {
        CHARACTER_LAB.view("three-quarter");
        CHARACTER_LAB.left.setPose("Jump_Loop", 0, false);
        CHARACTER_LAB.right.setPose("Jump_Start", 0.1, false);
        CHARACTER_LAB.left.setPaused(false);
        CHARACTER_LAB.right.setPaused(false);
      },
    },
    {
      id: "crouch",
      frames: 10,
      interval: 100,
      duration: 100,
      prepare: () => {
        CHARACTER_LAB.view("front");
        CHARACTER_LAB.left.setPose("Crouch_Idle_Loop", 0, false);
        CHARACTER_LAB.right.setPose("Walk_Loop", 0.2, false);
        CHARACTER_LAB.left.setPaused(false);
        CHARACTER_LAB.right.setPaused(false);
      },
    },
  ];

  for (const clip of clips) {
    const grabbed = await grabFrames(page, clip.id, clip.frames, clip.interval, clip.prepare);
    const gif = path.join(outDir, `m1-${clip.id}.gif`);
    if (grabbed.identical) {
      report.ok = false;
      report.errors.push(`${clip.id} GIF frames were identical (screenshot cache)`);
    }
    if (grabbed.unique < Math.max(4, Math.floor(clip.frames * 0.4))) {
      report.ok = false;
      report.errors.push(`${clip.id} only ${grabbed.unique}/${clip.frames} unique frames`);
    }
    await makeGif(grabbed.files, gif, clip.duration);
    report.gifs[clip.id] = {
      path: gif,
      unique: grabbed.unique,
      frames: grabbed.files.length,
      hashes: grabbed.hashes,
    };
  }

  // Outfit swap GIF: freeze motion, swap, capture across the change.
  await page.evaluate(() => {
    CHARACTER_LAB.view("front");
    CHARACTER_LAB.left.setPose("Walk_Loop", 0.3, false);
    CHARACTER_LAB.right.setPose("Spell_Simple_Idle_Loop", 0.4, false);
  });
  const swapFrames = [];
  const swapHashes = [];
  for (let i = 0; i < 4; i++) {
    const file = path.join(frameDir, `swap-a-${i}.png`);
    await page.screenshot({ path: file });
    swapHashes.push(sha(await readFile(file)));
    swapFrames.push(file);
    await page.waitForTimeout(90);
  }
  await page.evaluate(() => CHARACTER_LAB.outfit("body"));
  await page.waitForTimeout(120);
  for (let i = 0; i < 4; i++) {
    const file = path.join(frameDir, `swap-b-${i}.png`);
    await page.screenshot({ path: file });
    swapHashes.push(sha(await readFile(file)));
    swapFrames.push(file);
    await page.waitForTimeout(90);
  }
  await page.evaluate(() => CHARACTER_LAB.outfit("full"));
  await page.waitForTimeout(120);
  for (let i = 0; i < 4; i++) {
    const file = path.join(frameDir, `swap-c-${i}.png`);
    await page.screenshot({ path: file });
    swapHashes.push(sha(await readFile(file)));
    swapFrames.push(file);
    await page.waitForTimeout(90);
  }
  const swapGif = path.join(outDir, "m1-swap.gif");
  await makeGif(swapFrames, swapGif, 110);
  report.gifs.swap = {
    path: swapGif,
    unique: new Set(swapHashes).size,
    frames: swapFrames.length,
    hashes: swapHashes,
  };
  if (new Set(swapHashes).size < 6) {
    report.ok = false;
    report.errors.push(`swap GIF only ${new Set(swapHashes).size} unique frames`);
  }

  await page.evaluate(() => {
    CHARACTER_LAB.view("front");
    CHARACTER_LAB.left.setPose("Spell_Simple_Idle_Loop", 0, false);
    CHARACTER_LAB.right.setPose("Walk_Loop", 0.45, false);
    CHARACTER_LAB.left.setPaused(false);
    CHARACTER_LAB.right.setPaused(false);
  });

  report.pageErrors = pageErrors;
  if (pageErrors.length) {
    report.ok = false;
    report.errors.push(`pageerror: ${pageErrors.join(" | ")}`);
  }

  const summaryPath = path.join(outDir, "m1-validate.json");
  await writeFile(summaryPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, errors: report.errors, checks: report.checks, gifs: Object.fromEntries(Object.entries(report.gifs).map(([k, v]) => [k, { path: v.path, unique: v.unique, frames: v.frames }])), summaryPath }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
