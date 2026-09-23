import { addToScene, getContainerMeshes, loadGltf, getViewProjectionMatrix } from "@babylonjs/lite";
import { FireBlast } from "../spells/fire-blast.js";
import { LavaBall } from "../spells/lava-ball.js";
import { GravePulse } from "../spells/grave-pulse.js";
import { Targeting } from "../targeting.js";
import { setInputEnabled } from "../input.js";
import { createCombatHud } from "./combat-hud.js";
import { enemySnapshot, updateEnemies } from "./enemies.js";
import { createFireBlastAudio } from "./fire-blast-audio.js";
import { createFireBlastVfx } from "./fire-blast-vfx.js";
import { height, pathX } from "./geometry.js";
import { createLavaBallVfx } from "./lava-ball-vfx.js";
import { createGravePulseVfx } from "./grave-pulse-vfx.js";
import { createMinimap } from "./minimap.js";
import { createProgression, PLAYER_HP_BASE } from "./progression.js";
import { spellLineOfSight } from "./spell-visibility.js";
import {
  facingError,
  meleeDistance,
  stepAutoAttack,
  weaponProfile,
  yawTo,
} from "./auto-attack.js";
import { dev } from "./dev-tools.js";

const PLAYER_HP = PLAYER_HP_BASE;
const REGEN_DELAY = 6;
const REGEN_PER_SEC = 4;
const GCD = 1.5;
const CAST_MOVE_SCALE = 0.4;

export async function loadTrainingDummy(engine, scene, world, buffer) {
  const asset = await loadGltf(engine, buffer || "/ashen-reach/training-dummy.glb");
  const position = { x: pathX(8), y: height(pathX(8), 8), z: 8 };
  for (const root of asset.entities)
    root.position.set(position.x, position.y, position.z);
  addToScene(scene, asset);
  const meshes = getContainerMeshes(asset);
  for (const mesh of meshes) {
    mesh.receiveShadows = true;
    if (mesh.material?.subsurface) delete mesh.material.subsurface.refraction;
  }
  world.colliders.push({
    id: "ashen-training-dummy",
    type: "box",
    position: { x: position.x, y: position.y + 0.8, z: position.z },
    size: { x: 0.75, y: 1.6, z: 0.45 },
  });
  return {
    id: "ashen-training-dummy",
    name: "Training Dummy",
    position,
    hostile: true,
    hp: 2000,
    hpMax: 2000,
    hits: 0,
    meshes,
    root: asset.entities[0],
    recover: true,
  };
}
function installLifeHud() {
  const root = document.getElementById("combat");
  if (!root || root.querySelector(".player-plate")) return root;
  root.style.zIndex = "8";
  root.style.isolation = "isolate";
  const canvasEl = document.getElementById("renderCanvas");
  if (canvasEl) {
    canvasEl.style.position = "relative";
    canvasEl.style.zIndex = "0";
  }
  const style = document.createElement("style");
  style.textContent =
    ".player-plate{position:absolute;left:14px;bottom:14px;width:232px;z-index:9;background:#100e0cee;padding:8px 10px 7px;border:1px solid #3a3428;box-shadow:0 2px 10px #000000a0;text-align:left}" +
    ".player-plate header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px}" +
    ".player-plate header span{font-size:13px}" +
    ".player-plate .player-level{font:10px monospace;letter-spacing:.14em;color:#c1c0ab}" +
    ".player-plate .res{display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center;margin:3px 0}" +
    ".player-plate .hp-track,.player-plate .mana-track,.player-plate .xp-track{height:5px;border:1px solid #282820;background:#15140f;margin:0}" +
    ".player-plate .hp-fill{height:100%;background:#a46636;transition:width .1s}" +
    ".player-plate .mana-fill{height:100%;background:#4a6e6a;transition:width .1s}" +
    ".player-plate .xp-fill{height:100%;width:0;background:#8a6a3a;transition:width .1s}" +
    ".player-plate .res small{font:10px monospace;color:#c1c0ab;min-width:62px;text-align:right}" +
    ".death-veil{position:absolute;inset:0;background:#100808d4;display:grid;place-items:center;pointer-events:auto;z-index:5;text-align:center}" +
    ".death-veil[hidden]{display:none!important}" +
    ".death-veil p{margin:0 0 14px;font-size:28px;color:#ead1b5}" +
    ".death-veil button{pointer-events:auto;background:#181511;color:#ffe1a8;border:1px solid #9b7650;padding:8px 16px;font:15px Georgia;cursor:pointer;box-shadow:0 0 0 3px #171714}" +
    ".death-veil small{display:block;margin-top:10px;font:11px monospace;color:#c1c0ab}";
  root.append(style);
  const plate = document.createElement("div");
  plate.className = "player-plate";
  plate.innerHTML =
    "<header><span>You</span><small class=\"player-level\">LV 1</small></header>" +
    "<div class=\"res\"><div class=\"hp-track\"><div class=\"hp-fill\"></div></div><small class=\"player-hp\"></small></div>" +
    "<div class=\"res\"><div class=\"mana-track\"><div class=\"mana-fill\"></div></div><small class=\"player-mana\"></small></div>" +
    "<div class=\"res\"><div class=\"xp-track\"><div class=\"xp-fill\"></div></div><small class=\"player-xp\"></small></div>";
  const veil = document.createElement("div");
  veil.className = "death-veil";
  veil.hidden = true;
  veil.innerHTML =
    "<div><p>You have died</p><button type=\"button\">Release spirit</button><small>Return to the churchyard</small></div>";
  root.append(plate, veil);
  return root;
}

