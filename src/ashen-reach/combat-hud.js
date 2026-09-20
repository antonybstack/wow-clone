import { getViewProjectionMatrix } from "@babylonjs/lite";
import { FIRE_BLAST } from "../spells/fire-blast.js";
import { LAVA_BALL } from "../spells/lava-ball.js";
export function createCombatHud(canvas) {
  const root = document.createElement("div");
  root.id = "combat";
  root.innerHTML = `<button class="sound-toggle" type="button" aria-label="Mute sound" aria-pressed="false">Sound on</button><div class="target-plate"><span>Training Dummy</span><div class="hp-track"><div class="hp-fill"></div></div><small></small></div><div class="combat-error" role="status"></div><div class="damage-number"></div><div class="cast-progress" hidden><span>Lava Ball</span><div role="progressbar" aria-label="Lava Ball cast" aria-valuemin="0" aria-valuemax="100"><i></i></div><small></small></div><div class="spell-bar">${[FIRE_BLAST, LAVA_BALL].map((s) => `<div class="spell-slot"><button type="button" data-spell="${s.key}" title="${s.name} — ${s.damage} damage · ${s.range}m · ${s.cooldown}s cooldown${s.castTime ? " · 1.5s cast, movement interrupts" : ""}"><kbd>${s.key}</kbd><img src="/ashen-reach/fire-blast/${s.key === 1 ? "fire_01.png" : "spark_05.png"}" alt=""><strong></strong></button><span>${s.name}</span></div>`).join("")}<small>Tab target · 1 blast · 2 lava ball</small></div>`;
  document.body.append(root);
  const plate = root.querySelector(".target-plate"),
    fill = root.querySelector(".hp-fill"),
    hp = root.querySelector(".target-plate small"),
    feedback = root.querySelector(".combat-error"),
    damage = root.querySelector(".damage-number"),
    slot = root.querySelector(".spell-bar button");
  const lavaSlot = root.querySelector('[data-spell="2"]'),
    castBar = root.querySelector(".cast-progress");
  let messageTime = 0,
    damageTime = 0,
    damageTarget = null,
    visible = true;
  function project(position, y, camera) {
    const vp = getViewProjectionMatrix(
        camera,
        canvas.clientWidth / canvas.clientHeight,
      ),
      x = position.x,
      z = position.z,
      w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    if (w <= 0) return null;
    return [
      (((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w) * 0.5 + 0.5) *
        canvas.clientWidth,
      (0.5 - ((vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w) * 0.5) *
        canvas.clientHeight,
    ];
  }
  return {
    slot,
    lavaSlot,
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
    update(dt, target, spell, camera, lava, pending) {
      messageTime = Math.max(0, messageTime - dt);
      damageTime = Math.max(0, damageTime - dt);
      feedback.style.opacity = messageTime > 0 ? "1" : "0";
      if (!visible) return;
      const p =
        target && project(target.position, target.position.y + 2.05, camera);
      plate.hidden = !p;
      if (p) {
        plate.style.left = p[0] + "px";
        plate.style.top = p[1] + "px";
        fill.style.width = (target.hp / target.hpMax) * 100 + "%";
        hp.textContent = target.hp
          ? `${target.hp} / ${target.hpMax}`
          : "Recovering…";
      }
      const d =
        damageTarget &&
        damageTime > 0 &&
        project(
          damageTarget.position,
          damageTarget.position.y + 2.45 + (0.95 - damageTime) * 0.75,
          camera,
        );
      damage.hidden = !d;
      if (d) {
        damage.style.left = d[0] + "px";
        damage.style.top = d[1] + "px";
        damage.style.opacity = String(Math.min(1, damageTime * 3));
      }
      for (const [button, s, config] of [
        [slot, spell, FIRE_BLAST],
        [lavaSlot, lava, LAVA_BALL],
      ]) {
        if (!s) continue;
        button.querySelector("strong").textContent =
          s.cooldown > 0 ? s.cooldown.toFixed(1) : "";
        button.style.setProperty("--cooldown", s.cooldown / config.cooldown);
        button.classList.toggle("unready", s.cooldown > 0);
        button.setAttribute(
          "aria-label",
          s.cooldown > 0
            ? `${config.name} ready in ${s.cooldown.toFixed(1)} seconds`
            : `Cast ${config.name}`,
        );
      }
      castBar.hidden = !pending;
      if (pending) {
        const fraction = Math.min(1, pending.elapsed / LAVA_BALL.castTime);
        castBar.querySelector("i").style.width = fraction * 100 + "%";
        castBar
          .querySelector("[role=progressbar]")
          .setAttribute("aria-valuenow", Math.round(fraction * 100));
        castBar.querySelector("small").textContent =
          Math.max(0, LAVA_BALL.castTime - pending.elapsed).toFixed(1) + "s";
      }
    },
  };
}
