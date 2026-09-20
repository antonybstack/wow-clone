/**
 * Roaming churchyard shades. Same target shape as the training dummy so
 * existing spells, targeting and the combat HUD keep working.
 *
 * Visuals are Mixamo humans from public/characters/base.glb (see npc.js):
 * one loadGltf container per enemy, idle / walk / jog / punch / death clips.
 */
import { attachAnimatedHuman } from "../character/npc.js";
import { height, pathX } from "./geometry.js";

export const ENEMY_TUNING = Object.freeze({
  hp: 360,
  aggroRadius: 12,
  leashRadius: 22,
  meleeRange: 2.2,
  attackCooldown: 1.6,
  attackDamage: 16,
  patrolSpeed: 1.35,
  chaseSpeed: 3.35,
  respawnDelay: 8,
  deathHideAfter: 1.35,
  radius: 0.42,
  patrolRadius: 4.2,
  zMin: 1,
  zMax: 69,
  xMin: -16,
  xMax: 16,
});

const NAMES = ["Grave Shade", "Ash Wight", "Lych Stalker", "Barrow Shade"];

/** Handful of roamers on the churchyard road; nothing north of the lych-gate. */
const ANCHORS = [
  { id: "grave-shade-1", name: NAMES[0], z: 16, side: 2.6, scale: 1.04, tint: [0.34, 0.48, 0.26, 1] },
  { id: "grave-shade-2", name: NAMES[1], z: 30, side: -2.8, scale: 0.96, tint: [0.52, 0.48, 0.42, 1] },
  { id: "grave-shade-3", name: NAMES[2], z: 48, side: 2.4, scale: 1.1, tint: [0.28, 0.36, 0.5, 1] },
  { id: "grave-shade-4", name: NAMES[3], z: 62, side: -2.5, scale: 1.0, tint: [0.5, 0.34, 0.2, 1] },
];

function clampPos(x, z) {
  return {
    x: Math.min(ENEMY_TUNING.xMax, Math.max(ENEMY_TUNING.xMin, x)),
    z: Math.min(ENEMY_TUNING.zMax, Math.max(ENEMY_TUNING.zMin, z)),
  };
}

function boxBlocked(x, z, collider, radius) {
  if (collider.type !== "box" || !collider.position || !collider.size) return false;
  const dx = x - collider.position.x;
  const dz = z - collider.position.z;
  const yaw = collider.rotation?.y || 0;
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  const lx = dx * c + dz * s;
  const lz = -dx * s + dz * c;
  const hx = (collider.size.x ?? collider.size.width ?? 0) * 0.5 + radius;
  const hz = (collider.size.z ?? collider.size.depth ?? 0) * 0.5 + radius;
  return Math.abs(lx) < hx && Math.abs(lz) < hz;
}

function blocked(x, z, colliders, radius, selfId) {
  for (const collider of colliders) {
    if (collider.id && collider.id === selfId) continue;
    if (collider.enabled === false) continue;
    if (boxBlocked(x, z, collider, radius)) return true;
  }
  return false;
}

function tryMove(enemy, dx, dz, dt, speed, colliders) {
  const len = Math.hypot(dx, dz) || 1;
  const stepX = (dx / len) * speed * dt;
  const stepZ = (dz / len) * speed * dt;
  const next = clampPos(enemy.position.x + stepX, enemy.position.z + stepZ);
  if (!blocked(next.x, next.z, colliders, enemy.radius, enemy.id)) {
    enemy.position.x = next.x;
    enemy.position.z = next.z;
    return true;
  }
  const slideX = clampPos(enemy.position.x + stepX, enemy.position.z);
  if (!blocked(slideX.x, slideX.z, colliders, enemy.radius, enemy.id)) {
    enemy.position.x = slideX.x;
    enemy.position.z = slideX.z;
    return true;
  }
  const slideZ = clampPos(enemy.position.x, enemy.position.z + stepZ);
  if (!blocked(slideZ.x, slideZ.z, colliders, enemy.radius, enemy.id)) {
    enemy.position.z = slideZ.z;
    return true;
  }
  return false;
}

function plant(x, z, colliders, radius, id) {
  let px = x,
    pz = z;
  if (!blocked(px, pz, colliders, radius, id)) return clampPos(px, pz);
  for (const [dx, dz] of [
    [1.6, 0],
    [-1.6, 0],
    [0, 1.6],
    [0, -1.6],
    [2.4, 1.2],
    [-2.4, 1.2],
  ]) {
    const n = clampPos(x + dx, z + dz);
    if (!blocked(n.x, n.z, colliders, radius, id)) return n;
  }
  return clampPos(px, pz);
}

