import {
  loadTexture2D,
  createGridSpriteAtlas,
  createFacingBillboardSystem,
  addFacingBillboardSystem,
  addBillboardSprite,
  updateBillboardSprite,
  billboardBlendAdditive,
  billboardBlendAlpha,
  createPointLight,
  createSphere,
  createShaderMaterial,
  setShaderUniform,
  setMeshVisible,
  addToScene,
} from "@babylonjs/lite";
import { rng } from "./geometry.js";

const CHARGE = 1.1;
const BURST = 1.7;
const RING = 36;
const ORBIT = 28;
const PILLARS = 48;
const GEYSER = 28;
const FLAMES = 36;
const SPARKS = 96;
const SMOKE = 18;
const FIRE_COUNT = RING + ORBIT + PILLARS + GEYSER + FLAMES;

function pool(system, n, random) {
  return Array.from({ length: n }, () => ({
    handle: addBillboardSprite(system, {
      position: [0, -50, 0],
      visible: false,
      sizeWorld: [1, 1],
    }),
    angle: random() * Math.PI * 2,
    seed: random(),
  }));
}

function hide(list) {
  for (const q of list) updateBillboardSprite(q.handle, { visible: false });
}

function fireMaterial() {
  const OUT =
    "struct PyreOut{@builtin(position) position:vec4<f32>,@location(0) p:vec3<f32>,@location(1) n:vec3<f32>};";
  return createShaderMaterial({
    name: "Pyre fire volume",
    attributes: ["position", "normal"],
    uniforms: [
      "worldViewProjection",
      { name: "time", type: "f32", defaultValue: 0 },
      { name: "heat", type: "f32", defaultValue: 0 },
    ],
    backFaceCulling: false,
    vertexSource: `${OUT} @vertex fn mainVertex(i:VertexInput)->PyreOut{var o:PyreOut;o.position=shaderSystem.worldViewProjection*vec4<f32>(i.position,1);o.p=i.position;o.n=i.normal;return o;}`,
    fragmentSource: `${OUT}
    @fragment fn mainFragment(i:PyreOut)->@location(0)vec4<f32>{
      let t=shaderUniforms.time;let heat=shaderUniforms.heat;
      let bands=.55+.45*sin(i.p.y*18.0+t*9.0+i.p.x*7.0);
      let rim=pow(1.0-abs(i.n.y),2.4);
      let core=vec3<f32>(2.8,.42,.03)*heat;
      let edge=vec3<f32>(1.1,.12,.01)*bands;
      let glow=vec3<f32>(.55,.45,.12)*rim*heat;
      return vec4<f32>(core+edge+glow,1);
    }`,
  });
}

