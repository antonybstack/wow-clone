/**
 * Esc game-menu hub. Hidden until opened. Parent wires createGameMenu from main.js.
 */
import {actionBindings,ACTION_BINDING_KEYS,bindingLabel} from '../action-bindings.js';
import { setInputEnabled } from "../input.js";
import { regionProgressLabel } from './region-progress.js';

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

export function createGameMenu({ onArmory, onSound, onDev, onMetrics, getDevTools, getRegionMap, getJournal, getExploration, getCombat } = {}) {
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
          <button type="button" data-action="region-map">Region map</button>
          <button type="button" data-action="journal">Journal</button>
          <button type="button" data-action="sound">Sound</button>
          <button type="button" data-action="keys">Keybindings</button>
          <button type="button" data-action="dev" aria-pressed="false">Developer mode</button>
          <button type="button" data-action="developer-tools" data-dev-only hidden>Developer tools</button>
          <button type="button" data-action="metrics" aria-pressed="false">Show performance</button>
        </div>
      </div>
      <div class="game-menu-map" hidden>
        <h1 id="region-map-title">Region map</h1>
        <p>Explore Ashen Reach · North is up</p>
        <div data-region-map><p role="status">Preparing the region map…</p></div>
        <button type="button" data-action="hub">Back</button>
      </div>
      <div class="game-menu-dev" hidden>
        <h1>Developer tools</h1>
        <p data-dev-status role="status">Loading developer tools…</p>
        <div class="game-menu-buttons">
          <label for="dev-destination">Destination</label>
          <select id="dev-destination" aria-label="Destination"></select>
          <button type="button" data-action="jump" disabled>Jump to destination</button>
          <label for="dev-destination-link">Spawn link — select and copy</label>
          <input id="dev-destination-link" type="url" readonly aria-label="Spawn link">
          <button type="button" data-action="god" aria-pressed="false">God mode</button>
          <button type="button" data-action="fly" aria-pressed="false">Fly mode</button>
          <p>While flying, click a solid surface to teleport (floors, roofs or ground). G / F also toggle God / Fly.</p>
          <p data-region-loading-mode></p>
          <button type="button" data-action="region-loading" disabled>Reload with whole-region loading</button>
          <p data-exploration-status role="status"></p>
          <p data-render-resolution></p>
          <button type="button" data-action="render-native">Render at viewport size (DPR 1)</button>
          <button type="button" data-action="render-1280">Render 1280 pixels wide (keep aspect)</button>
          <label for="dev-combat-scenario">Combat rehearsal</label>
          <select id="dev-combat-scenario" aria-label="Combat rehearsal"></select>
          <p data-combat-status role="status"></p>
          <button type="button" data-action="combat-scenario" disabled>Start combat rehearsal</button>
          <button type="button" data-action="combat-restore" disabled>Restore before rehearsal</button>
          <button type="button" data-action="combat-trace" disabled>Download combat timing trace</button>
          <button type="button" data-action="combat-trace-clear" disabled>Clear combat trace</button>
          <p>Diagnostic placement restores health and mana; God / Fly are off. Rehearsal rewards and journal writes are disabled. Restore returns actors, resources and your position. Timing trace keeps the last 512 events.</p>
          <button type="button" data-action="exploration-reset" disabled>Reset exploration for this session</button>
          <p>Rehearsal progress lasts until reload; your saved journal is preserved.</p>
          <button type="button" data-action="hub">Back</button>
        </div>
      </div>
      <div class="game-menu-journal" hidden>
        <h1 id="journal-title">Journal</h1>
        <div data-journal><p role="status">Preparing the journal…</p></div>
        <div class="game-menu-buttons">
          <button type="button" data-action="journal-guide">Open Vaelmark guide</button>
          <button type="button" data-action="journal-region-map">Open region map</button>
          <button type="button" data-action="hub">Back</button>
        </div>
      </div>
      <div class="game-menu-keys" hidden>
        <h1>Keybindings</h1>
        <div class="combat-bindings">${[[1,'Fire Blast'],[2,'Lava Ball'],[3,'Pyre Burst'],[4,'Ashen Brand'],['attack','Attack']].map(([id,name])=>`<label>${name} key <select data-combat-binding="${id}" aria-label="${name} key">${ACTION_BINDING_KEYS.map(code=>`<option value="${code}">${bindingLabel(code)}</option>`).join('')}</select></label>`).join('')}</div>
        <button type="button" data-reset-combat-keys>Reset combat keys</button>
        <p data-binding-status role="status">Combat keys are saved on this browser. Number-pad keys follow their matching digit.</p>
        <label for="combat-queue-window">Spell queue window</label>
        <select id="combat-queue-window" aria-label="Spell queue window">
          <option value="0">Off</option><option value="0.1">100 ms</option>
          <option value="0.2">200 ms</option><option value="0.3" selected>300 ms</option>
          <option value="0.4">400 ms</option>
        </select>
        <p>Press your next spell near the end of a cast or cooldown to queue it. Escape stops your cast and clears its queued spell.</p>
        <ul class="desktop-keys">
          <li><span>Move / turn</span><kbd>WASD</kbd></li>
          <li><span>Look</span><kbd>RMB</kbd></li>
          <li><span>Jump</span><kbd>Space</kbd></li>
          <li><span>Target</span><kbd>Tab</kbd></li>


          <li><span>Armory</span><kbd>C</kbd></li>
          <li><span>Interact with nearby discoveries</span><kbd>X</kbd></li>
          <li><span>Camera</span><kbd>V</kbd></li>
          <li><span>Reset</span><kbd>R</kbd></li>
          <li><span>Hide help</span><kbd>H</kbd></li>
          <li data-dev-only hidden><span>Developer: god / fly / teleport</span><kbd>G / F / click</kbd></li>
          <li><span>Menu</span><kbd>Esc</kbd></li>
        </ul>
        <ul class="touch-keys" hidden>
          <li><span>Move / strafe</span><kbd>Left stick</kbd></li>
          <li><span>Look / select</span><kbd>Drag / tap world</kbd></li>
          <li><span>Target / attack / jump</span><kbd>Bottom buttons</kbd></li>
          <li><span>Cast spells</span><kbd>1 / 2 / 3 icons</kbd></li>
          <li><span>Armory / menu</span><kbd>Top buttons</kbd></li>
        </ul>
        <button type="button" data-action="hub">Back</button>
      </div>
    </div>`;
  document.body.append(root);

  const hub = root.querySelector(".game-menu-hub");
  const mapPane = root.querySelector('.game-menu-map');
  const panel = root.querySelector('.game-menu-panel');
  const keysPane = root.querySelector(".game-menu-keys");
  const devPane = root.querySelector(".game-menu-dev");
  const journalPane=root.querySelector('.game-menu-journal');
  const destinationSelect = root.querySelector("#dev-destination");
  const destinationLink = root.querySelector("#dev-destination-link");
  let destinationSource;
  const bindingSelects = [...root.querySelectorAll('[data-combat-binding]')];
  const syncBindings = () => { for (const select of bindingSelects) select.value=actionBindings.key(select.dataset.combatBinding); };
  const bindingStatus=root.querySelector('[data-binding-status]');
  for (const select of bindingSelects) select.addEventListener('change',()=>{
    const result=actionBindings.set(select.dataset.combatBinding,select.value);
    bindingStatus.textContent=result.ok?(result.saved?'Combat key saved.':'Combat key changed for this session; browser storage is unavailable.'):result.reason;
    syncBindings();
  });
  root.querySelector('[data-reset-combat-keys]').addEventListener('click',()=>{
    const result=actionBindings.reset();syncBindings();bindingStatus.textContent=result.saved?'Default combat keys restored.':'Default keys restored for this session.';
  });
  syncBindings();
  const queueSelect = root.querySelector('#combat-queue-window');
  queueSelect.addEventListener('change', () => getCombat?.()?.setQueueWindow(Number(queueSelect.value)));
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
    mapPane.hidden = true;
    journalPane.hidden = true;
    panel.classList.remove('region-map-open');
    root.setAttribute('aria-labelledby', 'game-menu-title');
    keysPane.hidden = true;
    devPane.hidden = true;
    hub.hidden = false;
  }

  function refreshRegionMap() {
    if (!mapPane.hidden) getRegionMap?.()?.open(mapPane.querySelector('[data-region-map]'));
  }

  function openJournal(){
    open();showHub();hub.hidden=true;journalPane.hidden=false;
    root.setAttribute('aria-labelledby','journal-title');
    getJournal?.()?.open(journalPane.querySelector('[data-journal]'));
    for(const button of journalPane.querySelectorAll('[data-action="journal-guide"],[data-action="journal-region-map"]'))button.disabled=!getRegionMap?.();
    focusFirst();
  }

  function paintSound() {
    const toggle = soundToggleButton();
    if (!toggle) {
      soundBtn.disabled = true;
      soundBtn.textContent = "Sound";
      return;
    }
    // Mobile reaches sound through this menu. Mirror the existing HUD control's
    // native disabled state while decoded audio is pending or unavailable.
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/disabled
    soundBtn.disabled = toggle.disabled;
    if (toggle.disabled) {
      soundBtn.textContent = toggle.textContent;
      return;
    }
    const muted = toggle.getAttribute("aria-pressed") === "true" || /mute/i.test(toggle.textContent || "");
    soundBtn.textContent = muted ? "Sound: muted" : "Sound: on";
  }

  function paintDev() {
    const on = devQueryOn();
    devBtn.setAttribute("aria-pressed", String(on));
    devBtn.textContent = on ? "Developer mode: on" : "Developer mode";
    for (const element of root.querySelectorAll("[data-dev-only]")) element.hidden = !on;
    if (!on && !devPane.hidden) showHub();
    refreshDevTools();
  }

  function refreshDevTools() {
    const tools = getDevTools?.();
    const destinations = tools?.destinations || [];
    if (destinationSource !== destinations && destinations.length) {
      // Reload comparisons keep the same destination shown in the spawn link.
      // https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams/get
      const selected = destinationSelect.value || new URLSearchParams(location.search).get('at') || "cathedral-nave";
      destinationSelect.replaceChildren(...destinations.map(d => new Option(d.name, d.id)));
      destinationSelect.value = destinations.some(d => d.id === selected) ? selected : destinations[0].id;
      destinationSource = destinations;
    }
    const enabled = devQueryOn() && !!tools?.dev?.enabled;
    const exploration=getExploration?.(),snap=exploration?.snapshot();
    root.querySelector('[data-exploration-status]').textContent=snap
      ? `Exploration: ${snap.record.phase}${snap.sessionOnly?' · session rehearsal':''}.`:'Exploration is preparing.';
    root.querySelector('[data-action="exploration-reset"]').disabled=!enabled||!exploration;
    const ready = enabled && !!tools?.navigationReady;
    const canvas = document.getElementById('renderCanvas');
    root.querySelector('[data-render-resolution]').textContent = canvas
      ? 'Internal render: ' + canvas.width + ' × ' + canvas.height + '. Benchmark 1280 × 720 in a 16:9 viewport.'
      : 'Renderer preparing.';
    for (const action of ['render-native', 'render-1280']) root.querySelector('[data-action="' + action + '"]').disabled = !enabled || !globalThis.ASHEN?.metrics;
    const combat = getCombat?.();
    const scenarioSelect = root.querySelector('#dev-combat-scenario');
    if (!scenarioSelect.options.length && combat) {
      scenarioSelect.replaceChildren(...combat.scenarios.list.map(s => new Option(s.name, s.id)));
    }
    const selectedScenario = combat?.scenarios.list.find(s => s.id === scenarioSelect.value);
    root.querySelector('[data-combat-status]').textContent = combat
      ? `${combat.scenarios.active ? 'Active rehearsal: ' + combat.scenarios.active + '. ' : ''}${selectedScenario?.note || ''} Trace: ${combat.trace.size} events (${combat.trace.dropped} older events dropped).`
      : 'Combat is preparing.';
    scenarioSelect.disabled = !enabled || !combat;
    root.querySelector('[data-action="combat-scenario"]').disabled = !ready || !combat || combat.life.dead;
    root.querySelector('[data-action="combat-restore"]').disabled = !enabled || !combat?.scenarios.active;
    for (const action of ['combat-trace', 'combat-trace-clear']) root.querySelector(`[data-action="${action}"]`).disabled = !enabled || !combat;
    destinationSelect.disabled = !destinations.length || !enabled;
    root.querySelector('[data-action="jump"]').disabled = !ready || !destinationSelect.value;
    const devStatus=root.querySelector('[data-dev-status]');
    let status = ready
      ? tools.regionReady
        ? "Region ready. Jumps return to ordinary walking."
        : "Routes ready. Details are still loading; jumps return to ordinary walking."
      : "Waiting for route geometry and collision before jumping…";
    const progress=tools?.regionProgress;
    if(!tools?.regionReady&&progress) {
      status+=` ${regionProgressLabel(progress)}`;
    }
    if(devStatus.dataset.phaseText!==status) {
      devStatus.dataset.phaseText=status;
      const count=document.createElement('span');count.setAttribute('aria-hidden','true');count.setAttribute('aria-live','off');
      devStatus.replaceChildren(document.createTextNode(status),count);
    }
    devStatus.lastElementChild.textContent=!tools?.regionReady&&progress?.total>0
      ? ` ${progress.processed} / ${progress.total} ${progress.phase==='supports'?'supports':'ranges'} processed.`:'';
    destinationLink.value = enabled && destinationSelect.value ? tools.destinationURL(destinationSelect.value) : "";
    root.querySelector('[data-region-loading-mode]').textContent=tools?.regionCoreLoading
      ? 'Region loading: physical surfaces and reduced trees first. Full tree detail loads afterwards.'
      : 'Region loading: whole-region comparison stream.';
    const loadingButton=root.querySelector('[data-action="region-loading"]');
    loadingButton.disabled=!enabled||!tools?.regionCoreAvailable;
    loadingButton.textContent=tools?.regionCoreLoading?'Reload with whole-region loading':'Reload with physical surfaces first';
    for (const [action, state, label] of [["god", "god", "God mode"], ["fly", "flying", "Fly mode"]]) {
      const button = root.querySelector(`[data-action="${action}"]`);
      button.disabled = !enabled;
      button.setAttribute("aria-pressed", String(enabled && !!tools.dev[state]));
      button.textContent = `${label}: ${enabled && tools.dev[state] ? "on" : "off"}`;
    }
  }
  destinationSelect.addEventListener("change", refreshDevTools);
  root.querySelector('#dev-combat-scenario').addEventListener('change', refreshDevTools);
  destinationLink.addEventListener("focus", () => destinationLink.select());

  function paintMetricsButton() {
    const on = !overlay.hidden;
    metricsBtn.setAttribute("aria-pressed", String(on));
    metricsBtn.textContent = on ? "Hide performance" : "Show performance";
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

  const activePane = () => !journalPane.hidden ? journalPane : !mapPane.hidden ? mapPane : !devPane.hidden ? devPane : !keysPane.hidden ? keysPane : hub;
  // Include the native select and readonly URL in the dialog's focus loop.
  // https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
  // A nested chart can hide a whole subtree while its individual buttons keep
  // hidden=false. Only rendered controls participate in the existing focus trap.
  // https://developer.mozilla.org/en-US/docs/Web/API/Element/getClientRects
  const focusable = () => [...activePane().querySelectorAll("button,input,select")].filter(el => !el.disabled && !el.hidden && el.getClientRects().length);
  function focusFirst() { focusable()[0]?.focus(); }

  function open(reason = 'Paused') {
    if (visible || isArmoryOpen()) return;
    visible = true;
    hub.querySelector('p').textContent = reason;
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
    const on = syncDevQuery(!devQueryOn());
    onDev?.(on);
    setMetricsVisible(on);
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
    else if (action === 'journal') openJournal();
    else if (action === 'journal-guide') {
      journalPane.hidden=true;mapPane.hidden=false;panel.classList.add('region-map-open');
      root.setAttribute('aria-labelledby','region-map-title');
      getRegionMap?.()?.openGuide(mapPane.querySelector('[data-region-map]'));focusFirst();
    }
    else if (action === 'region-map'||action === 'journal-region-map') {
      hub.hidden = keysPane.hidden = devPane.hidden = journalPane.hidden = true;
      mapPane.hidden = false;
      panel.classList.add('region-map-open');
      root.setAttribute('aria-labelledby', 'region-map-title');
      refreshRegionMap();
      focusFirst();
    }
    else if (action === "sound") toggleSound();
    else if (action === "keys") {
      syncBindings();
      queueSelect.value = String(getCombat?.()?.scheduler.queueWindow ?? .3);
      queueSelect.disabled = !getCombat?.();
      const touch = document.body.classList.contains("touch-play");
      keysPane.querySelector(".desktop-keys").hidden = touch;
      keysPane.querySelector(".touch-keys").hidden = !touch;
      hub.hidden = true;
      keysPane.hidden = false;
      keysPane.querySelector("button")?.focus();
    } else if (action === "developer-tools" && devQueryOn()) {
      hub.hidden = keysPane.hidden = true;
      devPane.hidden = false;
      refreshDevTools();
      focusFirst();
    } else if ((action === 'render-native' || action === 'render-1280') && devQueryOn()) {
      const canvas = document.getElementById('renderCanvas');
      if (canvas?.clientWidth && canvas?.clientHeight) {
        const width = action === 'render-1280' ? 1280 : canvas.clientWidth;
        globalThis.ASHEN?.metrics.setInternalResolution(width, Math.round(width * canvas.clientHeight / canvas.clientWidth));
      }
      refreshDevTools();
    } else if (action === 'combat-scenario' && devQueryOn()) {
      if (getCombat?.()?.scenarios.start(root.querySelector('#dev-combat-scenario').value)) close();
      else refreshDevTools();
    } else if (action === 'combat-restore' && devQueryOn()) {
      getCombat?.()?.scenarios.restore(); refreshDevTools();
    } else if (action === 'combat-trace-clear' && devQueryOn()) {
      getCombat?.()?.trace.clear(); refreshDevTools();
    } else if (action === 'combat-trace' && devQueryOn()) {
      const combat = getCombat?.();
      if (combat) {
        const content = { schema: 1, scenario: combat.scenarios.active, dropped: combat.trace.dropped, events: combat.trace.snapshot() };
        const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'ashen-combat-trace.json'; link.click();
        // Retain the Blob through the download dispatch, then release its owner.
        // https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } else if (action === "jump") {
      if (getDevTools?.()?.jumpTo?.(destinationSelect.value)) close();
      else refreshDevTools();
    } else if (action === 'region-loading'&&devQueryOn()) {
      const tools=getDevTools?.();
      if(tools?.regionCoreAvailable)location.assign(tools.regionLoadingURL(destinationSelect.value));
    } else if(action==='exploration-reset'&&devQueryOn()){
      getExploration?.()?.resetSession();refreshDevTools();
    } else if (action === "god" || action === "fly") {
      const tools = getDevTools?.();
      if (action === "god") tools?.setGod?.(!tools.dev.god);
      else tools?.setFlying?.(!tools.dev.flying);
      refreshDevTools();
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
      if (visible && !event.target?.closest?.('input,select,textarea') && event.code === "KeyC" && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey) {
        chooseArmory();
        return;
      }
      if (event.code === "Escape") {
        if (event.repeat) return;
        // The menu capture listener runs before input's pointer-lock early return.
        // Stop the action even when this same Escape also unlocks the mouse.
        if (!visible && !isArmoryOpen() && getCombat?.()?.stopCasting('Cast stopped')) {
          if (document.pointerLockElement) document.exitPointerLock();
          event.preventDefault(); event.stopImmediatePropagation(); return;
        }
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
        const controls = focusable();
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

  setMetricsVisible(devQueryOn() || new URLSearchParams(location.search).has("metrics"));

  return {
    open,
    close,
    get isOpen() {
      return visible;
    },
    element: root,
    refreshSound: paintSound,
    refreshDevTools,
    refreshRegionMap,
    openJournal,
  };
}
