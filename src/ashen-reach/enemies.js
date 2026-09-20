/**
 * Roaming churchyard shades. Same target shape as the training dummy so
 * existing spells, targeting and the combat HUD keep working.
 */
import { addToScene, createTransformNode, setParent } from "@babylonjs/lite";
import { Batch, height, pathX } from "./geometry.js";
import { surface } from "./materials.js";

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
  { id: "grave-shade-1", name: NAMES[0], z: 16, side: 2.6 },
  { id: "grave-shade-2", name: NAMES[1], z: 30, side: -2.8 },
  { id: "grave-shade-3", name: NAMES[2], z: 48, side: 2.4 },
  { id: "grave-shade-4", name: NAMES[3], z: 62, side: -2.5 },
];

function parentMesh(mesh, root, name) {
  setParent(mesh, root);
  mesh.position.set(0, 0, 0);
  mesh.rotationQuaternion.set(0, 0, 0, 1);
  mesh.scaling.set(1, 1, 1);
  mesh.receiveShadows = true;
  mesh.name = name;
}

function buildShade(engine, scene, id, mats) {
  const body = new Batch(id);
  const face = new Batch(id + "-eyes");
  const c = [1, 1, 1, 0];
  body.tube([0, 0.02, 0], [0, 0.7, 0], 0.42, 0.3, c, 6);
  body.tube([0, 0.7, 0], [0.05, 1.28, 0.12], 0.3, 0.2, c, 6);
  body.box([0.05, 1.55, 0.14], [0.5, 0.42, 0.5], c);
  body.box([0.05, 1.78, 0.02], [0.28, 0.2, 0.36], c);
  body.tube([-0.22, 1.2, 0.08], [-0.48, 0.68, 0.16], 0.07, 0.05, c, 5);
  body.tube([0.2, 1.22, 0.1], [0.52, 0.9, 0.28], 0.07, 0.055, c, 5);
  body.box([0.58, 0.55, 0.32], [0.06, 1.05, 0.2], c);
  face.box([0.12, 1.5, 0.36], [0.08, 0.08, 0.07], c);
  face.box([-0.02, 1.5, 0.36], [0.08, 0.08, 0.07], c);
  const bodyMesh = body.commit(engine, scene, mats.cloth);
  const eyeMesh = face.commit(engine, scene, mats.eyes);
  const root = createTransformNode(id, 0, 0, 0);
  addToScene(scene, root);
  parentMesh(bodyMesh, root, id);
  parentMesh(eyeMesh, root, id + "-eyes");
  return { root, meshes: [bodyMesh, eyeMesh] };
}

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

function setVisual(enemy, moving, dt) {
  const { root } = enemy;
  enemy.age += dt;
  if (enemy.state === "dead") {
    const t = Math.min(1, enemy.deadAge / 0.85);
    root.rotation.x = 0;
    root.rotation.z = 0;
    root.scaling.set(1, Math.max(0.2, 1 - t * 0.8), 1);
    return;
  }
  root.rotation.x = 0;
  root.rotation.z = moving ? Math.sin(enemy.age * 8.2) * 0.05 : 0;
  root.scaling.set(1, 1, 1);
}

function show(enemy, visible) {
  for (const mesh of enemy.meshes) mesh.visible = visible;
  enemy.root.scaling.set(1, 1, 1);
  enemy.root.rotation.x = 0;
  enemy.root.rotation.z = 0;
}

function syncRoot(enemy) {
  const bob =
    enemy.state === "patrol" || enemy.state === "chase" || enemy.state === "return"
      ? Math.abs(Math.sin(enemy.age * 8.2)) * 0.045
      : 0;
  const sink =
    enemy.state === "dead" ? Math.min(1.15, enemy.deadAge * 1.25) : 0;
  enemy.position.y = height(enemy.position.x, enemy.position.z);
  enemy.root.position.set(
    enemy.position.x,
    enemy.position.y + bob - sink,
    enemy.position.z,
  );
  enemy.root.rotation.y = enemy.yaw;
}

function enter(enemy, state) {
  enemy.state = state;
  enemy.stateAge = 0;
  if (state === "idle") enemy.idleFor = 1.4 + (enemy.waypoint % 3) * 0.5;
  if (state === "dead") {
    enemy.hostile = false;
    enemy.deadAge = 0;
    enemy.hidden = false;
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
  enter(enemy, "idle");
  syncRoot(enemy);
}

function face(enemy, x, z) {
  const dx = x - enemy.position.x;
  const dz = z - enemy.position.z;
  if (Math.hypot(dx, dz) > 0.001) enemy.yaw = Math.atan2(dx, dz);
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
    setVisual(enemy, false, dt);
    if (!enemy.hidden && enemy.deadAge >= ENEMY_TUNING.deathHideAfter) {
      show(enemy, false);
      enemy.hidden = true;
      if (ctx.targeting?.current === enemy) ctx.targeting.clear();
    }
    if (enemy.deadAge >= ENEMY_TUNING.respawnDelay) respawn(enemy);
    syncRoot(enemy);
    return;
  }

  const dist = xz(enemy.position, playerPos);
  const toSpawn = xz(enemy.position, enemy.spawn);
  const canSee = !playerDead && dist <= ENEMY_TUNING.aggroRadius && lineOfSight(enemy, player, raycast);
  const leashed = toSpawn > ENEMY_TUNING.leashRadius;

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

  setVisual(enemy, moving, dt);
  if (enemy.state === "attack") {
    const punch = enemy.attackCooldown > ENEMY_TUNING.attackCooldown - 0.22 ? 0.18 : 0;
    enemy.root.rotation.x = -punch;
  }
  syncRoot(enemy);
}

function makeEnemy(engine, scene, world, spec, index, mats) {
  const x = pathX(spec.z) + spec.side;
  const planted = plant(x, spec.z, world.colliders || [], ENEMY_TUNING.radius, spec.id);
  const visual = buildShade(engine, scene, spec.id, mats);
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
  const enemy = {
    id: spec.id,
    name: spec.name,
    position,
    hostile: true,
    hp: ENEMY_TUNING.hp,
    hpMax: ENEMY_TUNING.hp,
    hits: 0,
    hitsLanded: 0,
    meshes: visual.meshes,
    root: visual.root,
    recover: false,
    radius: ENEMY_TUNING.radius,
    spawn,
    spawnYaw: spec.side >= 0 ? -0.4 : 0.4,
    yaw: spec.side >= 0 ? -0.4 : 0.4,
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
  visual.root.rotation.y = enemy.yaw;
  syncRoot(enemy);
  return enemy;
}

export async function loadEnemies(engine, scene, world) {
  const cloth = await surface(
    engine,
    "Grave shade cloth",
    "/tex/bark_brown_02/diff.jpg",
    { tint: [0.52, 0.58, 0.34], light: 1.08, pixels: 64 },
  );
  const eyes = await surface(
    engine,
    "Grave shade eyes",
    "/tex/rock_wall_08/diff.jpg",
    { tint: [0.95, 1.15, 0.28], light: 0.35, emission: 1.7, pixels: 16 },
  );
  const mats = { cloth, eyes };
  return ANCHORS.map((spec, i) => makeEnemy(engine, scene, world, spec, i, mats));
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
    position: { x: e.position.x, y: e.position.y, z: e.position.z },
    spawn: { x: e.spawn.x, z: e.spawn.z },
  }));
}
