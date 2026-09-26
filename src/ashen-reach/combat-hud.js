import { onSceneDispose } from "@babylonjs/lite";
import {observeCanvasLayout} from './canvas-layout.js';
import {createHudProjection} from './hud-projection.js';
import { FIRE_BLAST } from "../spells/fire-blast.js";
import { LAVA_BALL } from "../spells/lava-ball.js";
import { GRAVE_PULSE } from "../spells/grave-pulse.js";
export function createCombatHud(canvas, scene) {
  const layout = observeCanvasLayout(canvas);
  const projection = createHudProjection(canvas, layout);
  onSceneDispose(scene, () => layout.dispose());
  const root = document.createElement("div");
  root.id = "combat";
  const icon = (s) =>
    s.key === 1 ? "fire_01.png" : s.key === 2 ? "spark_05.png" : "fire_01.png";
  const title = (s) =>
    s.key === 3
      ? `${s.name} — ${s.damage} fire damage · ${s.radius}m around you · ${s.castTime}s cast · ${s.cooldown}s cooldown`
      : `${s.name} — ${s.damage} damage · ${s.range}m · ${s.cooldown}s cooldown${s.castTime ? " · 1.5s cast, movement interrupts" : ""}`;
  root.innerHTML = `<button class="sound-toggle" type="button" aria-label="Unmute sound" aria-pressed="true">Muted</button><div class="target-plate"><span>Training Dummy</span><div class="hp-track"><div class="hp-fill"></div></div><small></small></div><div class="combat-error" role="status"></div><div class="damage-number"></div><div class="cast-progress" hidden><span>Lava Ball</span><div role="progressbar" aria-label="Lava Ball cast" aria-valuemin="0" aria-valuemax="100"><i></i></div><small></small></div><div class="spell-bar">${[FIRE_BLAST, LAVA_BALL, GRAVE_PULSE].map((s) => `<div class="spell-slot"><button type="button" data-spell="${s.key}" title="${title(s)}"><kbd>${s.key}</kbd><img src="/ashen-reach/fire-blast/${icon(s)}" alt=""><strong></strong></button><span>${s.name}</span></div>`).join("")}<div class="spell-slot attack-slot"><button type="button" data-attack aria-pressed="false" title="Auto attack">Attack<kbd>T</kbd><strong></strong></button><span>Attack</span></div></div><div class="level-up" hidden><strong>LEVEL UP</strong><small></small></div>`;
  const hudStyle = document.createElement("style");
  hudStyle.textContent =
    ".level-up{position:absolute;left:0;right:0;top:16%;text-align:center;z-index:11;pointer-events:none;color:#ffe1a8;text-shadow:0 2px 12px #000}" +
    ".level-up strong{display:block;font:18px Georgia;letter-spacing:.16em}" +
    ".level-up small{display:block;margin-top:4px;font:12px Georgia;letter-spacing:.08em;color:#ead1b5}" +
    ".world-name{position:absolute;transform:translate(-50%,-100%);font:13px Georgia,serif;letter-spacing:.03em;text-shadow:0 2px 4px #000;white-space:nowrap;pointer-events:none}" +
    ".world-name.watchman{font-size:14px;letter-spacing:.08em}";
  root.prepend(hudStyle);
  const nameRoot = document.createElement("div");
  nameRoot.className = "world-names";
  const namePool = Array.from({ length: 8 }, () => {
    const el = document.createElement("div");
    el.className = "world-name";
    el.hidden = true;
    nameRoot.append(el);
    return el;
  });
  root.append(nameRoot);
  document.body.append(root);
  const plate = root.querySelector(".target-plate"),
    fill = root.querySelector(".hp-fill"),
    hp = root.querySelector(".target-plate small"),
    feedback = root.querySelector(".combat-error"),
    damage = root.querySelector(".damage-number"),
    slot = root.querySelector(".spell-bar button");
  const lavaSlot = root.querySelector('[data-spell="2"]'),
    pulseSlot = root.querySelector('[data-spell="3"]'),
    castBar = root.querySelector(".cast-progress");
  const levelUp = root.querySelector(".level-up"),
    levelUpSub = root.querySelector(".level-up small");
  let messageTime = 0,
    damageTime = 0,
    damageTarget = null,
    visible = true;
  return {
    slot,
    lavaSlot,
    pulseSlot,
    soundToggle: root.querySelector(".sound-toggle"),
    setVisible(v) {
      visible = v;
      root.hidden = !v;
    },
    message(text) {
      feedback.textContent = text;
      messageTime = 1.5;
    },
    hit(target, amount) {
      damageTarget = target;
      damage.textContent = String(amount);
      damageTime = 0.95;
    },
    paintMarks(camera, marks) {
      projection.begin(camera);
      let used = 0;
      for (const mark of marks || []) {
        if (used >= namePool.length) break;
        const spot = projection.project(mark.position, mark.y);
        const el = namePool[used++];
        if (!spot) {
          el.hidden = true;
          continue;
        }
        el.hidden = false;
        el.textContent = mark.text;
        el.style.color = mark.color || "#ead1b5";
        el.style.left = layout.size.left + spot.cssX + "px";
        el.style.top = layout.size.top + spot.cssY + "px";
        el.classList.toggle("watchman", !!mark.watchman);
      }
      for (; used < namePool.length; used++) namePool[used].hidden = true;
    },
    paintProgress(progress, time) {
      const fill = root.querySelector(".xp-fill");
      const text = root.querySelector(".player-xp");
      const next = progress.xpToNext || 1;
      if (fill)
        fill.style.width =
          Math.max(0, Math.min(1, progress.xp / next)) * 100 + "%";
      if (text) text.textContent = `${Math.floor(progress.xp)} / ${next}`;
      const age = time - (progress.lastLevelUp ?? -99);
      if (age >= 0 && age < 2.8) {
        levelUp.hidden = false;
        levelUpSub.textContent = `You reach level ${progress.level}`;
        const fadeIn = Math.min(1, age / 0.18);
        const fadeOut = age > 2 ? Math.max(0, 1 - (age - 2) / 0.8) : 1;
        levelUp.style.opacity = String(fadeIn * fadeOut);
      } else {
        levelUp.hidden = true;
      }
    },
    update(dt, target, spell, camera, lava, pending, gcd = 0, pulse, attack) {
      messageTime = Math.max(0, messageTime - dt);
      damageTime = Math.max(0, damageTime - dt);
      feedback.style.opacity = messageTime > 0 ? "1" : "0";
      if (!visible) return;
      projection.begin(camera);
      const p =
        target && projection.project(target.position, target.position.y + 2.05);
      plate.hidden = !p;
      if (p) {
        plate.style.left = layout.size.left + p.cssX + "px";
        plate.style.top = layout.size.top + p.cssY + "px";
        fill.style.width = (target.hp / target.hpMax) * 100 + "%";
        hp.textContent = target.hp
          ? `${target.hp} / ${target.hpMax}`
          : "Recovering…";
      }
      const d =
        damageTarget &&
        damageTime > 0 &&
        projection.project(
          damageTarget.position,
          damageTarget.position.y + 2.45 + (0.95 - damageTime) * 0.75,
        );
      damage.hidden = !d;
      if (d) {
        damage.style.left = layout.size.left + d.cssX + "px";
        damage.style.top = layout.size.top + d.cssY + "px";
        damage.style.opacity = String(Math.min(1, damageTime * 3));
      }
      for (const [button, s, config] of [
        [slot, spell, FIRE_BLAST],
        [lavaSlot, lava, LAVA_BALL],
        [pulseSlot, pulse, GRAVE_PULSE],
      ]) {
        if (!s) continue;
        button.querySelector("strong").textContent =
          s.cooldown > 0 ? s.cooldown.toFixed(1) : "";
        button.style.setProperty(
          "--cooldown",
          Math.max(s.cooldown / config.cooldown, (gcd || 0) / 1.5),
        );
        button.classList.toggle("unready", s.cooldown > 0);
        button.setAttribute(
          "aria-label",
          s.cooldown > 0
            ? `${config.name} ready in ${s.cooldown.toFixed(1)} seconds`
            : `Cast ${config.name}`,
        );
      }
      const ratio = attack?.enabled && attack.speed ? Math.max(0, Math.min(1, attack.timer / attack.speed)) : 0;
      for (const button of document.querySelectorAll("[data-attack]")) {
        button.classList.toggle("attacking", !!attack?.enabled);
        button.style.setProperty("--cooldown", attack?.enabled ? String(ratio) : "0");
        button.setAttribute("aria-pressed", attack?.enabled ? "true" : "false");
        if (attack?.name) button.title = `${attack.name} · ${attack.damage} damage · ${attack.speed.toFixed(2)}s · T toggles`;
      }
      castBar.hidden = !pending;
      if (pending) {
        const hold = pending.castTime || LAVA_BALL.castTime;
        const fraction = Math.min(1, pending.elapsed / hold);
        castBar.querySelector("span").textContent = pending.name || "Lava Ball";
        castBar.querySelector("i").style.width = fraction * 100 + "%";
        castBar
          .querySelector("[role=progressbar]")
          .setAttribute("aria-valuenow", Math.round(fraction * 100));
        castBar.querySelector("small").textContent =
          Math.max(0, hold - pending.elapsed).toFixed(1) + "s";
      }
    },
  };
}
