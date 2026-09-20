/**
 * Roaming hostiles. Same target shape as the training dummy so
 * existing spells, targeting and the combat HUD keep working.
 *
 * Visuals are Mixamo humans from public/characters/base.glb (see npc.js):
 * one loadGltf container per enemy, idle / walk / jog / punch / death clips.
 * Churchyard shades keep ENEMY_TUNING.zMax (the climb). Town hostiles use a
 * separate street/well box so raising the global zMax cannot walk a grave
 * shade into the tavern.
 */
import { attachAnimatedHuman } from "../character/npc.js";
import { attachShadeSilhouette } from "./shade-garment.js";
import { height, pathX } from "./geometry.js";
import { SHADE_XP } from "./progression.js";

export const ENEMY_TUNING = Object.freeze({
  hp: 360,
  xp: SHADE_XP,
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

/** Churchyard / climb. Matches ENEMY_TUNING; kept as its own box so town
 *  hostiles cannot inherit a raised zMax. */
export const CHURCHYARD_BOUNDS = Object.freeze({
  xMin: ENEMY_TUNING.xMin,
  xMax: ENEMY_TUNING.xMax,
  zMin: ENEMY_TUNING.zMin,
  zMax: ENEMY_TUNING.zMax,
});

/** Hollowmere street and well approaches. North of the gate (z=75), not
 *  inside the pulled-in building fronts (~|x|≥4), not past the well square. */
export const TOWN_BOUNDS = Object.freeze({
  xMin: -3.4,
  xMax: 3.4,
  zMin: 76,
  zMax: 138,
});

const NAMES = ["Grave Shade", "Ash Wight", "Lych Stalker", "Barrow Shade"];

/** Shared spectral look. Per-shade tints were the near/far mismatch in M4b.
 *  Ice-cyan `[0.46, 0.58, 0.62]` at direct 0.34 / env 0.16 read as a hologram.
 *  Peat-mist here is the grave-shade body: a paler figure inside the cowl.
 *  Cloth in shade-garment.js is darker and dimmer so body and robe stay
 *  two values; that split is the figure, not a second ice-cyan pass. */
const SHADE_TINT = Object.assign([0.30, 0.38, 0.26, 0.28], {
  roughness: 0.96,
  metallic: 0,
  directIntensity: 0.22,
  environmentIntensity: 0.10,
  emissive: [0.06, 0.09, 0.04],
});

function townTint(color, emissive) {
  return Object.assign(color.slice(), {
    roughness: 0.96,
    metallic: 0,
    directIntensity: 0.24,
    environmentIntensity: 0.10,
    emissive,
  });
}

/** Street / well bodies, distinct from the churchyard peat-mist. Cloak
 *  geometry stays the shared shade silhouette. */
const TOWN_TINT_RUST = townTint([0.46, 0.26, 0.16, 0.30], [0.10, 0.04, 0.02]);
const TOWN_TINT_SLATE = townTint([0.22, 0.30, 0.38, 0.30], [0.04, 0.06, 0.10]);
const TOWN_TINT_BONE = townTint([0.44, 0.40, 0.26, 0.30], [0.09, 0.08, 0.04]);

/** Punch_Cross is 1.0s; 0.58 keeps the swing on screen for the 1.6s cooldown. */
const PUNCH_SPEED = 0.58;

/** Churchyard four first, unchanged. Town three on the street and well
 *  approaches so a walk from the gate to the well can aggro. */
const ANCHORS = [
  { id: "grave-shade-1", name: NAMES[0], z: 16, side: 2.6, scale: 1.04, tint: SHADE_TINT, zone: "churchyard" },
  { id: "grave-shade-2", name: NAMES[1], z: 30, side: -2.8, scale: 0.96, tint: SHADE_TINT, zone: "churchyard" },
  { id: "grave-shade-3", name: NAMES[2], z: 48, side: 2.4, scale: 1.1, tint: SHADE_TINT, zone: "churchyard" },
  { id: "grave-shade-4", name: NAMES[3], z: 62, side: -2.5, scale: 1.0, tint: SHADE_TINT, zone: "churchyard" },
  { id: "town-wraith-1", name: "Street Wraith", z: 86, side: 2.4, scale: 1.03, tint: TOWN_TINT_RUST, zone: "town", bounds: TOWN_BOUNDS },
  { id: "town-wraith-2", name: "Lane Shade", z: 108, side: -2.6, scale: 0.97, tint: TOWN_TINT_SLATE, zone: "town", bounds: TOWN_BOUNDS },
  { id: "town-wraith-3", name: "Well Haunt", z: 126, side: 2.2, scale: 1.05, tint: TOWN_TINT_BONE, zone: "town", bounds: TOWN_BOUNDS },
];

function clampPos(x, z, bounds) {
  const xMin = bounds?.xMin ?? ENEMY_TUNING.xMin;
  const xMax = bounds?.xMax ?? ENEMY_TUNING.xMax;
  const zMin = bounds?.zMin ?? ENEMY_TUNING.zMin;
  const zMax = bounds?.zMax ?? ENEMY_TUNING.zMax;
  return {
    x: Math.min(xMax, Math.max(xMin, x)),
    z: Math.min(zMax, Math.max(zMin, z)),
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
  const bounds = enemy.bounds;
  const next = clampPos(enemy.position.x + stepX, enemy.position.z + stepZ, bounds);
  if (!blocked(next.x, next.z, colliders, enemy.radius, enemy.id)) {
    enemy.position.x = next.x;
    enemy.position.z = next.z;
    return true;
  }
  const slideX = clampPos(enemy.position.x + stepX, enemy.position.z, bounds);
  if (!blocked(slideX.x, slideX.z, colliders, enemy.radius, enemy.id)) {
    enemy.position.x = slideX.x;
    enemy.position.z = slideX.z;
    return true;
  }
  const slideZ = clampPos(enemy.position.x, enemy.position.z + stepZ, bounds);
  if (!blocked(slideZ.x, slideZ.z, colliders, enemy.radius, enemy.id)) {
    enemy.position.z = slideZ.z;
    return true;
  }
  return false;
}

function plant(x, z, colliders, radius, id, bounds) {
  let px = x,
    pz = z;
  if (!blocked(px, pz, colliders, radius, id)) return clampPos(px, pz, bounds);
  for (const [dx, dz] of [
    [1.6, 0],
    [-1.6, 0],
    [0, 1.6],
    [0, -1.6],
    [2.4, 1.2],
    [-2.4, 1.2],
  ]) {
    const n = clampPos(x + dx, z + dz, bounds);
    if (!blocked(n.x, n.z, colliders, radius, id)) return n;
  }
  return clampPos(px, pz, bounds);
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
  if (id === enemy.id) return true;
  // The ray is aimed at the player. The player controller has no colliderId, so
  // a hit on that far capsule used to count as blocked and a walk down the
  // street never entered chase. A hit near the destination is the player;
  // a hit short of that is world geometry.
  const len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) || 1;
  const hitDist = Number.isFinite(hit.hitDistance) ? hit.hitDistance : len;
  return hitDist >= len - 1;
}

function show(enemy, visible) {
  enemy.actor?.setVisible(visible);
  if (visible) {
    const s = enemy.scale;
    if (enemy.actor?.anchor) enemy.root.scaling.set(s, s, s);
    else enemy.root.scaling.set(-s, s, s);
  }
  enemy.setColliderEnabled?.(visible);
}

function setYaw(node, yaw) {
  if (node.rotationQuaternion) {
    node.rotationQuaternion.set(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));
  }
  if (node.rotation) node.rotation.y = yaw;
}

function syncRoot(enemy) {
  enemy.position.y = height(enemy.position.x, enemy.position.z);
  enemy.root.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
  setYaw(enemy.root, enemy.yaw);
  const y = enemy.position.y + (enemy.capsuleHeight || 1.68) * 0.5;
  const live = enemy.state !== "dead" && !enemy.hidden;
  if (enemy.colliderDesc) {
    enemy.colliderDesc.position.x = enemy.position.x;
    enemy.colliderDesc.position.y = y;
    enemy.colliderDesc.position.z = enemy.position.z;
    enemy.colliderDesc.enabled = live;
  }
  if (live) enemy.moveCollider?.(enemy.position.x, y, enemy.position.z);
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
    enemy.setColliderEnabled?.(false);
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
  if (enemy.state === "attack") {
    enemy.actor?.play("punch", { loop: true, speed: PUNCH_SPEED });
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

  if (enemy.hp <= 0 && enemy.state !== "dead") {
    enter(enemy, "dead");
    ctx.onKill?.(enemy);
  }

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
      enemy.actor?.play("punch", { loop: true, speed: PUNCH_SPEED });
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
  const bounds = spec.bounds || CHURCHYARD_BOUNDS;
  const x = pathX(spec.z) + spec.side;
  const planted = plant(x, spec.z, world.colliders || [], ENEMY_TUNING.radius, spec.id, bounds);
  const spawn = { x: planted.x, z: planted.z };
  const r = ENEMY_TUNING.patrolRadius;
  const waypoints = [
    clampPos(spawn.x + r, spawn.z, bounds),
    clampPos(spawn.x, spawn.z + r * 0.7, bounds),
    clampPos(spawn.x - r, spawn.z, bounds),
    clampPos(spawn.x, spawn.z - r * 0.7, bounds),
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
  const garment = attachShadeSilhouette(engine, scene, actor, { scale: spec.scale || 1 });
  actor.anchor = garment.host;
  actor.silhouette = garment;
  for (const mesh of garment.meshes) {
    if (!actor.meshes.includes(mesh)) actor.meshes.push(mesh);
  }
  const enemy = {
    id: spec.id,
    name: spec.name,
    zone: spec.zone || "churchyard",
    bounds,
    position,
    hostile: true,
    hp: ENEMY_TUNING.hp,
    hpMax: ENEMY_TUNING.hp,
    xp: ENEMY_TUNING.xp,
    hits: 0,
    hitsLanded: 0,
    meshes: actor.meshes,
    root: actor.anchor ?? actor.root,
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

/** Havok capsules registered after the player world exists, so they can move with the shades. */
export function bindEnemyColliders(enemies, player, world) {
  for (const enemy of enemies) {
    const scale = enemy.scale || 1;
    const capsuleHeight = 1.68 * scale;
    const capsuleRadius = 0.42 * scale;
    enemy.capsuleHeight = capsuleHeight;
    const y = enemy.position.y + capsuleHeight * 0.5;
    player.addAnimatedCollider?.({
      id: enemy.id,
      x: enemy.position.x,
      y,
      z: enemy.position.z,
      height: capsuleHeight,
      radius: capsuleRadius,
    });
    const desc = {
      id: enemy.id,
      type: "box",
      position: { x: enemy.position.x, y, z: enemy.position.z },
      size: { x: capsuleRadius * 2, y: capsuleHeight, z: capsuleRadius * 2 },
      enabled: true,
    };
    world.colliders.push(desc);
    enemy.colliderDesc = desc;
    enemy.moveCollider = (x, cy, z) => player.moveAnimatedCollider?.(enemy.id, x, cy, z);
    enemy.setColliderEnabled = (on) => {
      desc.enabled = !!on;
      player.setAnimatedColliderEnabled?.(enemy.id, on);
    };
    enemy.moveCollider(enemy.position.x, y, enemy.position.z);
  }
}

export function updateEnemies(enemies, dt, ctx) {
  for (const enemy of enemies) tickEnemy(enemy, dt, ctx);
}

export function enemySnapshot(enemies) {
  return enemies.map((e) => ({
    id: e.id,
    name: e.name,
    zone: e.zone || "churchyard",
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
    bounds: e.bounds
      ? { xMin: e.bounds.xMin, xMax: e.bounds.xMax, zMin: e.bounds.zMin, zMax: e.bounds.zMax }
      : null,
  }));
}
