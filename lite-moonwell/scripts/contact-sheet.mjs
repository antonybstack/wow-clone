/** Live Lite motion sheets for Human / Orc / Undead animated bodies. Canvas #viewport only. */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(".");
const OUT_ROOT = path.resolve("ve-capture", "m2-motion");
const PINNED = {
  human: "38e80f30e13a5aa1fa318aef1c804cf58bd442b76b83bcf419e90bbf88c99c1c",
  orc: "5617c9df254da40c19d58a50985b8a7aba9f7d309c12d79f5cc815ee21d46b64",
  undead: "39da9c67fbd15699166fdede1e396d2639b7cc537e077f4913fc7cc23e932b25",
};
const PROFILES = [
  { id: "human", url: "/characters/bodies/human-animated-v1.glb", glb: "public/characters/bodies/human-animated-v1.glb" },
  { id: "orc", url: "/characters/bodies/orc-animated-v1.glb", glb: "public/characters/bodies/orc-animated-v1.glb" },
  { id: "undead", url: "/characters/bodies/undead-animated-v1.glb", glb: "public/characters/bodies/undead-animated-v1.glb" },
];
const CLIP_FRAMES = {
  idle: [1, 32, 64],
  walk: [10, 20, 30],
  run: [8, 16, 24],
};
const FPS = 30;
const PREVIEW_URL = "http://127.0.0.1:5180/body-preview.html?m2-motion=1";

const errors = [];
const report = { ok: false, liveRuntimeEvidence: true, profiles: {}, dropdown: null, hashes: {} };

function recordError(phase, text) {
  errors.push({ phase, text });
}

async function sha256File(file) {
  const buf = await readFile(file);
  return createHash("sha256").update(buf).digest("hex");
}

function timeForFrame(frame, duration) {
  const t = (frame - 1) / FPS;
  if (!Number.isFinite(duration) || duration <= 0) return Math.max(0, t);
  return Math.min(Math.max(0, t), Math.max(0, duration - 1e-4));
}

function stanceTimes(footContact, clip, duration) {
  const sf = footContact?.[clip]?.stanceFrames || {};
  const frames = new Set();
  for (const key of ["leftHeel", "rightHeel", "leftToe", "rightToe"]) {
    const pair = sf[key];
    if (!Array.isArray(pair) || !pair.length) continue;
    const a = pair[0];
    const b = pair[pair.length - 1];
    frames.add(a);
    frames.add(Math.round((a + b) / 2));
    frames.add(b);
  }
  if (!frames.size) return [{ frame: 1, time: 0 }];
  return [...frames]
    .sort((x, y) => x - y)
    .map((frame) => ({ frame, time: timeForFrame(frame, duration) }));
}

async function waitReady(page) {
  await page.waitForFunction(
    () => {
      const preview = globalThis.BODY_PREVIEW;
      const status = document.getElementById("status")?.textContent || "";
      const err = document.getElementById("error");
      if (err && !err.hidden && err.textContent) return false;
      return (
        preview?.ready === true &&
        typeof preview.selectedUrl === "string" &&
        typeof preview.measureGroundedSole === "function" &&
        status.includes(preview.selectedUrl) &&
        !status.startsWith("Loading")
      );
    },
    null,
    { timeout: 180000 },
  );
}

async function waitRendered(page) {
  const n = await page.evaluate(() => BODY_PREVIEW.metrics.count);
  try {
    await page.waitForFunction((start) => BODY_PREVIEW.metrics.count > start + 1, n, { timeout: 8000 });
  } catch {
    await page.waitForTimeout(500);
  }
}