export async function createCombat(
  engine,
  scene,
  canvas,
  player,
  body,
  world,
  input,
  dummy,
  rig,
  enemies = [],
  objective = null,
) {
  const targeting = new Targeting();
  const hostiles = [dummy, ...enemies];
  targeting.list = hostiles;
  const spell = new FireBlast(),
    fx = await createFireBlastVfx(engine, scene, player, body, world),
    hud = createCombatHud(canvas);
  const lava = new LavaBall(),
    lavaFx = await createLavaBallVfx(
      engine,
      scene,
      world,
      fx.handPosition,
      player,
    );
  const pulse = new GravePulse(),
    pulseFx = await createGravePulseVfx(engine, scene, player, world, fx.handPosition);
  const audio = await createFireBlastAudio(scene);
  const lifeHud = installLifeHud();
  const playerFill = lifeHud.querySelector(".player-plate .hp-fill");
  const playerHp = lifeHud.querySelector(".player-plate .player-hp");
  const playerLevel = lifeHud.querySelector(".player-plate .player-level");
  const manaFill = lifeHud.querySelector(".player-plate .mana-fill");
  const manaText = lifeHud.querySelector(".player-plate .player-mana");
  const nameEl = lifeHud.querySelector(".target-plate > span");
  const targetHpEl = lifeHud.querySelector(".target-plate small");
  const deathVeil = lifeHud.querySelector(".death-veil");
  const progression = createProgression();
  const minimap = createMinimap({
    player,
    enemies,
    marker() {
      const snap = objective?.snapshot();
      if (!snap || snap.phase === "done") return null;
      return { x: snap.watchman.x, z: snap.watchman.z };
    },
  });
  const paintMute = () => {
    if (!audio.status.ready) {
      hud.soundToggle.textContent = "Sound unavailable";
      hud.soundToggle.disabled = true;
      return;
    }
    hud.soundToggle.textContent = audio.muted ? "Muted" : "Sound on";
    hud.soundToggle.setAttribute("aria-pressed", String(audio.muted));
    hud.soundToggle.setAttribute("aria-label", audio.muted ? "Unmute sound" : "Mute sound");
  };
  hud.soundToggle.onclick = () => {
    audio.setMuted(!audio.muted);
    paintMute();
    canvas.focus();
  };
  paintMute();
  let hitAge = 10,
    hitScale = 1,
    hitDirection = { x: 0, z: 1 },
    hitDummy = false,
    gcd = 0,
    meleeRecover = 0,
    swingHit = false;
  const auto = { enabled: false, timer: 0, queued: false, pendingHit: false };
  let readWeapon = () => null;
  const animationLab = new URLSearchParams(location.search).has("animationLab");
  let visible = false,
    pending = null;
  const life = {
    hp: PLAYER_HP,
    hpMax: PLAYER_HP,
    dead: false,
    inCombat: false,
    combatUntil: 0,
    time: 0,
  };
  const plantPlayer = () => {
    const x = 0,
      z = 0;
    player.setWorldPos(x, height(x, z) + player.capsuleHeight / 2, z);
    player.setFacing(0);
  };
  const syncPlayerHp = () => {
    player.hp = life.hp;
    player.hpMax = life.hpMax;
  };
  const keepDummyRecovery = (ability) => {
    if (!ability?.damagedTarget || ability.damagedTarget.recover) return;
    ability.damagedTarget = dummy.hp <= 0 ? dummy : null;
    if (!ability.damagedTarget) ability.resetIn = 0;
  };
  const markCombat = () => {
    life.combatUntil = life.time + REGEN_DELAY;
    life.inCombat = true;
  };
  const settleKill = (result, completed) => {
    if (completed && objective) {
      const bonus = progression.awardXp(
        { xp: objective.bonusXp },
        life,
        life.time,
      );
      if (result.leveled || bonus.leveled) syncPlayerHp();
      hud.message(`Churchyard cleared. +${bonus.gained} experience`);
      objective.noteComplete(bonus.gained);
      return;
    }
    if (result.leveled) syncPlayerHp();
    if (result.gained) {
      const snap = objective?.snapshot();
      const left = snap?.remaining?.length;
      if (snap?.phase === "active" && left > 0) {
        const line = `+${result.gained} experience. ${left} shade${left === 1 ? "" : "s"} remain.`;
        hud.message(line);
        objective.holdLine(line);
      } else if (!result.leveled) {
        hud.message(`+${result.gained} experience`);
      }
    }
  };
  const connectSwing = (profile) => {
    const target = targeting.current;
    if (!target || target.hp <= 0 || target.hidden) return;
    if (meleeDistance(player.body.position, target.position) > profile.range + 0.4) return;
    const los = spellLineOfSight(player, target);
    if (!los.clear && los.obstacle !== "Collision world unavailable") return;
    const dealt = Math.min(target.hp, profile.damage);
    target.hp -= dealt;
    target.hits = (target.hits || 0) + 1;
    hud.hit(target, dealt);
    hud.message("");
    markCombat();
    if (target === dummy) {
      hitDummy = true;
      hitAge = 0;
      hitScale = 0.7;
      const t = target.position,
        p = player.body.position,
        length = Math.hypot(t.x - p.x, t.z - p.z) || 1;
      hitDirection = { x: (t.x - p.x) / length, z: (t.z - p.z) / length };
      if (dummy.hp <= 0) meleeRecover = 3;
    }
  };
  const die = () => {
    if (life.dead) return;
    life.dead = true;
    life.hp = 0;
    syncPlayerHp();
    auto.enabled = false;
    auto.queued = false;
    auto.pendingHit = false;
    body.cancelMelee?.();
    setInputEnabled(false);
    cancel("You have died");
    deathVeil.hidden = false;
  };
  const releaseSpirit = (force = false) => {
    if (!life.dead && !force) return false;
    life.dead = false;
    life.hp = life.hpMax;
    life.inCombat = false;
    life.combatUntil = 0;
    progression.fillMana();
    syncPlayerHp();
    plantPlayer();
    deathVeil.hidden = true;
    setInputEnabled(true);
    canvas.focus();
    return true;
  };
  deathVeil.querySelector("button").onclick = () => {
    releaseSpirit();
  };
  const castArgs = (target) => ({
    target,
    position: player.body.position,
    grounded: player.getGrounded() && body.getState().phase !== "air",
    hasLineOfSight: () => spellLineOfSight(player, target).clear,
  });
  const impact = (result, isLava = false) => {
    const t = result.target.position,
      p = player.body.position,
      length = Math.hypot(t.x - p.x, t.z - p.z) || 1;
    hitDummy = result.target === dummy;
    if (hitDummy) {
      hitAge = 0;
      hitScale = isLava ? 1.8 : 1;
      hitDirection = { x: (t.x - p.x) / length, z: (t.z - p.z) / length };
    }
    if (!isLava) {
      audio.play();
      fx.trigger(result.target);
    }
    hud.message("");
    hud.hit(result.target, result.damage);
    markCombat();
    keepDummyRecovery(spell);
    keepDummyRecovery(lava);
  };
  for (const [slot, key] of [
    [hud.slot, 1],
    [hud.lavaSlot, 2],
    [hud.pulseSlot, 3],
  ]) {
    slot.onclick = () => {
      input.spellPressed = key;
      input.castInstant = true;
      canvas.focus();
    };
  }
  for (const button of document.querySelectorAll("[data-attack]")) {
    button.addEventListener("pointerup", (event) => {
      input.attackPressed = true;
      event.preventDefault();
      canvas.focus();
    });
  }
  let queuedCast = 0;
  const beginSpell = (key) => {
    if (gcd > 0.04) {
      hud.message("Global cooldown");
      return;
    }
    const ability = key === 2 ? lava : key === 3 ? pulse : spell,
      target = targeting.current,
      reason =
        ability.validate(
          key === 3
            ? { position: player.body.position, grounded: player.getGrounded() && body.getState().phase !== "air", hostiles }
            : castArgs(target),
        ) || (dev.god ? "" : progression.refuseMana(key));
    if (reason) {
      ability.lastResult = reason;
      hud.message(reason);
      return;
    }
    const pose = body.getState();
    if (pose.castingShoot) {
      if (pose.castElapsed + 0.02 >= pose.castReleaseTime && key !== 2) queuedCast = key;
      else hud.message("Finishing cast");
      return;
    }
    if (key !== 3) {
      const t = target.position,
        p = player.body.position;
      player.setFacing(Math.atan2(t.x - p.x, t.z - p.z));
    }
    input.castInstant = true;
    input.castSpell = key === 2 ? "lava" : key === 3 ? "pulse" : null;
    pending = { target, key, ability };
    gcd = GCD;
    player.setMoveScale?.(CAST_MOVE_SCALE);
    ability.lastResult = "windup";
    hud.message("");
    if (key === 2) {
      lavaFx.begin();
      audio.lavaCharge();
    } else if (key === 3) {
      pulseFx.begin();
      audio.lavaCharge();
    } else fx.beginWindup();
  };
  const cancel = (reason) => {
    queuedCast = 0;
    if (!pending) return;
    player.setMoveScale?.(1);
    if (pending.key === 2) {
      lavaFx.cancel();
      audio.lavaCancel();
    } else if (pending.key === 3) {
      pulseFx.cancel();
      audio.lavaCancel();
    } else fx.cancelWindup();
    pending.ability.lastResult = reason;
    pending = null;
    body.cancelCast();
    hud.message(reason);
  };
  const onPlayerHit = (amount) => {
    if (life.dead || dev.god) return;
    life.hp = Math.max(0, life.hp - amount);
    syncPlayerHp();
    markCombat();
    body.playHit?.();
    if (!life.hp) die();
  };
  const tickLife = (dt) => {
    life.time += dt;
    gcd = Math.max(0, gcd - dt);
    const fighting = enemies.some(
      (e) => e.state === "chase" || e.state === "attack",
    );
    life.inCombat = fighting || life.time < life.combatUntil;
    if (life.dead) {
      setInputEnabled(false);
      return;
    }
    if (dev.god) {
      life.hp = life.hpMax;
      progression.fillMana();
      syncPlayerHp();
    } else if (!life.inCombat && life.hp < life.hpMax) {
      life.hp = Math.min(life.hpMax, life.hp + REGEN_PER_SEC * dt);
      syncPlayerHp();
    }
    if (!dev.god) progression.regenMana(dt, life.inCombat, REGEN_PER_SEC);
  };
  const paintHud = () => {
    const ratio = life.hpMax ? life.hp / life.hpMax : 0;
    playerFill.style.width = ratio * 100 + "%";
    playerHp.textContent = life.dead
      ? "Dead"
      : `${Math.ceil(life.hp)} / ${life.hpMax}`;
    const p = progression.progress;
    if (playerLevel) playerLevel.textContent = `LV ${p.level}`;
    if (manaFill)
      manaFill.style.width = (p.manaMax ? p.mana / p.manaMax : 0) * 100 + "%";
    if (manaText)
      manaText.textContent = `${Math.ceil(p.mana)} / ${p.manaMax}`;
    hud.paintProgress(p, life.time);
    const target = targeting.current;
    if (nameEl && target) nameEl.textContent = target.name;
    if (targetHpEl && target && !target.recover && target.hp <= 0)
      targetHpEl.textContent = "Dead";
  };
  syncPlayerHp();
  function worldMarks() {
    const marks = [];
    const px = player.body.position;
    for (const enemy of enemies) {
      if (enemy.hidden || enemy.hp <= 0 || enemy.state === "dead") continue;
      if (enemy === targeting.current) continue;
      if (Math.hypot(enemy.position.x - px.x, enemy.position.z - px.z) > 20) continue;
      marks.push({
        position: enemy.position,
        y: enemy.position.y + 2.2,
        text: enemy.name,
        color: enemy.nameColor,
      });
    }
    const snap = objective?.snapshot();
    if (snap && snap.phase !== "done") {
      const dist = Math.hypot(px.x - snap.watchman.x, px.z - snap.watchman.z);
      if (dist < 36) {
        const y = height(snap.watchman.x, snap.watchman.z);
        marks.push({
          position: { x: snap.watchman.x, y, z: snap.watchman.z },
          y: y + 2.45,
          text: "Watchman",
          color: "#ffe1a8",
          watchman: true,
        });
      }
    }
    return marks;
  }
  const tickAuto = (dt) => {
    if (!auto.enabled) return;
    const profile = weaponProfile(readWeapon());
    const target = targeting.current;
    const alive = !!(target && target.hp > 0 && !target.hidden && target.state !== "dead");
    const from = player.body.position;
    const casting = !!pending || !!body.getState().castingShoot;
    if (casting && auto.pendingHit && !swingHit) {
      auto.queued = true;
      auto.pendingHit = false;
      body.cancelMelee?.();
    }
    const moving = Math.abs(input.forward) > 0.1 || Math.abs(input.strafe) > 0.1;
    const los = alive ? spellLineOfSight(player, target) : { clear: true, obstacle: null };
    const step = stepAutoAttack(auto, dt, {
      alive,
      dist: alive ? meleeDistance(from, target.position) : 0,
      range: profile.range,
      facingError: alive ? facingError(player.getFacing(), from, target.position) : 0,
      speed: profile.speed,
      casting,
      grounded: player.getGrounded() && body.getState().phase !== "air",
      canTurn: !input.rmb && !input.faceCamera && !input.turn && !input.looking && !moving,
      blocked: alive && !los.clear && los.obstacle !== "Collision world unavailable",
    });
    auto.enabled = step.enabled;
    auto.timer = step.timer;
    auto.queued = step.queued;
    if (step.action === "out-of-range") hud.message("Out of range");
    else if (step.action === "blocked") hud.message("Target is blocked");
    else if (step.action === "not-facing") hud.message("Face your target");
    if (step.action !== "swing") return;
    if (step.turn) player.setFacing(yawTo(from, target.position));
    swingHit = false;
    if (body.playMelee?.()) auto.pendingHit = true;
    else auto.timer = 0.3;
  };
  return {
    targeting,
    spell,
    lava,
    pulse,
    dummy,
    enemies,
    registerEnemy(enemy) {
      if (!enemy || enemies.includes(enemy)) return;
      enemies.push(enemy);
      hostiles.push(enemy);
    },
    life,
    fx,
    lavaFx,
    audio,
    lineOfSight: (target) =>
      spellLineOfSight(player, target || targeting.current),
    get hitAge() {
      return hitAge;
    },
    get pending() {
      return pending?.target.id || null;
    },
    get pendingSpell() {
      return pending?.key || null;
    },
    hud,
    snapshot: () => ({
      life: { ...life },
      progress: progression.snapshot(),
      dev: { god: dev.god, flying: dev.flying },
      gcd,
      enemies: enemySnapshot(enemies),
      dummy: { hp: dummy.hp, hpMax: dummy.hpMax },
      target: targeting.current?.id || null,
      objective: objective?.snapshot() || null,
      auto: { ...auto, weapon: readWeapon() },
    }),
    bindEquipment(getState) {
      readWeapon = () => getState()?.mainHand || null;
    },
    objective,
    progress: progression.progress,
    releaseSpirit,
    setVisible(v) {
      visible = v;
      hud.setVisible(v);
      minimap.setVisible(v);
    },
    interrupt(reason = "Cast interrupted") {
      cancel(reason);
    },
    beforeAnimation(dt) {
      spell.update(dt);
      lava.update(dt);
      pulse.update(dt);
      tickLife(dt);
      updateEnemies(enemies, dt, {
        player,
        world,
        raycast: player.raycast,
        playerDead: life.dead,
        targeting,
        onPlayerHit,
        onKill(enemy) {
          const result = progression.awardXp(enemy, life, life.time);
          settleKill(result, objective?.onKill(enemy)?.completed);
        },
      });
      const offered = objective?.tick({
        player,
        enemies,
        dt,
        dead: life.dead,
      });
      if (offered?.completed) settleKill({ gained: 0, leveled: false }, true);
      else if (offered?.message) hud.message(offered.message);
      if (life.dead) {
        input.spellPressed = 0;
        input.attackPressed = false;
        input.tabPressed = false;
        input.tabBack = false;
        input.escape = false;
        return;
      }
      if (input.attackPressed) {
        input.attackPressed = false;
        auto.enabled = !auto.enabled;
        auto.queued = false;
        auto.pendingHit = false;
        swingHit = false;
        if (auto.enabled) {
          auto.timer = 0.1;
          const target = targeting.current;
          if (!target || target.hp <= 0) hud.message("Select a target · Tab");
        } else {
          body.cancelMelee?.();
          hud.message("");
        }
      }
      if (input.escape) {
        targeting.clear();
        input.escape = false;
      }
      if (input.tabPressed || input.tabBack) {
        targeting.tab(
          player.body.position,
          { x: Math.sin(rig.yaw), z: Math.cos(rig.yaw) },
          input.tabBack,
        );
        input.tabPressed = false;
        input.tabBack = false;
      }
      if (input.clicked && !dev.flying) {
        const cx = input.clickX;
        const cy = input.clickY;
        input.clicked = false;
        const rect = canvas.getBoundingClientRect();
        const x = cx - rect.left;
        const y = cy - rect.top;
        const picked = targeting.clickAt(x, y, (position, py) => {
          const vp = getViewProjectionMatrix(
            scene.camera,
            canvas.clientWidth / canvas.clientHeight,
          );
          const w =
            vp[3] * position.x + vp[7] * py + vp[11] * position.z + vp[15];
          if (w <= 0) return null;
          return [
            (((vp[0] * position.x + vp[4] * py + vp[8] * position.z + vp[12]) / w) * 0.5 + 0.5) *
              canvas.clientWidth,
            (0.5 - ((vp[1] * position.x + vp[5] * py + vp[9] * position.z + vp[13]) / w) * 0.5) *
              canvas.clientHeight,
          ];
        });
        if (!picked) {
          targeting.click(player.body.position, {
            x: Math.sin(rig.yaw),
            z: Math.cos(rig.yaw),
          });
        }
      }
      const key = input.spellPressed;
      input.spellPressed = 0;
      // Unimplemented slots remain animation diagnostics only under ?animationLab.
      if (!animationLab) {
        input.castHold = false;
        input.spellHeld2 = false;
        input.castInstant = false;
        if ((key === 1 || key === 2 || key === 3) && visible) {
          if (pending) {
            if (pending.key === key) {
              cancel("Cast cancelled");
              player.setMoveScale?.(1);
            } else hud.message("Already casting");
          } else beginSpell(key);
        } else if (queuedCast && visible && !pending && !body.getState().castingShoot) {
          const next = queuedCast;
          queuedCast = 0;
          beginSpell(next);
        }
      }
      if (visible && !animationLab) tickAuto(dt);
    },
    afterAnimation(dt) {
      if (pending) {
        const state = body.getState();
        if (life.dead || !visible)
          cancel(life.dead ? "You have died" : "Cast interrupted");
        else if (pending.key !== 3 && targeting.current !== pending.target)
          cancel("Cast interrupted");
        else if (state.castElapsed >= state.castReleaseTime) {
          const request = pending;
          pending = null;
          player.setMoveScale?.(1);
          if (request.key === 2) {
            const p = lavaFx.origin(),
              origin = { x: p[0], y: p[1], z: p[2] },
              result = lava.release(castArgs(request.target), origin);
            if (result.ok) {
              if (!dev.god) progression.spendMana(2);
              markCombat();
              lavaFx.launch(origin);
              audio.lavaRelease();
            } else {
              lavaFx.cancel();
              audio.lavaCancel();
              body.cancelCast();
              hud.message(result.reason);
            }
          } else if (request.key === 3) {
            const result = pulse.cast({
              position: player.body.position,
              grounded: true,
              hostiles,
            });
            if (result.ok) {
              if (!dev.god) progression.spendMana(3);
              pulseFx.trigger();
              audio.pulse();
              rig?.impulse?.(0.34);
              markCombat();
              for (const hit of result.hits) {
                hud.hit(hit.target, hit.damage);
                if (hit.target === dummy) {
                  hitDummy = true;
                  hitAge = 0;
                  hitScale = 2.2;
                  hitDirection = { x: 0, z: 1 };
                }
                keepDummyRecovery(pulse);
              }
            } else hud.message(result.reason);
          } else {
            const result = spell.cast(castArgs(request.target));
            if (result.ok) {
              if (!dev.god) progression.spendMana(1);
              impact(result);
            } else {
              fx.cancelWindup();
              hud.message(result.reason);
            }
          }
        } else if (!state.castingShoot) {
          cancel("Cast interrupted");
        }
      }
      const collision = lava.advance(dt, player.raycast);
      if (collision) {
        lavaFx.explode(collision.position);
        audio.lavaImpact();
        if (collision.ok) impact(collision, true);
        else hud.message(collision.reason);
      }

      if (hitAge < 1.25 && hitDummy) {
        hitAge += dt;
        const tilt =
          hitAge < 1.25
            ? Math.sin(hitAge * 19) * Math.exp(-hitAge * 5) * 0.15 * hitScale
            : 0;
        dummy.root.rotation.x = tilt * hitDirection.z;
        dummy.root.rotation.z = -tilt * hitDirection.x;
      }
      const swung = body.getState();
      if (swung.melee && auto.pendingHit && !swingHit && swung.meleeElapsed >= swung.meleeRelease) {
        swingHit = true;
        auto.pendingHit = false;
        connectSwing(weaponProfile(readWeapon()));
      } else if (!swung.melee) {
        swingHit = false;
      }
      if (meleeRecover > 0) {
        meleeRecover = Math.max(0, meleeRecover - dt);
        if (!meleeRecover && dummy.hp <= 0) dummy.hp = dummy.hpMax;
      }
      fx.update(dt);
      lavaFx.update(dt, body.getState().castElapsed, lava.flight);
      pulseFx.update(dt);
      hud.update(
        dt,
        targeting.current,
        spell,
        scene.camera,
        lava,
        pending?.key === 2
          ? { elapsed: body.getState().castElapsed, name: "Lava Ball", castTime: 1.5 }
          : pending?.key === 3
            ? { elapsed: body.getState().castElapsed, name: "Pyre Burst", castTime: 1.1 }
            : null,
        gcd,
        pulse,
        { enabled: auto.enabled, timer: auto.timer, speed: weaponProfile(readWeapon()).speed, name: weaponProfile(readWeapon()).name, damage: weaponProfile(readWeapon()).damage },
      );
      paintHud();
      if (visible) {
        minimap.update();
        hud.paintMarks(scene.camera, worldMarks());
      } else hud.paintMarks(scene.camera, []);
    },
  };
}
