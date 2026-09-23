/** Merged M7b+M8a+M8b walkthrough. Does not close Chrome. */
import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
import fs from "node:fs/promises";

const dir = process.env.ASHEN_CAPTURE_DIR || "ve-capture/ashen-reach/merged-m7b-m8/video";
await fs.mkdir(dir + "/frames", { recursive: true });

const browser = await chromium.connectOverCDP(CDP_URL);
const page =
  browser.contexts()[0].pages().find((p) => p.url().includes("ashen-reach.html")) ||
  (await browser.contexts()[0].newPage());

let cdp;
let recording = false;
const frames = [];
const writes = [];
const errors = [];
const timeline = [];
const wait = (ms) => page.waitForTimeout(ms);

async function plant({ x, z, yaw, pitch = 0.08, dist = 3.5 }) {
  await page.evaluate(
    ({ x, z, yaw, pitch, dist }) => {
      const A = window.ASHEN;
      const y = A.world.groundHeight(x, z) + A.player.capsuleHeight / 2;
      A.player.setWorldPos(x, y, z);
      A.player.setFacing(yaw);
      A.rig.yaw = yaw;
      A.rig.pitch = pitch;
      A.rig.distance = A.rig.distanceTarget = dist;
      A.setView("play");
    },
    { x, z, yaw, pitch, dist },
  );
}

try {
  await page.setViewportSize({ width: 960, height: 540 });
  await page.bringToFront();
  const url = process.env.ASHEN_URL || "http://127.0.0.1:5173/ashen-reach.html?play&clean";
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => window.ASHEN?.ready, null, { timeout: 90000 });
  await wait(900);

  let audioStart = Date.now() / 1000;
  try {
    audioStart = await page.evaluate(() => {
      const capture = ASHEN.combat.audio.capture();
      const recorder = new MediaRecorder(capture.stream, { mimeType: "audio/webm;codecs=opus" });
      const chunks = [];
      const done = new Promise((resolve) => { recorder.onstop = resolve; });
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      window.__spellAudio = { capture, recorder, chunks, done };
      recorder.start(250);
      return Date.now() / 1000;
    });
  } catch (error) {
    errors.push("audio start: " + error.message);
  }

  cdp = await page.context().newCDPSession(page);
  cdp.on("Page.screencastFrame", (event) => {
    cdp.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
    if (!recording) return;
    const name = `frame-${String(frames.length).padStart(5, "0")}.jpg`;
    frames.push({ name, time: event.metadata.timestamp });
    writes.push(fs.writeFile(dir + "/frames/" + name, Buffer.from(event.data, "base64")));
  });

  const start = Date.now();
  recording = true;
  await cdp.send("Page.startScreencast", {
    format: "jpeg", quality: 85, maxWidth: 1280, maxHeight: 720, everyNthFrame: 3,
  });
  const mark = (label) => timeline.push({ seconds: (Date.now() - start) / 1000, label });

  mark("churchyard shade");
  await plant({ x: 1.2, z: 14, yaw: 0.4, pitch: 0.12, dist: 3.2 });
  await wait(1400);

  mark("climb to gate");
  await plant({ x: 0.2, z: 70, yaw: 0, pitch: 0.08, dist: 4.0 });
  await page.keyboard.down("KeyW");
  await wait(1800);
  await page.keyboard.up("KeyW");
  await wait(300);

  mark("street lamps and people");
  await plant({ x: 0.2, z: 92, yaw: -0.4, pitch: 0.1, dist: 3.8 });
  await page.keyboard.down("KeyW");
  await wait(1600);
  await page.keyboard.up("KeyW");
  await wait(300);

  mark("well square");
  await plant({ x: 0, z: 128, yaw: 0, pitch: 0.1, dist: 3.6 });
  await page.keyboard.down("KeyW");
  await wait(1400);
  await page.keyboard.up("KeyW");
  await wait(400);

  mark("stall close");
  await plant({ x: 0.4, z: 133.3, yaw: -1.32, pitch: 0.05, dist: 3.2 });
  await wait(1100);

  recording = false;
  await cdp.send("Page.stopScreencast");
  await Promise.all(writes);

  try {
    const audioData = await page.evaluate(async () => {
      const a = window.__spellAudio;
      if (!a) return null;
      a.recorder.stop();
      await a.done;
      const blob = new Blob(a.chunks, { type: "audio/webm" });
      const reader = new FileReader();
      const data = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.readAsDataURL(blob);
      });
      a.capture.dispose();
      delete window.__spellAudio;
      return data;
    });
    if (audioData) await fs.writeFile(dir + "/audio.webm", Buffer.from(audioData, "base64"));
  } catch (error) {
    errors.push("audio stop: " + error.message);
  }

  let concat = "ffconcat version 1.0\n";
  for (let i = 0; i < frames.length; i++) {
    concat += `file 'frames/${frames[i].name}'\n`;
    if (i + 1 < frames.length) {
      concat += `duration ${Math.max(0.001, frames[i + 1].time - frames[i].time).toFixed(6)}\n`;
    }
  }
  await fs.writeFile(dir + "/frames.ffconcat", concat);
  await fs.writeFile(dir + "/recording.json", JSON.stringify({
    frames: frames.length,
    seconds: frames.length ? frames.at(-1).time - frames[0].time : 0,
    timeline,
    errors,
    audioOffset: frames.length ? frames[0].time - audioStart : 0,
  }, null, 2));
  console.log(JSON.stringify({
    frames: frames.length,
    seconds: frames.length ? Math.round(frames.at(-1).time - frames[0].time) : 0,
    errors,
  }));
} finally {
  recording = false;
  await page.keyboard.up("KeyW").catch(() => {});
  await page.evaluate(() => {
    const a = window.__spellAudio;
    if (a) {
      if (a.recorder.state !== "inactive") a.recorder.stop();
      a.capture.dispose();
      delete window.__spellAudio;
    }
  }).catch(() => {});
  if (cdp) await cdp.detach();
  process.exit(errors.filter((e) => !e.startsWith("audio")).length ? 1 : 0);
}