function xz(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function lineOfSight(enemy, player, raycast) {
  if (typeof raycast !== "function") return true;
  const from = {
    x: enemy.position.x,
    y: enemy.position.y + 1.15,
    z: enemy.position.z,
  };
  const p = player.body.position;
  const to = { x: p.x, y: p.y + 0.35, z: p.z };
  const hit = raycast(from, to);
  if (!hit) return true;
  if (!hit.hasHit) return true;
  const id = hit.body?.node?.metadata?.colliderId;
  return id === enemy.id;
}

function show(enemy, visible) {
  enemy.actor?.setVisible(visible);
  if (visible) enemy.root.scaling.set(-enemy.scale, enemy.scale, enemy.scale);
}

function syncRoot(enemy) {
  enemy.position.y = height(enemy.position.x, enemy.position.z);
  enemy.root.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
  if (enemy.root.rotation) enemy.root.rotation.y = enemy.yaw;
}

function enter(enemy, state) {
  enemy.state = state;
  enemy.stateAge = 0;
  if (state === "idle") enemy.idleFor = 1.4 + (enemy.waypoint % 3) * 0.5;
  if (state === "dead") {
    enemy.hostile = false;
    enemy.deadAge = 0;
    enemy.hidden = false;
    enemy.actor?.play("death", { oneshot: true, loop: false, speed: 1 });
  }
}

function respawn(enemy) {
  enemy.position.x = enemy.spawn.x;
  enemy.position.z = enemy.spawn.z;
  enemy.position.y = height(enemy.spawn.x, enemy.spawn.z);
  enemy.hp = enemy.hpMax;
  enemy.yaw = enemy.spawnYaw;
  enemy.attackCooldown = 0;
  enemy.hostile = true;
  enemy.hidden = false;
  show(enemy, true);
  enemy.actor?.play("idle");
  enter(enemy, "idle");
  syncRoot(enemy);
}

function face(enemy, x, z) {
  const dx = x - enemy.position.x;
  const dz = z - enemy.position.z;
  if (Math.hypot(dx, dz) > 0.001) enemy.yaw = Math.atan2(dx, dz);
}

function driveMotion(enemy, moving) {
  if (enemy.state === "dead") return;
  const punch = enemy.actor?.clips?.punch;
  if (punch && enemy.actor.clipName === punch.name && punch.isPlaying) return;
  if (enemy.state === "attack") {
    enemy.actor?.play("idle");
    return;
  }
  if (!moving) {
    enemy.actor?.play("idle");
    return;
  }
  if (enemy.state === "patrol") {
    enemy.actor?.play("walk", { speed: 0.95 });
    return;
  }
  enemy.actor?.play("jog", { speed: 1.05 });
}

function tickEnemy(enemy, dt, ctx) {
  const { player, world, raycast, playerDead, onPlayerHit } = ctx;
  const colliders = world.colliders || [];
  const playerPos = player.body.position;
  enemy.stateAge += dt;
  enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);

  if (enemy.hp <= 0 && enemy.state !== "dead") enter(enemy, "dead");

  if (enemy.state === "dead") {
    enemy.deadAge += dt;
    if (!enemy.hidden && enemy.deadAge >= ENEMY_TUNING.deathHideAfter) {
      show(enemy, false);
      enemy.hidden = true;
      if (ctx.targeting?.current === enemy) ctx.targeting.clear();
    }
    if (enemy.deadAge >= ENEMY_TUNING.respawnDelay) respawn(enemy);
    syncRoot(enemy);
    if (!enemy.hidden) enemy.actor?.update(dt);
    return;
  }

  const dist = xz(enemy.position, playerPos);
  const toSpawn = xz(enemy.position, enemy.spawn);
  const canSee = !playerDead && dist <= ENEMY_TUNING.aggroRadius && lineOfSight(enemy, player, raycast);
  const leashed = toSpawn > ENEMY_TUNING.leashRadius;

  if (!enemy.lockedState) {
    if (playerDead && (enemy.state === "chase" || enemy.state === "attack")) {
      enter(enemy, "return");
    } else if (
      (enemy.state === "idle" || enemy.state === "patrol") &&
      canSee
    ) {
      enter(enemy, "chase");
    } else if (
      (enemy.state === "chase" || enemy.state === "attack") &&
      (leashed || dist > ENEMY_TUNING.leashRadius + 4)
    ) {
      enter(enemy, "return");
    }
  }

  let moving = false;
  if (enemy.state === "idle") {
    if (enemy.stateAge >= enemy.idleFor) {
      enemy.waypoint = (enemy.waypoint + 1) % enemy.waypoints.length;
      enter(enemy, "patrol");
    }
  } else if (enemy.state === "patrol") {
    const wp = enemy.waypoints[enemy.waypoint];
    face(enemy, wp.x, wp.z);
    moving = tryMove(
      enemy,
      wp.x - enemy.position.x,
      wp.z - enemy.position.z,
      dt,
      ENEMY_TUNING.patrolSpeed,
      colliders,
    );
    if (xz(enemy.position, wp) < 0.55) enter(enemy, "idle");
  } else if (enemy.state === "chase") {
    face(enemy, playerPos.x, playerPos.z);
    if (dist <= ENEMY_TUNING.meleeRange) enter(enemy, "attack");
    else {
      moving = tryMove(
        enemy,
        playerPos.x - enemy.position.x,
        playerPos.z - enemy.position.z,
        dt,
        ENEMY_TUNING.chaseSpeed,
        colliders,
      );
    }
  }
  if (enemy.state === "attack") {
    face(enemy, playerPos.x, playerPos.z);
    if (playerDead) enter(enemy, "return");
    else if (dist > ENEMY_TUNING.meleeRange + 0.55) enter(enemy, "chase");
    else if (enemy.attackCooldown <= 0 && dist <= ENEMY_TUNING.meleeRange + 0.35) {
      enemy.attackCooldown = ENEMY_TUNING.attackCooldown;
      enemy.hitsLanded = (enemy.hitsLanded || 0) + 1;
      enemy.actor?.play("punch", { oneshot: true, loop: false, speed: 1.15 });
      onPlayerHit(ENEMY_TUNING.attackDamage, enemy);
    }
  } else if (enemy.state === "return") {
    face(enemy, enemy.spawn.x, enemy.spawn.z);
    moving = tryMove(
      enemy,
      enemy.spawn.x - enemy.position.x,
      enemy.spawn.z - enemy.position.z,
      dt,
      ENEMY_TUNING.chaseSpeed,
      colliders,
    );
    if (xz(enemy.position, enemy.spawn) < 0.6) enter(enemy, "idle");
  }

  driveMotion(enemy, moving);
  syncRoot(enemy);
  enemy.actor?.update(dt);
}

