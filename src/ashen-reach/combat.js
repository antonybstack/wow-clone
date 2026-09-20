import { addToScene, getContainerMeshes, loadGltf } from "@babylonjs/lite";
import { FireBlast } from "../spells/fire-blast.js";
import { LavaBall } from "../spells/lava-ball.js";
import { Targeting } from "../targeting.js";
import { createCombatHud } from "./combat-hud.js";
import { createFireBlastAudio } from "./fire-blast-audio.js";
import { createFireBlastVfx } from "./fire-blast-vfx.js";
import { height, pathX } from "./geometry.js";
import { createLavaBallVfx } from "./lava-ball-vfx.js";
import { spellLineOfSight } from "./spell-visibility.js";

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
  };
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
) {
  const targeting = new Targeting();
  targeting.list = [dummy];
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
    hitDirection = { x: 0, z: 1 };
  const animationLab = new URLSearchParams(location.search).has("animationLab");
  let visible = false,
    pending = null;
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
    hitAge = 0;
    hitScale = isLava ? 1.8 : 1;
    hitDirection = { x: (t.x - p.x) / length, z: (t.z - p.z) / length };
    if (!isLava) {
      audio.play();
      fx.trigger(result.target);
    }
    hud.message("");
    hud.hit(result.target, result.damage);
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
  return {
    targeting,
    spell,
    lava,
    dummy,
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
    setVisible(v) {
      visible = v;
      hud.setVisible(v);
    },
    interrupt(reason = "Cast interrupted") {
      cancel(reason);
    },
    beforeAnimation(dt) {
      spell.update(dt);
      lava.update(dt);
      if (
        pending?.key === 2 &&
        ((player.getMotion()?.speed ?? 0) > 0.5 ||
          input.forward ||
          input.strafe)
      )
        cancel("Movement interrupted Lava Ball");
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
        reason = ability.validate(castArgs(target));
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
          !visible
        )
          cancel("Cast interrupted");
        else if (state.castElapsed >= state.castReleaseTime) {
          const request = pending;
          pending = null;
          if (request.key === 2) {
            const p = lavaFx.origin(),
              origin = { x: p[0], y: p[1], z: p[2] },
              result = lava.release(castArgs(request.target), origin);
            if (result.ok) {
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
            if (result.ok) impact(result);
            else {
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

      if (hitAge < 1.25) {
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
    },
  };
}