function tileSheet(cells, outFile) {
  const args = [outFile, ...cells.map((c) => `${c.file}|${c.label}`)];
  const py = `
from PIL import Image, ImageDraw, ImageFont
import sys
out = sys.argv[1]
cells = []
for spec in sys.argv[2:]:
    path, label = spec.split("|", 1)
    im = Image.open(path).convert("RGB")
    cells.append((im, label))
if not cells:
    raise SystemExit("no cells")
w, h = cells[0][0].size
cols = 3
rows = (len(cells) + cols - 1) // cols
sheet = Image.new("RGB", (w * cols, h * rows), (16, 14, 12))
draw = ImageDraw.Draw(sheet)
font = ImageFont.load_default()
for i, (im, label) in enumerate(cells):
    r, c = divmod(i, cols)
    x, y = c * w, r * h
    sheet.paste(im, (x, y))
    draw.rectangle((x, y, x + 220, y + 18), fill=(16, 14, 12))
    draw.text((x + 6, y + 3), label, fill=(231, 229, 223), font=font)
sheet.save(out)
print(f"{sheet.size[0]}x{sheet.size[1]}")
`;
  const result = spawnSync("python3", ["-c", py, ...args], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`sheet tile failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

await mkdir(OUT_ROOT, { recursive: true });

for (const profile of PROFILES) {
  const hash = await sha256File(path.join(ROOT, profile.glb));
  report.hashes[profile.id] = { file: profile.glb, sha256: hash, pinned: PINNED[profile.id], match: hash === PINNED[profile.id] };
}

let browser;
try {
  browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
} catch (error) {
  report.failure = `CDP unavailable: ${error.message}`;
  await writeFile(path.join(OUT_ROOT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: false, failure: report.failure }, null, 2));
  process.exit(1);
}

const context = browser.contexts()[0];
const page =
  context.pages().find((p) => p.url().includes("body-preview")) || (await context.newPage());
page.on("pageerror", (e) => recordError("pageerror", e.message));
page.on("console", (m) => {
  if (m.type() === "error") recordError("console", m.text());
});

try {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.bringToFront();
  const alreadyReady = await page
    .evaluate(() => {
      const preview = globalThis.BODY_PREVIEW;
      const status = document.getElementById("status")?.textContent || "";
      return !!(
        location.pathname.endsWith("/body-preview.html") &&
        preview?.ready === true &&
        typeof preview.measureGroundedSole === "function" &&
        typeof preview.selectedUrl === "string" &&
        status.includes(preview.selectedUrl) &&
        !status.startsWith("Loading")
      );
    })
    .catch(() => false);
  if (!alreadyReady) {
    await page.goto(PREVIEW_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  }
  try {
    await waitReady(page);
  } catch (error) {
    const snapshot = await page
      .evaluate(() => {
        const err = document.getElementById("error");
        const preview = globalThis.BODY_PREVIEW;
        return {
          href: location.href,
          ready: preview?.ready ?? null,
          selectedUrl: preview?.selectedUrl ?? null,
          hasMeasure: typeof preview?.measureGroundedSole,
          status: document.getElementById("status")?.textContent || "",
          errorText: err?.textContent || "",
        };
      })
      .catch((e) => ({ evalError: e.message }));
    throw new Error(`waitReady failed: ${error.message} snapshot=${JSON.stringify(snapshot)}`);
  }
  await page.evaluate(() => BODY_PREVIEW.setChromeVisible(false));

  report.dropdown = await page.evaluate(() => {
    const options = [...document.querySelectorAll("#asset option")].map((o) => ({
      value: o.value,
      text: o.textContent,
      disabled: o.disabled,
    }));
    return { options, note: document.getElementById("asset-note")?.textContent || "", diagnostics: BODY_PREVIEW.diagnostics().animatedCandidates };
  });

  const viewport = page.locator("#viewport");

  for (const profile of PROFILES) {
    const out = path.join(OUT_ROOT, profile.id);
    await mkdir(out, { recursive: true });
    const bake = JSON.parse(await readFile(path.join(ROOT, "ve-capture", `m2e-${profile.id}-animation`, "bake-report.json"), "utf8"));
    const footContact = bake.footContact || {};

    await page.evaluate((url) => BODY_PREVIEW.load(url), profile.url);
    await waitReady(page);
    await page.waitForFunction((url) => BODY_PREVIEW.selectedUrl === url && BODY_PREVIEW.clipNames.includes("idle"), profile.url, {
      timeout: 60000,
    });

    const beforeUi = await page.evaluate(() => {
      BODY_PREVIEW.setClip("idle", 0, true);
      const idlePal = BODY_PREVIEW.samplePalette();
      return { idlePal, clipNames: BODY_PREVIEW.clipNames, clips: BODY_PREVIEW.diagnostics().clips };
    });

    const uiClip = await page.evaluate(async () => {
      const sel = document.getElementById("clip");
      sel.value = "walk";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(r));
      const afterSelect = { clip: BODY_PREVIEW.diagnostics().clip, time: BODY_PREVIEW.diagnostics().time };
      const palWalk0 = BODY_PREVIEW.samplePalette();
      const scrub = document.getElementById("scrub");
      const dur = BODY_PREVIEW.diagnostics().clips.find((c) => c.name === "walk")?.duration || 1;
      const t = Math.min(dur * 0.35, dur);
      scrub.value = String(t);
      scrub.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(r));
      const afterScrub = { clip: BODY_PREVIEW.diagnostics().clip, time: BODY_PREVIEW.diagnostics().time };
      const palWalk1 = BODY_PREVIEW.samplePalette();
      return {
        afterSelect,
        afterScrub,
        paletteIdleToWalk: JSON.stringify(BODY_PREVIEW.samplePalette()) !== "placeholder",
        palWalkChanged: JSON.stringify(palWalk0) !== JSON.stringify(palWalk1),
        palIdleVsWalk: null,
        palWalk0: palWalk0.length,
        palWalk1: palWalk1.length,
        durationWalk: dur,
        t,
      };
    });

    const palCheck = await page.evaluate(() => {
      BODY_PREVIEW.setClip("idle", 0, true);
      const idle = BODY_PREVIEW.samplePalette();
      BODY_PREVIEW.setClip("walk", 0, true);
      const walk0 = BODY_PREVIEW.samplePalette();
      const dur = BODY_PREVIEW.diagnostics().clips.find((c) => c.name === "walk")?.duration || 1;
      BODY_PREVIEW.seek(Math.min(dur * 0.35, dur));
      const walk1 = BODY_PREVIEW.samplePalette();
      return {
        idleToWalk: JSON.stringify(idle) !== JSON.stringify(walk0),
        walkScrub: JSON.stringify(walk0) !== JSON.stringify(walk1),
        clip: BODY_PREVIEW.diagnostics().clip,
        time: BODY_PREVIEW.diagnostics().time,
      };
    });
    uiClip.palIdleVsWalk = palCheck.idleToWalk;
    uiClip.palWalkChanged = palCheck.walkScrub;

    await page.evaluate(() => {
      BODY_PREVIEW.setChromeVisible(false);
      BODY_PREVIEW.view("front");
      BODY_PREVIEW.pause(true);
    });

    const cells = [];
    const clipStills = {};
    for (const clip of ["idle", "walk", "run"]) {
      const meta = beforeUi.clips.find((c) => c.name === clip);
      if (!meta) throw new Error(`${profile.id} missing clip ${clip}`);
      const frames = CLIP_FRAMES[clip];
      const captured = [];
      for (let i = 0; i < frames.length; i++) {
        const t = timeForFrame(frames[i], meta.duration);
        await page.evaluate(
          ({ clip: name, time }) => {
            BODY_PREVIEW.setClip(name, time, true);
            BODY_PREVIEW.seek(time);
            BODY_PREVIEW.view("front");
          },
          { clip, time: t },
        );
        await waitRendered(page);
        await page.waitForTimeout(450);
        const frameFile = path.join(out, `${clip}-${String(i).padStart(2, "0")}.png`);
        await viewport.screenshot({ path: frameFile });
        captured.push({ frame: frames[i], time: t, file: frameFile });
        cells.push({ file: frameFile, label: `${profile.id} ${clip} f${frames[i]} ${t.toFixed(2)}s` });
      }
      const still = path.join(out, `${clip}.png`);
      await copyFile(captured[0].file, still);
      clipStills[clip] = { file: still, frames: captured };
    }

    const sole = {};
    for (const clip of ["idle", "walk"]) {
      const meta = beforeUi.clips.find((c) => c.name === clip);
      const times = stanceTimes(footContact, clip, meta.duration);
      const samples = [];
      for (const { frame, time: t } of times) {
        await page.evaluate(
          ({ clip: name, time }) => {
            BODY_PREVIEW.setClip(name, time, true);
            BODY_PREVIEW.seek(time);
          },
          { clip, time: t },
        );
        await waitRendered(page);
        const measured = await page.evaluate(() => BODY_PREVIEW.measureGroundedSole());
        samples.push({ frame, time: t, ...measured });
      }
      const vertexYs = samples.map((s) => s.vertexMinY).filter((y) => y != null);
      const minY = vertexYs.length ? Math.min(...vertexYs) : samples[0]?.aabbMinY ?? null;
      const blender = footContact[clip]?.stanceSoleMinZAfterM ?? null;
      const delta = minY != null && blender != null ? minY - blender : null;
      sole[clip] = {
        blenderStanceSoleMinZAfterM: blender,
        liteMinY: minY,
        deltaM: delta,
        within1cm: delta != null && Math.abs(delta) <= 0.01,
        samples,
      };
    }

    const sheetSize = tileSheet(cells, path.join(out, "sheet.png"));
    report.profiles[profile.id] = {
      url: profile.url,
      clipNames: beforeUi.clipNames,
      ui: uiClip,
      clipSelectChanged: uiClip.afterSelect.clip === "walk",
      scrubChangedTime: (uiClip.afterScrub.time ?? 0) > 0,
      paletteIdleToWalk: palCheck.idleToWalk,
      paletteWalkScrub: palCheck.walkScrub,
      clips: clipStills,
      sole,
      sheet: { file: path.join(out, "sheet.png"), size: sheetSize },
      hash: report.hashes[profile.id],
    };
  }

  await page.evaluate(async () => {
    await BODY_PREVIEW.load("/characters/bodies/human-v1.glb");
    BODY_PREVIEW.view("front");
  });
  await waitReady(page);
  report.dropdownAfter = await page.evaluate(() => ({
    selected: BODY_PREVIEW.selectedUrl,
    assetValue: document.getElementById("asset")?.value,
    clipDisabled: document.getElementById("clip")?.disabled,
    clipText: document.getElementById("clip")?.selectedOptions?.[0]?.textContent,
  }));

  const unexpected = errors.filter((e) => !e.text.includes("blob:"));
  report.consoleErrors = errors;
  report.ok =
    report.hashes.human.match &&
    report.hashes.orc.match &&
    report.hashes.undead.match &&
    report.profiles.human?.clipSelectChanged === true &&
    report.profiles.orc?.clipSelectChanged === true &&
    report.profiles.undead?.clipSelectChanged === true;
  if (unexpected.length) report.consoleNote = unexpected.map((e) => e.text).slice(0, 8);
} catch (error) {
  report.failure = error.stack;
  process.exitCode = 1;
} finally {
  report.errors = errors;
  await writeFile(path.join(OUT_ROOT, "report.json"), JSON.stringify(report, null, 2));
  const summary = {
    ok: report.ok,
    failure: report.failure,
    hashes: report.hashes,
    dropdown: report.dropdown,
    soles: Object.fromEntries(
      Object.entries(report.profiles).map(([id, p]) => [
        id,
        {
          idle: p.sole?.idle,
          walk: p.sole?.walk,
          clipSelect: p.clipSelectChanged,
          scrub: p.scrubChangedTime,
          paletteIdleToWalk: p.paletteIdleToWalk,
          paletteWalkScrub: p.paletteWalkScrub,
        },
      ]),
    ),
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(process.exitCode || 0);
}