/** Charged fire nova at the caster's feet. */
export async function createGravePulseVfx(
  engine,
  scene,
  player,
  world,
  handPosition,
) {
  const random = rng(7741);
  const [fireTex, smokeTex, sparkTex] = await Promise.all(
    ["fire_01.png", "smoke_01.png", "spark_05.png"].map((name) =>
      loadTexture2D(engine, "/ashen-reach/fire-blast/" + name, {
        invertY: false,
        srgb: false,
        mipMaps: true,
        magFilter: "nearest",
        minFilter: "nearest",
      }),
    ),
  );
  const atlas = (tex) =>
    createGridSpriteAtlas(tex, { cellWidthPx: 512, cellHeightPx: 512 });
  const fireSys = createFacingBillboardSystem(atlas(fireTex), {
    capacity: FIRE_COUNT,
    blendMode: billboardBlendAdditive,
  });
  const smokeSys = createFacingBillboardSystem(atlas(smokeTex), {
    capacity: SMOKE,
    blendMode: billboardBlendAlpha,
  });
  const sparkSys = createFacingBillboardSystem(atlas(sparkTex), {
    capacity: SPARKS,
    blendMode: billboardBlendAdditive,
  });
  addFacingBillboardSystem(scene, fireSys);
  addFacingBillboardSystem(scene, smokeSys);
  addFacingBillboardSystem(scene, sparkSys);
  const ring = pool(fireSys, RING, random);
  const orbit = pool(fireSys, ORBIT, random);
  const pillars = pool(fireSys, PILLARS, random);
  const geyser = pool(fireSys, GEYSER, random);
  const flames = pool(fireSys, FLAMES, random);
  const sparks = pool(sparkSys, SPARKS, random);
  const smoke = pool(smokeSys, SMOKE, random);
  const mat = fireMaterial();
  const shock = createSphere(engine, { diameter: 1, segments: 16 });
  shock.name = "Pyre shock";
  shock.material = mat;
  addToScene(scene, shock);
  setMeshVisible(shock, false);
  const lights = [0, 1, 2].map(() => {
    const light = createPointLight([0, 0, 0], 0);
    light.diffuse = [1, 0.26, 0.04];
    light.range = 14;
    addToScene(scene, light);
    return light;
  });
  const materials = [...new Set((world.meshes || []).map((m) => m.material))];
  let stage = "idle",
    age = 0,
    origin = [0, 0, 0],
    clock = 0;
  function feet() {
    const p = player.body.position;
    return [p.x, p.y - player.capsuleHeight * 0.42, p.z];
  }
  function paintWorld(pos, strength) {
    for (const m of materials) {
      setShaderUniform(m, "firePosition", pos);
      setShaderUniform(m, "fireStrength", strength);
    }
  }
  function paintHand(pos, strength) {
    if (!handPosition) return;
    for (const m of materials) {
      setShaderUniform(m, "handFirePosition", pos);
      setShaderUniform(m, "handFireStrength", strength);
    }
  }
  function clear() {
    hide(ring);
    hide(orbit);
    hide(pillars);
    hide(geyser);
    hide(flames);
    hide(sparks);
    hide(smoke);
    setMeshVisible(shock, false);
    for (const light of lights) light.intensity = 0;
    paintWorld(origin, 0);
    paintHand(origin, 0);
  }
  return {
    begin() {
      stage = "charge";
      age = 0;
      origin = feet();
    },
    cancel() {
      stage = "idle";
      age = 10;
      clear();
    },
    trigger() {
      origin = feet();
      stage = "burst";
      age = 0;
    },
    update(dt) {
      if (stage === "idle") return;
      age += dt;
      clock += dt;
      origin = feet();
      const [ox, oy, oz] = origin;
      const hand = handPosition ? handPosition() : [ox, oy + 1.1, oz];
      setShaderUniform(mat, "time", clock);
      if (stage === "charge") {
        const p = Math.min(1, age / CHARGE);
        const spin = age * 5.2;
        for (const q of ring) {
          const r = 0.45 + p * 1.55;
          updateBillboardSprite(q.handle, {
            position: [
              ox + Math.cos(q.angle + spin * 0.15) * r,
              oy + 0.28 + Math.sin(age * 10 + q.seed) * 0.08,
              oz + Math.sin(q.angle + spin * 0.15) * r,
            ],
            sizeWorld: [0.7 + p * 0.9, 0.55 + p * 0.7],
            rotation: q.angle + age,
            color: [2.6, 0.4 + p * 0.5, 0.04, 0.4 + p * 0.55],
            visible: true,
          });
        }
        for (const q of orbit) {
          const t = (age * (0.55 + q.seed * 0.5) + q.seed) % 1;
          const h = 0.2 + t * (1.15 + p * 0.7);
          const r = 0.85 + (1 - t) * (0.45 + p * 0.4) + q.seed * 0.2;
          const a = q.angle + spin;
          updateBillboardSprite(q.handle, {
            position: [ox + Math.cos(a) * r, oy + h, oz + Math.sin(a) * r],
            sizeWorld: [0.22 + p * 0.28, 0.32 + p * 0.38],
            rotation: a,
            color: [2.5, 0.55, 0.05, (0.25 + p * 0.55) * Math.sin(t * Math.PI)],
            visible: true,
          });
        }
        hide(pillars);
        hide(geyser);
        hide(flames);
        hide(smoke);
        for (const q of sparks) {
          const t = (age * (0.7 + q.seed * 0.5) + q.seed) % 1;
          const r = (1 - t) * (1.8 + p * 3.4);
          const a = q.angle + age * 3.4;
          updateBillboardSprite(q.handle, {
            position: [
              ox + Math.cos(a) * r,
              oy + 0.15 + t * (0.9 + p * 0.7),
              oz + Math.sin(a) * r,
            ],
            sizeWorld: [0.05 + q.seed * 0.07, 0.09 + q.seed * 0.08],
            rotation: a,
            color: [2.4, 0.7, 0.06, Math.sin(t * Math.PI) * (0.35 + p * 0.65)],
            visible: true,
          });
        }
        setMeshVisible(shock, false);
        setShaderUniform(mat, "heat", 0.35 + p * 0.9);
        lights[0].position.set(ox, oy + 0.85, oz);
        lights[0].intensity = p * 4.2 + Math.sin(age * 22) * p * 0.35;
        lights[1].position.set(...hand);
        lights[1].intensity = p * 2.4;
        lights[2].position.set(ox, oy + 1.6, oz);
        lights[2].intensity = p * 1.4;
        paintWorld([ox, oy + 0.5, oz], p * 5.2);
        paintHand(hand, p * 2.6);
        return;
      }
      if (stage === "burst") {
        const t = age / BURST;
        const fade = Math.max(0, 1 - t);
        const live = t < 1;
        const radius = Math.min(8.6, 0.5 + age * 18);
        hide(orbit);
        for (const q of ring) {
          const r = radius * (0.92 + q.seed * 0.14);
          updateBillboardSprite(q.handle, {
            position: [
              ox + Math.cos(q.angle) * r,
              oy + 0.38 + Math.sin(age * 12 + q.seed) * 0.16,
              oz + Math.sin(q.angle) * r,
            ],
            sizeWorld: [1.4 + t * 1.8, 0.85 + t * 1.3],
            rotation: q.angle + age * 1.6,
            color: [3.1, Math.max(0.1, 0.95 - t * 0.85), 0.04, fade * 1.05],
            visible: live && t < 0.9,
          });
        }
        for (let i = 0; i < pillars.length; i++) {
          const q = pillars[i];
          const col = i % 8;
          const step = Math.floor(i / 8);
          const a = (col / 8) * Math.PI * 2 + q.seed * 0.2;
          const local = (age - step * 0.035) / (0.55 + q.seed * 0.25);
          const r = 4.6 + q.seed * 2.2;
          const up = Math.max(0, local) * (1.4 + step * 0.38 + q.seed * 0.6);
          updateBillboardSprite(q.handle, {
            position: [
              ox + Math.cos(a) * r,
              oy + 0.25 + up,
              oz + Math.sin(a) * r,
            ],
            sizeWorld: [0.7 + q.seed * 0.55, 0.95 + q.seed * 0.7],
            rotation: a + age * 2,
            color: [2.9, 0.4, 0.03, Math.max(0, 1 - local) * 0.95],
            visible: live && local >= 0 && local < 1,
          });
        }
        for (const q of geyser) {
          const local = age / (0.7 + q.seed * 0.3);
          const up = Math.max(0, local) * (2.2 + q.seed * 3.4);
          const r = (0.05 + q.seed * 0.55) * Math.min(1, local);
          updateBillboardSprite(q.handle, {
            position: [
              ox + Math.cos(q.angle) * r,
              oy + 0.2 + up,
              oz + Math.sin(q.angle) * r,
            ],
            sizeWorld: [0.7 + q.seed * 0.9, 1.1 + q.seed * 1.2],
            rotation: q.angle + age * 4,
            color: [3.2, 0.55, 0.05, Math.max(0, 1 - local)],
            visible: live && local < 1,
          });
        }
        for (const q of flames) {
          const local = age / (0.6 + q.seed * 0.4);
          const r = (0.4 + q.seed * 4.2) * Math.min(1, local);
          updateBillboardSprite(q.handle, {
            position: [
              ox + Math.cos(q.angle) * r,
              oy + 0.3 + local * (0.8 + q.seed * 1.6),
              oz + Math.sin(q.angle) * r,
            ],
            sizeWorld: [0.65 + q.seed * 0.8, 0.8 + q.seed * 1.0],
            rotation: q.angle + age * 3,
            color: [2.8, 0.38, 0.03, Math.max(0, 1 - local)],
            visible: live && local < 1,
          });
        }
        for (const q of sparks) {
          const life = 0.45 + q.seed * 0.65;
          const local = (age - q.seed * 0.04) / life;
          const v = 5.2 + q.seed * 8.5;
          updateBillboardSprite(q.handle, {
            position: [
              ox + Math.cos(q.angle) * v * Math.max(0, local),
              oy +
                0.4 +
                (2.2 + q.seed * 3.4) * Math.max(0, local) -
                3.2 * local * local,
              oz + Math.sin(q.angle) * v * Math.max(0, local) * 0.9,
            ],
            sizeWorld: [0.09 + q.seed * 0.12, 0.16 + q.seed * 0.14],
            rotation: q.angle,
            color: [2.8, 0.9, 0.08, Math.max(0, 1 - local)],
            visible: live && local >= 0 && local < 1,
          });
        }
        for (const q of smoke) {
          const local = (age - 0.06) / (1.25 + q.seed * 0.4);
          updateBillboardSprite(q.handle, {
            position: [
              ox + Math.cos(q.angle) * (0.5 + local * 2.2),
              oy + 0.5 + local * 2.4,
              oz + Math.sin(q.angle) * (0.5 + local * 2.2),
            ],
            sizeWorld: [1.1 + local * 2.4, 1.1 + local * 2.4],
            rotation: q.angle + age * 0.18,
            color: [
              0.14,
              0.08,
              0.05,
              Math.max(0, Math.sin(local * Math.PI) * 0.5),
            ],
            visible: live && local >= 0 && local < 1,
          });
        }
        const boom = Math.max(0, 1 - age / 0.62) ** 1.15;
        const shockR = Math.min(8.5, 0.4 + age * 14);
        shock.position.set(ox, oy + 0.12, oz);
        shock.scaling.set(shockR, 0.06 + boom * 0.1, shockR);
        setMeshVisible(shock, live && age < 0.55);
        setShaderUniform(mat, "heat", boom * 1.4 + 0.2);
        lights[0].position.set(ox, oy + 0.9, oz);
        lights[0].intensity = boom * 9.5;
        lights[1].position.set(ox + Math.cos(age * 8) * radius * 0.6, oy + 1.1, oz);
        lights[1].intensity = boom * 4.8;
        lights[2].position.set(ox, oy + 2.2, oz);
        lights[2].intensity = boom * 3.6;
        paintWorld([ox, oy + 0.55, oz], boom * 12);
        paintHand(hand, boom * 1.2);
        if (!live) {
          stage = "idle";
          clear();
        }
      }
    },
    get active() {
      return stage !== "idle";
    },
    stats: {
      sprites: FIRE_COUNT + SPARKS + SMOKE,
      systems: 3,
      lights: 3,
      meshes: 1,
    },
  };
}
