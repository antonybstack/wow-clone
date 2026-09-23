/**
 * Esc game-menu hub. Hidden until opened. Parent wires createGameMenu from main.js.
 */
import { setInputEnabled } from "../input.js";

const UNLOCK_GUARD_MS = 200;

function isArmoryOpen() {
  return document.body.classList.contains("armory-open");
}

function isDeathVeilUp() {
  const veil = document.querySelector(".death-veil");
  return !!(veil && !veil.hidden);
}

function soundToggleButton() {
  return document.querySelector(".sound-toggle");
}

function syncDevQuery(on) {
  const params = new URLSearchParams(location.search);
  params.delete("dev");
  const rest = params.toString();
  const search = on ? (rest ? `?dev&${rest}` : "?dev") : rest ? `?${rest}` : "";
  history.replaceState(null, "", `${location.pathname}${search}${location.hash}`);
  document.body.classList.toggle("dev-mode", on);
  return on;
}

function devQueryOn() {
  return new URLSearchParams(location.search).has("dev") || document.body.classList.contains("dev-mode");
}

export function createGameMenu({ onArmory, onSound, onDev, onMetrics } = {}) {
  const root = document.createElement("div");
  root.id = "game-menu";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "game-menu-title");
  root.innerHTML = `
    <div class="game-menu-panel">
      <div class="game-menu-hub">
        <h1 id="game-menu-title">Ashen Reach</h1>
        <p>Paused</p>
        <div class="game-menu-buttons">
          <button type="button" data-action="resume">Resume <kbd>Esc</kbd></button>
          <button type="button" data-action="armory">Armory <kbd>C</kbd></button>
          <button type="button" data-action="sound">Sound</button>
          <button type="button" data-action="keys">Keybindings</button>
          <button type="button" data-action="dev" aria-pressed="false">Dev mode</button>
          <button type="button" data-action="metrics" aria-pressed="true">Hide Metrics</button>
        </div>
      </div>
      <div class="game-menu-keys" hidden>
        <h1>Keybindings</h1>
        <ul>
          <li><span>Move / turn</span><kbd>WASD</kbd></li>
          <li><span>Look</span><kbd>RMB</kbd></li>
          <li><span>Jump</span><kbd>Space</kbd></li>
          <li><span>Target</span><kbd>Tab</kbd></li>
          <li><span>Auto attack</span><kbd>T</kbd></li>
          <li><span>Fire Blast / Lava Ball / Pyre Burst</span><kbd>1 / 2 / 3</kbd></li>
          <li><span>Armory</span><kbd>C</kbd></li>
          <li><span>Camera</span><kbd>V</kbd></li>
          <li><span>Reset</span><kbd>R</kbd></li>
          <li><span>Hide HUD</span><kbd>H</kbd></li>
          <li><span>God / fly (upcoming with ?dev)</span><kbd>G / F</kbd></li>
          <li><span>Menu</span><kbd>Esc</kbd></li>
        </ul>
        <button type="button" data-action="hub">Back</button>
      </div>
    </div>`;
  document.body.append(root);

  const hub = root.querySelector(".game-menu-hub");
  const keysPane = root.querySelector(".game-menu-keys");
  const soundBtn = root.querySelector('[data-action="sound"]');
  const devBtn = root.querySelector('[data-action="dev"]');
  const metricsBtn = root.querySelector('[data-action="metrics"]');

  const overlay = document.createElement("div");
  overlay.id = "metrics-overlay";
  overlay.hidden = true;
  overlay.setAttribute("aria-live", "off");
  document.body.append(overlay);

  let visible = false;
  let unlockedAt = 0;
  let metricsTimer = 0;

  document.addEventListener("pointerlockchange", () => {
    if (!document.pointerLockElement) unlockedAt = performance.now();
  });

  function restoreInput() {
    if (isDeathVeilUp() || isArmoryOpen()) return;
    setInputEnabled(true);
  }

  function showHub() {
    keysPane.hidden = true;
    hub.hidden = false;
  }

  function paintSound() {
    const toggle = soundToggleButton();
    if (!toggle) {
      soundBtn.textContent = "Sound";
      return;
    }
    const muted = toggle.getAttribute("aria-pressed") === "true" || /mute/i.test(toggle.textContent || "");
    soundBtn.textContent = muted ? "Sound: muted" : "Sound: on";
  }

  function paintDev() {
    const on = devQueryOn();
    devBtn.setAttribute("aria-pressed", String(on));
    devBtn.textContent = on ? "Dev mode: on" : "Dev mode";
  }

  function paintMetricsButton() {
    const on = !overlay.hidden;
    metricsBtn.setAttribute("aria-pressed", String(on));
    metricsBtn.textContent = on ? "Hide Metrics" : "Show Metrics";
  }

  function paintMetrics() {
    if (overlay.hidden) return;
    const metrics = globalThis.ASHEN?.metrics;
    if (!metrics?.summary) {
      overlay.textContent = "FPS  —";
      return;
    }
    const s = metrics.summary();
    const fps = s.fps ? s.fps.toFixed(0) : "—";
    const mean = s.samples ? s.meanMs.toFixed(2) : "—";
    const p95 = s.samples ? s.p95Ms.toFixed(2) : "—";
    const res = s.resolution;
    const size = Array.isArray(res) && res.length >= 2 ? `${res[0]}×${res[1]}` : "—";
    overlay.textContent = `FPS  ${fps}\n${mean} ms mean\n${p95} ms p95\n${size}`;
  }

  function setMetricsVisible(on) {
    overlay.hidden = !on;
    if (on) {
      paintMetrics();
      if (!metricsTimer) metricsTimer = setInterval(paintMetrics, 1000);
    } else if (metricsTimer) {
      clearInterval(metricsTimer);
      metricsTimer = 0;
    }
    paintMetricsButton();
  }

  function focusFirst() {
    const pane = keysPane.hidden ? hub : keysPane;
    pane.querySelector("button")?.focus();
  }

  function open() {
    if (visible || isArmoryOpen()) return;
    visible = true;
    showHub();
    paintSound();
    paintDev();
    paintMetricsButton();
    setInputEnabled(false);
    root.hidden = false;
    document.body.classList.add("game-menu-open");
    focusFirst();
  }

  function close() {
    if (!visible) return;
    visible = false;
    showHub();
    root.hidden = true;
    document.body.classList.remove("game-menu-open");
    restoreInput();
    const canvas = document.getElementById("renderCanvas");
    canvas?.focus();
  }

  function toggleSound() {
    if (onSound) onSound();
    else soundToggleButton()?.click();
    paintSound();
  }

  function toggleDev() {
    if (onDev) onDev();
    else syncDevQuery(!devQueryOn());
    paintDev();
  }

  function toggleMetrics() {
    setMetricsVisible(overlay.hidden);
    onMetrics?.();
  }

  function chooseArmory() {
    close();
    if (onArmory) onArmory();
    else document.getElementById("armory-launch")?.click();
  }

  root.addEventListener("click", (event) => {
    if (event.target === root) {
      close();
      return;
    }
    const button = event.target.closest("button[data-action]");
    if (!button || !root.contains(button)) return;
    const action = button.dataset.action;
    if (action === "resume") close();
    else if (action === "armory") chooseArmory();
    else if (action === "sound") toggleSound();
    else if (action === "keys") {
      hub.hidden = true;
      keysPane.hidden = false;
      keysPane.querySelector("button")?.focus();
    } else if (action === "hub") {
      showHub();
      focusFirst();
    } else if (action === "dev") toggleDev();
    else if (action === "metrics") toggleMetrics();
  });

  window.addEventListener(
    "keydown",
    (event) => {
      if (event.code !== "Escape" && !visible) return;
      if (visible && isArmoryOpen()) {
        close();
        return;
      }
      if (visible && event.code === "KeyC" && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey) {
        chooseArmory();
        return;
      }
      if (event.code === "Escape") {
        if (event.repeat) return;
        if (document.pointerLockElement) return;
        if (performance.now() - unlockedAt < UNLOCK_GUARD_MS) return;
        if (isArmoryOpen()) return;
        event.preventDefault();
        event.stopPropagation();
        if (visible) close();
        else open();
        return;
      }
      if (!visible) return;
      if (event.code === "Tab") {
        const pane = keysPane.hidden ? hub : keysPane;
        const controls = [...pane.querySelectorAll("button")];
        if (!controls.length) return;
        const i = controls.indexOf(document.activeElement);
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) controls[i <= 0 ? controls.length - 1 : i - 1].focus();
        else controls[i === controls.length - 1 || i < 0 ? 0 : i + 1].focus();
        return;
      }
      event.stopPropagation();
    },
    true,
  );

  setMetricsVisible(true);

  return {
    open,
    close,
    get isOpen() {
      return visible;
    },
    element: root,
  };
}