async function makeEnemy(engine, scene, world, spec, index) {
  const x = pathX(spec.z) + spec.side;
  const planted = plant(x, spec.z, world.colliders || [], ENEMY_TUNING.radius, spec.id);
  const spawn = { x: planted.x, z: planted.z };
  const r = ENEMY_TUNING.patrolRadius;
  const waypoints = [
    clampPos(spawn.x + r, spawn.z),
    clampPos(spawn.x, spawn.z + r * 0.7),
    clampPos(spawn.x - r, spawn.z),
    clampPos(spawn.x, spawn.z - r * 0.7),
  ];
  const position = {
    x: spawn.x,
    y: height(spawn.x, spawn.z),
    z: spawn.z,
  };
  const yaw = spec.side >= 0 ? -0.4 : 0.4;
  const actor = await attachAnimatedHuman(engine, scene, {
    x: position.x,
    y: position.y,
    z: position.z,
    yaw,
    name: spec.id,
    scale: spec.scale,
    tint: spec.tint,
    hideJoints: true,
  });
  const enemy = {
    id: spec.id,
    name: spec.name,
    position,
    hostile: true,
    hp: ENEMY_TUNING.hp,
    hpMax: ENEMY_TUNING.hp,
    hits: 0,
    hitsLanded: 0,
    meshes: actor.meshes,
    root: actor.root,
    actor,
    scale: spec.scale || 1,
    recover: false,
    radius: ENEMY_TUNING.radius,
    spawn,
    spawnYaw: yaw,
    yaw,
    state: "idle",
    stateAge: 0,
    idleFor: 1 + index * 0.4,
    waypoint: index % waypoints.length,
    waypoints,
    attackCooldown: 0,
    age: index * 1.7,
    deadAge: 0,
    hidden: false,
  };
  syncRoot(enemy);
  return enemy;
}

export async function loadEnemies(engine, scene, world) {
  return Promise.all(ANCHORS.map((spec, i) => makeEnemy(engine, scene, world, spec, i)));
}

export function updateEnemies(enemies, dt, ctx) {
  for (const enemy of enemies) tickEnemy(enemy, dt, ctx);
}

export function enemySnapshot(enemies) {
  return enemies.map((e) => ({
    id: e.id,
    name: e.name,
    state: e.state,
    hp: e.hp,
    hpMax: e.hpMax,
    hostile: e.hostile,
    hidden: e.hidden,
    hits: e.hits,
    hitsLanded: e.hitsLanded,
    attackCooldown: e.attackCooldown,
    clip: e.actor?.clipName || null,
    position: { x: e.position.x, y: e.position.y, z: e.position.z },
    spawn: { x: e.spawn.x, z: e.spawn.z },
  }));
}
