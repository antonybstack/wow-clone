import { addToScene, getContainerMeshes, loadGltf } from "@babylonjs/lite";
import { FireBlast } from "../spells/fire-blast.js";
import { LavaBall } from "../spells/lava-ball.js";
import { Targeting } from "../targeting.js";
import { setInputEnabled } from "../input.js";
import { createCombatHud } from "./combat-hud.js";
import { enemySnapshot, updateEnemies } from "./enemies.js";
import { createFireBlastAudio } from "./fire-blast-audio.js";
import { createFireBlastVfx } from "./fire-blast-vfx.js";
import { height, pathX } from "./geometry.js";
import { createLavaBallVfx } from "./lava-ball-vfx.js";
import { createMinimap } from "./minimap.js";
import { createProgression, PLAYER_HP_BASE } from "./progression.js";
import { spellLineOfSight } from "./spell-visibility.js";

const PLAYER_HP = PLAYER_HP_BASE;
const REGEN_DELAY = 6;
const REGEN_PER_SEC = 4;

export async function loadTrainingDummy(engine, scene, world) {
  const asset = await loadGltf(engine, "/ashen-reach/training-dummy.glb");
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
    ".player-plate{position:absolute;bottom:124px;left:50%;transform:translateX(-50%);width:220px;text-align:center;font-size:13px;z-index:9;background:#100e0cee;padding:8px 12px 6px;border:1px solid #3a3428;box-shadow:0 2px 10px #000000a0}" +
    ".player-plate .player-level{display:block;margin-top:3px;font:10px monospace;letter-spacing:.16em;color:#c1c0ab}" +
    ".mana-track{height:5px;border:1px solid #282820;background:#15140f;margin:5px 0 2px}" +
    ".mana-fill{height:100%;background:#a46636;transition:width .1s}" +
    ".player-plate .player-mana{display:block;font:10px monospace;color:#c1c0ab}" +
    ".death-veil{position:absolute;inset:0;background:#100808d4;display:grid;place-items:center;pointer-events:auto;z-index:5;text-align:center}" +
    ".death-veil[hidden]{display:none!important}" +
    ".death-veil p{margin:0 0 14px;font-size:28px;color:#ead1b5}" +
    ".death-veil button{pointer-events:auto;background:#181511;color:#ffe1a8;border:1px solid #9b7650;padding:8px 16px;font:15px Georgia;cursor:pointer;box-shadow:0 0 0 3px #171714}" +
    ".death-veil small{display:block;margin-top:10px;font:11px monospace;color:#c1c0ab}";
  root.append(style);
  const plate = document.createElement("div");
  plate.className = "player-plate";
  plate.innerHTML =
    "<span>You</span><small class=\"player-level\">LEVEL 1</small><div class=\"hp-track\"><div class=\"hp-fill\"></div></div><small class=\"player-hp\"></small><div class=\"mana-track\"><div class=\"mana-fill\"></div></div><small class=\"player-mana\"></small>";
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
) {
  const targeting = new Targeting();
  targeting.list = [dummy, ...enemies];
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
  const minimap = createMinimap({ player, enemies });
  hud.soundToggle.onclick = () => {
    audio.setMuted(!audio.muted);
    hud.soundToggle.textContent = audio.muted ? "Muted" : "Sound on";
    hud.soundToggle.setAttribute("aria-pressed", String(audio.muted));
    canvas.focus();
  };
  if (!audio.status.ready) {
    hud.soundToggle.textContent = "Sound unavailable";
    hud.soundToggle.disabled = true;
  }
  let hitAge = 10,
    hitScale = 1,
    hitDirection = { x: 0, z: 1 },
    hitDummy = false;
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
  const die = () => {
    if (life.dead) return;
    life.dead = true;
    life.hp = 0;
    syncPlayerHp();
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
  ])
    slot.onclick = () => {
      input.spellPressed = key;
      input.castInstant = true;
      canvas.focus();
    };
  const cancel = (reason) => {
    if (!pending) return;
    if (pending.key === 2) {
      lavaFx.cancel();
      audio.lavaCancel();
    } else fx.cancelWindup();
    pending.ability.lastResult = reason;
    pending = null;
    body.cancelCast();
    hud.message(reason);
  };
  const onPlayerHit = (amount) => {
    if (life.dead) return;
    life.hp = Math.max(0, life.hp - amount);
    syncPlayerHp();
    markCombat();
    if (!life.hp) die();
  };
  const tickLife = (dt) => {
    life.time += dt;
    const fighting = enemies.some(
      (e) => e.state === "chase" || e.state === "attack",
    );
    life.inCombat = fighting || life.time < life.combatUntil;
    if (life.dead) {
      setInputEnabled(false);
      return;
    }
    if (!life.inCombat && life.hp < life.hpMax) {
      life.hp = Math.min(life.hpMax, life.hp + REGEN_PER_SEC * dt);
      syncPlayerHp();
    }
    progression.regenMana(dt, life.inCombat, REGEN_PER_SEC);
  };
  const paintHud = () => {
    const ratio = life.hpMax ? life.hp / life.hpMax : 0;
    playerFill.style.width = ratio * 100 + "%";
    playerHp.textContent = life.dead
      ? "Dead"
      : `HEALTH  ${Math.ceil(life.hp)} / ${life.hpMax}`;
    const p = progression.progress;
    if (playerLevel) playerLevel.textContent = `LEVEL ${p.level}`;
    if (manaFill)
      manaFill.style.width = (p.manaMax ? p.mana / p.manaMax : 0) * 100 + "%";
    if (manaText)
      manaText.textContent = `MANA  ${Math.ceil(p.mana)} / ${p.manaMax}`;
    hud.paintProgress(p, life.time);
    const target = targeting.current;
    if (nameEl && target) nameEl.textContent = target.name;
    if (targetHpEl && target && !target.recover && target.hp <= 0)
      targetHpEl.textContent = "Dead";
  };
  syncPlayerHp();
  return {
    targeting,
    spell,
    lava,
    dummy,
    enemies,
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
    snapshot: () => ({
      life: { ...life },
      progress: progression.snapshot(),
      enemies: enemySnapshot(enemies),
      dummy: { hp: dummy.hp, hpMax: dummy.hpMax },
      target: targeting.current?.id || null,
    }),
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
          if (result.leveled) syncPlayerHp();
          else if (result.gained) hud.message(`+${result.gained} experience`);
        },
      });
      if (
        pending?.key === 2 &&
        ((player.getMotion()?.speed ?? 0) > 0.5 ||
          input.forward ||
          input.strafe)
      )
        cancel("Movement interrupted Lava Ball");
      if (life.dead) {
        input.spellPressed = 0;
        input.tabPressed = false;
        input.tabBack = false;
        input.escape = false;
        return;
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
      const key = input.spellPressed;
      input.spellPressed = 0;
      // Unimplemented slots remain animation diagnostics only under ?animationLab.
      if (animationLab) return;
      input.castHold = false;
      input.spellHeld2 = false;
      input.castInstant = false;
      if (key !== 1 && key !== 2) return;
      input.castInstant = false;
      if (!visible) return;
      if (pending) {
        hud.message("Already casting");
        return;
      }
      const ability = key === 2 ? lava : spell,
        target = targeting.current,
        reason =
          ability.validate(castArgs(target)) || progression.refuseMana(key);
      if (reason) {
        ability.lastResult = reason;
        hud.message(reason);
        return;
      }
      if (
        key === 2 &&
        ((player.getMotion()?.speed ?? 0) > 0.5 ||
          input.forward ||
          input.strafe)
      ) {
        hud.message("Stand still to cast Lava Ball");
        return;
      }
      if (body.getState().castingShoot) {
        hud.message("Finishing cast");
        return;
      }
      const t = target.position,
        p = player.body.position;
      player.setFacing(Math.atan2(t.x - p.x, t.z - p.z));
      input.castInstant = true;
      input.castSpell = key === 2 ? "lava" : null;
      pending = { target, key, ability };
      ability.lastResult = "windup";
      hud.message("");
      if (key === 2) {
        lavaFx.begin();
        audio.lavaCharge();
      } else fx.beginWindup();
    },
    afterAnimation(dt) {
      if (pending) {
        const state = body.getState();
        if (
          !state.castingShoot ||
          targeting.current !== pending.target ||
          !visible ||
          life.dead
        )
          cancel(life.dead ? "You have died" : "Cast interrupted");
        else if (state.castElapsed >= state.castReleaseTime) {
          const request = pending;
          pending = null;
          if (request.key === 2) {
            const p = lavaFx.origin(),
              origin = { x: p[0], y: p[1], z: p[2] },
              result = lava.release(castArgs(request.target), origin);
            if (result.ok) {
              progression.spendMana(2);
              markCombat();
              lavaFx.launch(origin);
              audio.lavaRelease();
            } else {
              lavaFx.cancel();
              audio.lavaCancel();
              body.cancelCast();
              hud.message(result.reason);
            }
          } else {
            const result = spell.cast(castArgs(request.target));
            if (result.ok) {
              progression.spendMana(1);
              impact(result);
            } else {
              fx.cancelWindup();
              hud.message(result.reason);
            }
          }
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
      fx.update(dt);
      lavaFx.update(dt, body.getState().castElapsed, lava.flight);
      hud.update(
        dt,
        targeting.current,
        spell,
        scene.camera,
        lava,
        pending?.key === 2 ? { elapsed: body.getState().castElapsed } : null,
      );
      paintHud();
      if (visible) minimap.update();
    },
  };
}
